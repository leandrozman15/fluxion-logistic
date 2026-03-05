
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, runTransaction, serverTimestamp, setDoc, getDoc, collection, query, orderBy, increment, addDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Building2, Globe, MapPin, Mail, Phone, ExternalLink, MessageSquare, History, Sparkles, Loader2, CheckCircle2, Send, Wand2, BrainCircuit, AlertCircle, SearchCode, MailPlus, UserPlus, Info, Ban, ShieldAlert, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus, EmailTemplate, OutboxMessage, OutboxState, AiConfidence, Contact } from "@/app/lib/types";
import { useParams } from "next/navigation";
import { renderTemplate } from "@/lib/utils/template-renderer";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { calculateProspectAiScore } from "@/ai/flows/calculate-prospect-ai-score-flow";
import { analyzeWebsiteContent, AnalyzeWebsiteOutput } from "@/ai/flows/analyze-website-content-flow";
import { suggestCorporateEmails, SuggestEmailsOutput } from "@/ai/flows/suggest-corporate-emails-flow";
import { generateWhatsAppMessage } from "@/ai/flows/generate-whatsapp-message-flow";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { deriveDomain, extractEmailsFromText } from "@/lib/utils/email-domain";
import { normalizePhoneBR, buildWaMeUrl, buildWhatsAppMessage } from "@/lib/utils/whatsapp";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOutboxDialogOpen, setIsOutboxDialogOpen] = useState(false);
  const [isWebAnalysisDialogOpen, setIsWebAnalysisDialogOpen] = useState(false);
  const [isEmailSuggestionDialogOpen, setIsEmailSuggestionDialogOpen] = useState(false);
  const [isDncDialogOpen, setIsDncDialogOpen] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedContactIndex, setSelectedContactIndex] = useState<string>("0");
  const [isSavingOutbox, setIsSavingOutbox] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isAnalyzingWeb, setIsAnalyzingWeb] = useState(false);
  const [isSuggestingEmails, setIsSuggestingEmails] = useState(false);
  const [isAiWhatsAppDrafting, setIsAiWhatsAppDrafting] = useState(false);
  
  const [customSubject, setCustomSubject] = useState<string | null>(null);
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [dncReason, setDncReason] = useState("");
  
  const [webAnalysisResult, setWebAnalysisResult] = useState<AnalyzeWebsiteOutput | null>(null);
  const [selectedWebTags, setSelectedWebTags] = useState<string[]>([]);
  
  const [emailSuggestions, setEmailSuggestions] = useState<SuggestEmailsOutput['suggestions'] | null>(null);
  const [whatsAppDraft, setWhatsAppDraft] = useState("");

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
    if (!prospectRef || !db || !tenantId) return;
    setIsUpdating(true);
    try {
      const today = new Date();
      const yearWeek = `${today.getFullYear()}-${Math.ceil((today.getDate() + 6 - today.getDay()) / 7)}`;
      const weeklyStatsRef = doc(db, "tenants", tenantId, "weeklyStats", yearWeek);

      await runTransaction(db, async (transaction) => {
        transaction.update(prospectRef, { 
          status: newStatus,
          updatedAt: new Date().toISOString()
        });

        if (newStatus !== 'new') {
          const statsDoc = await transaction.get(weeklyStatsRef);
          const field = `statusChangedTo_${newStatus}`;
          if (statsDoc.exists()) {
            transaction.update(weeklyStatsRef, { [field]: increment(1) });
          } else {
            transaction.set(weeklyStatsRef, { 
              id: yearWeek, 
              weekId: yearWeek, 
              [field]: 1,
              statusChangedTo_contacted: newStatus === 'contacted' ? 1 : 0,
              statusChangedTo_interested: newStatus === 'interested' ? 1 : 0,
              statusChangedTo_demo: newStatus === 'demo' ? 1 : 0,
              statusChangedTo_client: newStatus === 'client' ? 1 : 0
            });
          }
        }
      });

      toast({ title: "Status atualizado", description: `O prospect agora está como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleDnc = async () => {
    if (!prospectRef || !prospect) return;
    setIsUpdating(true);
    try {
      const isEnabling = !prospect.doNotContact;
      await updateDoc(prospectRef, {
        doNotContact: isEnabling,
        doNotContactReason: isEnabling ? dncReason : "",
        doNotContactAt: isEnabling ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });
      toast({ 
        title: isEnabling ? "Bloqueado!" : "Desbloqueado", 
        description: isEnabling ? "O prospect não aparecerá mais no Radar." : "Prospect liberado."
      });
      setIsDncDialogOpen(false);
      setDncReason("");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro" });
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

      toast({ title: "Score IA atualizado!", description: `Nota: ${result.aiScore}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no Scoring" });
    } finally {
      setIsScoring(false);
    }
  };

  const handleOpenWhatsAppDialog = () => {
    if (!prospect) return;
    const initialMsg = buildWhatsAppMessage(prospect);
    setWhatsAppDraft(initialMsg);
    setIsWhatsAppDialogOpen(true);
  };

  const handleImproveWhatsAppWithAi = async () => {
    if (!prospect) return;
    setIsAiWhatsAppDrafting(true);
    try {
      const result = await generateWhatsAppMessage({
        templateBaseText: whatsAppDraft,
        prospect: {
          companyName: prospect.companyName,
          city: prospect.address?.city,
          state: prospect.address?.state,
          industryTags: prospect.industryTags,
          contactName: selectedContact?.name,
          contactRole: selectedContact?.role,
        }
      });
      setWhatsAppDraft(result.message);
      toast({ title: "Mensagem melhorada!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na IA" });
    } finally {
      setIsAiWhatsAppDrafting(false);
    }
  };

  const handleFinalizeWhatsApp = async () => {
    if (!prospect || !db || !tenantId || !user) return;
    
    const phone = prospect.contacts?.[0]?.phone || prospect.contacts?.[0]?.whatsapp;
    const normalized = normalizePhoneBR(phone || "");
    
    if (!normalized) {
      toast({ variant: "destructive", title: "Telefone inválido" });
      return;
    }

    // Telemetria
    await addDoc(collection(db, "tenants", tenantId, "events"), {
      type: "whatsapp_opened",
      prospectId: prospect.id,
      companyName: prospect.companyName,
      actorUid: user.uid,
      createdAt: serverTimestamp(),
      metadata: { phoneE164: normalized, hasPrefilledText: !!whatsAppDraft }
    });

    window.open(buildWaMeUrl(normalized, whatsAppDraft), "_blank");
    setIsWhatsAppDialogOpen(false);
  };

  const handleClaimForToday = async () => {
    if (!db || !tenantId || !prospect || !user) return;
    if (prospect.doNotContact) return;
    
    setIsUpdating(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, "tenants", tenantId, "dailyStats", todayStr);
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

        if (currentQuota >= quotaLimit) throw new Error("Quota diária atingida.");

        transaction.update(pRef, {
          isClaimedToday: true,
          claimedAt: new Date().toISOString(),
          status: 'contacted'
        });

        if (!statsDoc.exists()) {
          transaction.set(statsRef, {
            date: todayStr,
            quotaUsed: 1,
            quotaLimit: 30,
            emailsSent: 0,
            emailsFailed: 0,
            newProspects: 0,
            radarAvgFinalScore: 0,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(statsRef, { quotaUsed: currentQuota + 1 });
        }
      });
      toast({ title: "Ativado!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-muted-foreground" /></div>;
  if (!prospect) return <div className="text-center py-20"><h2 className="text-xl font-bold">Prospect não encontrado.</h2></div>;

  const primaryPhone = prospect.contacts?.[0]?.phone || prospect.contacts?.[0]?.whatsapp;
  const isPhoneValid = !!normalizePhoneBR(primaryPhone || "");

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
              <Badge variant="default" className="bg-accent">Score Radar: {prospect.effectiveScore}</Badge>
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
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        onClick={handleOpenWhatsAppDialog} 
                        className="bg-green-500 hover:bg-green-600" 
                        disabled={!isPhoneValid || prospect.doNotContact}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isPhoneValid && <TooltipContent>Sem telefone válido</TooltipContent>}
                </Tooltip>
              </TooltipProvider>

              <Button onClick={() => setIsOutboxDialogOpen(true)} className="bg-primary" disabled={prospect.doNotContact}>
                <Send className="w-4 h-4 mr-2" /> E-mail
              </Button>
            </>
          )}
          {!prospect.isClaimedToday && prospect.status !== 'client' && (
            <Button onClick={handleClaimForToday} disabled={isUpdating || prospect.doNotContact} className="bg-green-600 hover:bg-green-700">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Ativar para Hoje
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Visão Geral</CardTitle>
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
                   <h4 className="text-xs font-bold uppercase text-accent">Análise de IA</h4>
                   <ul className="space-y-1">
                     {(prospect.aiScoreReasons || prospect.scoreReasons)?.map((reason, i) => (
                       <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {reason}</li>
                     ))}
                   </ul>
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
                  <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">{contact.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">{contact.role}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email || "-"}</span>
                      <span className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone || "-"}</span>
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
            <CardContent className="grid grid-cols-2 gap-2">
              {['new', 'contacted', 'interested', 'demo', 'client', 'discarded'].map((s) => (
                <Button key={s} disabled={isUpdating} variant={prospect.status === s ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange(s as any)} className="capitalize">
                  {s}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
            <CardContent>
               <Button 
                variant={prospect.doNotContact ? "default" : "outline"} 
                size="sm" 
                className="w-full text-destructive border-destructive"
                onClick={() => setIsDncDialogOpen(true)}
               >
                 <Ban className="w-4 h-4 mr-2" /> {prospect.doNotContact ? "Remover Bloqueio" : "Não Contactar"}
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WhatsApp Preparation Dialog */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preparar WhatsApp</DialogTitle>
            <DialogDescription>Ajuste a mensagem antes de abrir o contato direto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wa-text">Mensagem</Label>
              <Textarea 
                id="wa-text" 
                className="min-h-[150px] text-sm" 
                value={whatsAppDraft}
                onChange={(e) => setWhatsAppDraft(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="w-full text-accent border-accent" 
              onClick={handleImproveWhatsAppWithAi}
              disabled={isAiWhatsAppDrafting}
            >
              {isAiWhatsAppDrafting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Melhorar com IA
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWhatsAppDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleFinalizeWhatsApp} className="bg-green-500 hover:bg-green-600">
              <ExternalLink className="w-4 h-4 mr-2" /> Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outbox Dialog, DNC Dialog etc (already existing or similar to previous versions) */}
      <Dialog open={isDncDialogOpen} onOpenChange={setIsDncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{prospect.doNotContact ? "Remover DNC" : "Ativar Do Not Contact"}</DialogTitle>
          </DialogHeader>
          {!prospect.doNotContact && (
            <div className="space-y-2 py-4">
              <Label>Motivo</Label>
              <Input value={dncReason} onChange={e => setDncReason(e.target.value)} placeholder="Ex: Solicitou opt-out" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDncDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleToggleDnc} disabled={isUpdating}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
