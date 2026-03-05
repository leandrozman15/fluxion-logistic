
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, runTransaction, serverTimestamp, setDoc, getDoc, collection, query, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2, Globe, MapPin, Mail, Phone, ExternalLink, MessageSquare, History, Sparkles, Loader2, CheckCircle2, Send, Wand2, BrainCircuit, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus, EmailTemplate, OutboxState, AiConfidence } from "@/app/lib/types";
import { useParams } from "next/navigation";
import { renderTemplate } from "@/lib/utils/template-renderer";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { calculateProspectAiScore } from "@/ai/flows/calculate-prospect-ai-score-flow";
import { calculateEffectiveScore } from "@/lib/utils/scoring";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOutboxDialogOpen, setIsOutboxDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedContactIndex, setSelectedContactIndex] = useState<string>("0");
  const [isSavingOutbox, setIsSavingOutbox] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  
  const [customSubject, setCustomSubject] = useState<string | null>(null);
  const [customBody, setCustomBody] = useState<string | null>(null);

  const prospectRef = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return doc(db, "tenants", tenantId, "prospects", id as string);
  }, [db, tenantId, id]);

  const { data: prospect, loading } = useDoc<Prospect>(prospectRef);

  const templatesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "templates"), orderBy("name"));
  }, [db, tenantId]);

  const { data: templates } = useCollection<EmailTemplate>(templatesQuery);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedContact = prospect?.contacts?.[parseInt(selectedContactIndex)];

  const previewSubject = customSubject || (selectedTemplate && prospect ? renderTemplate(selectedTemplate.subject, prospect) : "");
  const previewBody = customBody || (selectedTemplate && prospect ? renderTemplate(selectedTemplate.body, prospect) : "");

  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!prospectRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(prospectRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Status atualizado", description: `O prospect agora está como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível actualizar el status." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRunAiScore = async () => {
    if (!prospect || !prospectRef) return;
    setIsScoring(true);
    try {
      const result = await calculateProspectAiScore({
        companyName: prospect.companyName,
        industryTags: prospect.industryTags || [],
        city: prospect.address?.city,
        state: prospect.address?.state,
        hasWebsite: !!prospect.websiteUrl,
        hasCorporateEmail: prospect.contacts?.some(c => c.email && !c.email.includes('gmail') && !c.email.includes('hotmail')) || false,
        hasPhone: prospect.contacts?.some(c => !!c.phone) || false,
        status: prospect.status,
        cnpj: prospect.cnpj
      });

      // Recalcular effectiveScore con los nuevos datos de IA
      const updatedProspectData = {
        ...prospect,
        aiScore: result.aiScore,
        aiScoreConfidence: result.confidence as AiConfidence,
        aiScoreReasons: result.reasons
      };
      
      const newEffectiveScore = calculateEffectiveScore(updatedProspectData);

      await updateDoc(prospectRef, {
        aiScore: result.aiScore,
        aiScoreConfidence: result.confidence,
        aiScoreReasons: result.reasons,
        aiScoreUpdatedAt: new Date().toISOString(),
        effectiveScore: newEffectiveScore,
        updatedAt: new Date().toISOString()
      });

      toast({ title: "Score IA atualizado!", description: `Nota atribuída: ${result.aiScore} (${result.confidence})` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro no Scoring", description: "Não foi possível processar a IA agora." });
    } finally {
      setIsScoring(false);
    }
  };

  const handleClaimForToday = async () => {
    if (!db || !tenantId || !prospect || !user) return;
    
    setIsUpdating(true);
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, "tenants", tenantId, "dailyStats", today);
    const pRef = doc(db, "tenants", tenantId, "prospects", prospect.id);

    try {
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        let currentQuota = 0;
        let quotaLimit = 30;

        if (statsDoc.exists()) {
          currentQuota = statsDoc.data().quotaUsed || 0;
          quotaLimit = statsDoc.data().quotaLimit || 30;
        }

        if (currentQuota >= quotaLimit) {
          throw new Error("Quota diária atingida.");
        }

        transaction.update(pRef, {
          isClaimedToday: true,
          claimedAt: new Date().toISOString(),
          status: 'contacted'
        });

        if (!statsDoc.exists()) {
          transaction.set(statsRef, {
            quotaUsed: 1,
            quotaLimit: 30,
            date: today,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(statsRef, {
            quotaUsed: currentQuota + 1
          });
        }
      });

      toast({ title: "Ativado!", description: "Este prospect foi adicionado ao seu radar de hoje." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao ativar", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImproveWithAi = async () => {
    if (!selectedTemplate || !prospect) return;
    
    setIsAiDrafting(true);
    try {
      const result = await generateEmailDraft({
        templateSubject: selectedTemplate.subject,
        templateBody: selectedTemplate.body,
        prospect: {
          companyName: prospect.companyName,
          city: prospect.address?.city,
          state: prospect.address?.state,
          industryTags: prospect.industryTags,
          websiteUrl: prospect.websiteUrl,
          effectiveScore: prospect.effectiveScore,
          scoreReasons: prospect.aiScoreReasons || prospect.scoreReasons,
          contactName: selectedContact?.name,
          contactRole: selectedContact?.role,
        }
      });
      
      setCustomSubject(result.subject);
      setCustomBody(result.body);
      
      toast({ title: "Email melhorado com IA!", description: "O rascunho foi personalizado para este prospect." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro na IA", description: "Não foi possível gerar a sugestão agora." });
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handlePrepareOutbox = async (targetState: OutboxState) => {
    if (!db || !tenantId || !prospect || !selectedTemplate || !user || !selectedContact) return;

    setIsSavingOutbox(true);
    const today = new Date().toISOString().split('T')[0];
    const dedupeKey = `manual:${prospect.id}:${selectedTemplate.id}:${today}`;
    
    let hash = 0;
    for (let i = 0; i < dedupeKey.length; i++) {
        const char = dedupeKey.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const messageId = `msg_${Math.abs(hash)}`;
    const messageRef = doc(db, "tenants", tenantId, "outbox", messageId);

    try {
      const existing = await getDoc(messageRef);
      if (existing.exists() && existing.data().state !== 'draft') {
        toast({ title: "Atenção", description: "Já existe um envio preparado para hoje com este template." });
        setIsOutboxDialogOpen(false);
        return;
      }

      await setDoc(messageRef, {
        id: messageId,
        tenantId,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        type: 'email',
        state: targetState,
        to: selectedContact.email,
        subject: previewSubject,
        body: previewBody,
        templateId: selectedTemplate.id,
        prospectId: prospect.id,
        campaignId: null,
        attempts: 0,
        lastError: null,
        dedupeKey,
        companyName: prospect.companyName,
        effectiveScore: prospect.effectiveScore,
        aiUsed: !!customSubject
      }, { merge: true });

      toast({ 
        title: targetState === 'queued' ? "Mensagem na fila!" : "Rascunho salvo", 
        description: targetState === 'queued' ? "O envio será processado em breve." : "Você pode encontrá-lo no Outbox."
      });
      setIsOutboxDialogOpen(false);
      setCustomSubject(null);
      setCustomBody(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível preparar o contato." });
    } finally {
      setIsSavingOutbox(false);
    }
  };

  useEffect(() => {
    setCustomSubject(null);
    setCustomBody(null);
  }, [selectedTemplateId]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-muted-foreground" /></div>;
  if (!prospect) return <div className="text-center py-20"><h2 className="text-xl font-bold">Prospect não encontrado.</h2></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{prospect.companyName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{prospect.cnpj}</Badge>
              <div className="flex items-center gap-1">
                <Badge variant="default" className="bg-accent">Score Radar: {prospect.effectiveScore}</Badge>
                {prospect.aiScoreConfidence && (
                  <Badge variant="secondary" className="text-[10px]">IA: {prospect.aiScoreConfidence}</Badge>
                )}
              </div>
              {prospect.isClaimedToday && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> No Radar de Hoje
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {prospect.isClaimedToday && (
            <Button onClick={() => setIsOutboxDialogOpen(true)} className="bg-primary">
              <Send className="w-4 h-4 mr-2" /> Preparar Contato
            </Button>
          )}
          {!prospect.isClaimedToday && prospect.status !== 'client' && (
            <Button onClick={handleClaimForToday} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Ativar para Hoje
            </Button>
          )}
          <Button variant="outline" size="sm">Editar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Visão Geral</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-accent text-accent hover:bg-accent/5" 
                onClick={handleRunAiScore}
                disabled={isScoring}
              >
                {isScoring ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <BrainCircuit className="w-3 h-3 mr-2" />}
                Análise Inteligente (IA)
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    {prospect.websiteUrl ? (
                      <a href={prospect.websiteUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                        {prospect.domain || "Website"} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <span>Sem website</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{prospect.address?.city || "-"}, {prospect.address?.state || "-"}</span>
                  </div>
                  <div className="pt-2">
                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Segmentos</h4>
                    <div className="flex flex-wrap gap-1">
                      {prospect.industryTags?.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-4 bg-accent/5 rounded-lg border border-accent/10">
                   <h4 className="text-xs font-bold uppercase text-accent flex items-center gap-2">
                     <BrainCircuit className="w-3 h-3" /> Análise de IA
                   </h4>
                   <ul className="space-y-1 mt-2">
                     {(prospect.aiScoreReasons?.length ? prospect.aiScoreReasons : prospect.scoreReasons)?.map((reason, i) => (
                       <li key={i} className="text-xs flex items-start gap-2">
                         <div className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0"></div>
                         <span className="text-muted-foreground leading-relaxed">{reason}</span>
                       </li>
                     ))}
                   </ul>
                   {prospect.aiScoreUpdatedAt && (
                     <p className="text-[9px] text-muted-foreground mt-2 italic">Actualizado em: {new Date(prospect.aiScoreUpdatedAt).toLocaleString()}</p>
                   )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="contacts">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Contatos ({prospect.contacts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Histórico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contacts" className="mt-6 space-y-4">
              {prospect.contacts?.map((contact, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">{contact.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">{contact.role}</div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email || "-"}</span>
                        <span className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone || "-"}</span>
                      </div>
                      {(contact.whatsapp || contact.phone) && (
                        <Button variant="outline" size="icon" className="text-green-600 border-green-200" asChild>
                          <a href={`https://wa.me/${(contact.whatsapp || contact.phone).replace(/\D/g, "")}`} target="_blank"><MessageSquare className="w-4 h-4" /></a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="history" className="mt-6">
              <div className="space-y-4">
                 <div className="flex gap-4">
                    <div className="flex flex-col items-center"><div className="w-2 h-2 rounded-full bg-primary"></div><div className="w-0.5 h-full bg-border"></div></div>
                    <div className="pb-4">
                      <div className="text-sm font-semibold">Importado no sistema</div>
                      <div className="text-xs text-muted-foreground">{new Date(prospect.createdAt).toLocaleDateString()}</div>
                    </div>
                 </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Status do Pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-2">
                 {['new', 'contacted', 'interested', 'demo', 'client', 'discarded'].map((s) => (
                   <Button key={s} disabled={isUpdating} variant={prospect.status === s ? (s === 'discarded' ? 'destructive' : 'default') : 'outline'} size="sm" onClick={() => handleStatusChange(s as ProspectStatus)} className="capitalize">
                     {s}
                   </Button>
                 ))}
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notas de Negócio</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <Textarea placeholder="Adicione uma observação técnica ou comercial..." className="min-h-[120px]" defaultValue={prospect.notes} />
               <Button className="w-full" size="sm">Salvar Notas</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Outbox Preparation Dialog */}
      <Dialog open={isOutboxDialogOpen} onOpenChange={setIsOutboxDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preparar Contato Industrial</DialogTitle>
            <DialogDescription>Escolha um template e verifique a personalização antes de enfileirar.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Base</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contato Destino</Label>
                <Select value={selectedContactIndex} onValueChange={setSelectedContactIndex}>
                  <SelectTrigger><SelectValue placeholder="Escolha o contato" /></SelectTrigger>
                  <SelectContent>
                    {prospect.contacts.map((c, i) => <SelectItem key={i} value={i.toString()}>{c.name} ({c.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <Button 
                  variant="outline" 
                  className="w-full border-accent text-accent hover:bg-accent/5" 
                  onClick={handleImproveWithAi}
                  disabled={isAiDrafting}
                >
                  {isAiDrafting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Melhorar com IA
                </Button>
              )}
            </div>

            <div className="bg-secondary/20 p-4 rounded-lg border space-y-3 relative overflow-hidden">
              <div className="text-[10px] font-bold text-muted-foreground uppercase flex justify-between items-center">
                Preview {customSubject && <Badge className="bg-accent h-4 text-[8px] uppercase">IA Gerado</Badge>}
              </div>
              {selectedTemplate ? (
                <>
                  <div className="text-sm font-semibold border-b pb-2">{previewSubject}</div>
                  <div className="text-xs whitespace-pre-wrap text-muted-foreground italic leading-relaxed">{previewBody}</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground italic h-40 flex items-center justify-center">Selecione um template para ver o preview.</div>
              )}
              {isAiDrafting && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={!selectedTemplate || isSavingOutbox || isAiDrafting} onClick={() => handlePrepareOutbox('draft')}>
              Salvar como Rascunho
            </Button>
            <Button disabled={!selectedTemplate || isSavingOutbox || isAiDrafting} onClick={() => handlePrepareOutbox('queued')} className="bg-primary">
              {isSavingOutbox ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enfileirar para Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
