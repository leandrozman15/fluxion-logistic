'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, runTransaction, serverTimestamp, setDoc, getDoc, collection, query, orderBy, increment } from "firebase/firestore";
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
import { Building2, Globe, MapPin, Mail, Phone, ExternalLink, MessageSquare, History, Sparkles, Loader2, CheckCircle2, Send, Wand2, BrainCircuit, AlertCircle, SearchCode, MailPlus, UserPlus, Info, Ban, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus, EmailTemplate, OutboxMessage, OutboxState, AiConfidence, Contact } from "@/app/lib/types";
import { useParams } from "next/navigation";
import { renderTemplate } from "@/lib/utils/template-renderer";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { calculateProspectAiScore } from "@/ai/flows/calculate-prospect-ai-score-flow";
import { analyzeWebsiteContent, AnalyzeWebsiteOutput } from "@/ai/flows/analyze-website-content-flow";
import { suggestCorporateEmails, SuggestEmailsOutput } from "@/ai/flows/suggest-corporate-emails-flow";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { deriveDomain, extractEmailsFromText } from "@/lib/utils/email-domain";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOutboxDialogOpen, setIsOutboxDialogOpen] = useState(false);
  const [isWebAnalysisDialogOpen, setIsWebAnalysisDialogOpen] = useState(false);
  const [isEmailSuggestionDialogOpen, setIsEmailSuggestionDialogOpen] = useState(false);
  const [isDncDialogOpen, setIsDncDialogOpen] = useState(false);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedContactIndex, setSelectedContactIndex] = useState<string>("0");
  const [isSavingOutbox, setIsSavingOutbox] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [isAnalyzingWeb, setIsAnalyzingWeb] = useState(false);
  const [isSuggestingEmails, setIsSuggestingEmails] = useState(false);
  
  const [customSubject, setCustomSubject] = useState<string | null>(null);
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [dncReason, setDncReason] = useState("");
  
  const [webAnalysisResult, setWebAnalysisResult] = useState<AnalyzeWebsiteOutput | null>(null);
  const [selectedWebTags, setSelectedWebTags] = useState<string[]>([]);
  
  const [emailSuggestions, setEmailSuggestions] = useState<SuggestEmailsOutput['suggestions'] | null>(null);

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
      toast({ variant: "destructive", title: "Erro", description: "Não foi posible guardar la actualización." });
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
        description: isEnabling ? "Este prospect não aparecerá mais no Radar." : "Prospect liberado para prospecção."
      });
      setIsDncDialogOpen(false);
      setDncReason("");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao atualizar compliance." });
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

      toast({ title: "Score IA atualizado!", description: `Nota atribuída: ${result.aiScore} (${result.confidence})` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no Scoring", description: "Não fue posible procesar la IA ahora." });
    } finally {
      setIsScoring(false);
    }
  };

  const handleRunWebAnalysis = async () => {
    if (!prospect?.websiteUrl) return;
    setIsAnalyzingWeb(true);
    setWebAnalysisResult(null);
    try {
      const result = await analyzeWebsiteContent({
        websiteUrl: prospect.websiteUrl,
        companyName: prospect.companyName
      });
      setWebAnalysisResult(result);
      setSelectedWebTags(result.industryTags);
      setIsWebAnalysisDialogOpen(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na Análise", description: e.message });
    } finally {
      setIsAnalyzingWeb(false);
    }
  };

  const handleApplyWebAnalysis = async () => {
    if (!prospectRef || !webAnalysisResult) return;
    setIsUpdating(true);
    try {
      const currentTags = prospect?.industryTags || [];
      const combinedTags = Array.from(new Set([...currentTags, ...selectedWebTags]));
      
      await updateDoc(prospectRef, {
        industryTags: combinedTags,
        aiWebSummary: webAnalysisResult.summary,
        aiWebAnalysisAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      toast({ title: "Dados atualizados!", description: "O perfil do prospect foi enriquecido con a análise web." });
      setIsWebAnalysisDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao aplicar", description: "Não foi possível salvar las alteraciones." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRunEmailSuggestions = async () => {
    if (!prospect || !prospectRef) return;
    
    const domain = deriveDomain(prospect.domain, prospect.websiteUrl, prospect.contacts?.map(c => c.email).filter(e => !!e) as string[]);
    
    if (!domain) {
      toast({ variant: "destructive", title: "Domínio necessário", description: "O prospect precisa ter um website ou domínio para sugerir padrões." });
      return;
    }

    setIsSuggestingEmails(true);
    try {
      const websiteExtractedEmails = extractEmailsFromText(prospect.aiWebSummary || "");

      const result = await suggestCorporateEmails({
        domain,
        companyName: prospect.companyName,
        contactName: prospect.contacts?.[0]?.name,
        existingEmails: prospect.contacts?.map(c => c.email).filter(e => !!e) as string[],
        websiteExtractedEmails
      });
      
      setEmailSuggestions(result.suggestions);
      
      await updateDoc(prospectRef, {
        aiEmailDomainUsed: domain,
        aiEmailSuggestions: result.suggestions,
        aiEmailSuggestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setIsEmailSuggestionDialogOpen(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na Sugestão", description: "Não fue posible generar sugerencias ahora." });
    } finally {
      setIsSuggestingEmails(false);
    }
  };

  const handleAddSuggestedContact = async (email: string, type: string) => {
    if (!prospect || !prospectRef) return;
    
    if (prospect.contacts?.some(c => c.email.toLowerCase() === email.toLowerCase())) {
      toast({ title: "Atenção", description: "Este e-mail já está cadastrado nos contatos." });
      return;
    }

    const newContact: Contact = {
      name: prospect.contacts?.[0]?.name || "Contato IA",
      role: type === 'generic_role' ? "Geral/Suporte" : "Sugerido",
      email: email.toLowerCase(),
      phone: "",
      verified: false,
      source: "ai_suggestion"
    };

    const updatedContacts = [...(prospect.contacts || []), newContact];
    
    setIsUpdating(true);
    try {
      await updateDoc(prospectRef, {
        contacts: updatedContacts,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Contato adicionado!", description: `E-mail ${email} foi adicionado à lista.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível guardar el contacto." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClaimForToday = async () => {
    if (!db || !tenantId || !prospect || !user) return;
    if (prospect.doNotContact) {
      toast({ variant: "destructive", title: "Ação bloqueada", description: "Prospect em lista negra (DNC)." });
      return;
    }
    
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
      toast({ variant: "destructive", title: "Erro na IA", description: "Não foi possível gerar a sugestão agora." });
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handlePrepareOutbox = async (targetState: OutboxState) => {
    if (!db || !tenantId || !prospect || !selectedTemplate || !user || !selectedContact) return;
    if (prospect.doNotContact) {
       toast({ variant: "destructive", title: "Ação bloqueada", description: "Não é possível enviar emails para contatos bloqueados (DNC)." });
       return;
    }

    setIsSavingOutbox(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const dedupeKey = `manual:${prospect.id}:${selectedTemplate.id}:${todayStr}`;
    
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
        description: targetState === 'queued' ? "O envio será processado em breve." : "Você puede encontrarlos en el Outbox."
      });
      setIsOutboxDialogOpen(false);
      setCustomSubject(null);
      setCustomBody(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não fue posible preparar el contacto." });
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
              {prospect.doNotContact && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Ban className="w-3 h-3" /> Bloqueado (DNC)
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {prospect.isClaimedToday && (
            <Button onClick={() => setIsOutboxDialogOpen(true)} className="bg-primary" disabled={prospect.doNotContact}>
              <Send className="w-4 h-4 mr-2" /> Preparar Contato
            </Button>
          )}
          {!prospect.isClaimedToday && prospect.status !== 'client' && (
            <Button onClick={handleClaimForToday} disabled={isUpdating || prospect.doNotContact} className="bg-green-600 hover:bg-green-700">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Ativar para Hoje
            </Button>
          )}
          <Button variant="outline" size="sm">Editar</Button>
        </div>
      </div>

      {prospect.doNotContact && (
        <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="w-6 h-6 text-destructive shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-destructive">Prospect em Lista Negra (Do Not Contact)</h3>
            <p className="text-xs text-destructive/80 mt-1">
              Motivo: {prospect.doNotContactReason || "Não informado"} - Registrado em {new Date(prospect.doNotContactAt || "").toLocaleString()}
            </p>
            <Button variant="link" size="sm" className="p-0 h-auto text-destructive underline mt-2" onClick={() => setIsDncDialogOpen(true)}>
              Remover bloqueio
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Visão Geral</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-primary text-primary hover:bg-primary/5" 
                  onClick={handleRunWebAnalysis}
                  disabled={isAnalyzingWeb || !prospect.websiteUrl}
                >
                  {isAnalyzingWeb ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <SearchCode className="w-3 h-3 mr-2" />}
                  Analisar Website
                </Button>
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
              </div>
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
                      {prospect.industryTags?.length ? prospect.industryTags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      )) : <span className="text-xs text-muted-foreground italic">Nenhum tag definido.</span>}
                    </div>
                  </div>
                  {prospect.aiWebSummary && (
                    <div className="pt-2 border-t mt-2">
                      <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Resumo Industrial (IA)</h4>
                      <p className="text-xs text-muted-foreground italic leading-relaxed">"{prospect.aiWebSummary}"</p>
                    </div>
                  )}
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
                     <p className="text-[9px] text-muted-foreground mt-2 italic">Atualizado em: {new Date(prospect.aiScoreUpdatedAt).toLocaleString()}</p>
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
              <TabsTrigger value="ai-tools" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Ferramentas IA
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contacts" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="text-primary border-primary" onClick={handleRunEmailSuggestions} disabled={isSuggestingEmails}>
                   {isSuggestingEmails ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <MailPlus className="w-3 h-3 mr-2" />}
                   Sugerir E-mails Corporativos
                </Button>
              </div>
              {prospect.contacts?.map((contact, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">{contact.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {contact.name}
                          {contact.verified === false && <Badge variant="outline" className="text-[8px] bg-orange-50 text-orange-600 border-orange-200">Não verificado</Badge>}
                          {contact.source === 'ai_suggestion' && <Badge variant="secondary" className="text-[8px] uppercase">IA</Badge>}
                        </div>
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
            <TabsContent value="ai-tools" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="hover:border-primary transition-colors cursor-pointer" onClick={handleRunEmailSuggestions}>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-primary">
                      <MailPlus className="w-4 h-4" /> Sugerir E-mails
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Detecta padrões corporativos para sugerir emails como nome.sobrenome@dominio.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="hover:border-accent transition-colors cursor-pointer" onClick={handleRunAiScore}>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-accent">
                      <BrainCircuit className="w-4 h-4" /> Refinar Score
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Reavalia o potencial industrial com base nos dados atuais.
                    </CardDescription>
                  </CardHeader>
                </Card>
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
             <CardHeader className="pb-2">
               <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                 <ShieldAlert className="w-4 h-4" /> Compliance
               </CardTitle>
             </CardHeader>
             <CardContent>
               <Button 
                variant={prospect.doNotContact ? "default" : "outline"} 
                size="sm" 
                className={`w-full ${prospect.doNotContact ? 'bg-destructive hover:bg-destructive/90' : 'text-destructive border-destructive hover:bg-destructive/5'}`}
                onClick={() => setIsDncDialogOpen(true)}
               >
                 <Ban className="w-4 h-4 mr-2" />
                 {prospect.doNotContact ? "Remover de Lista Negra" : "Marcar Do Not Contact"}
               </Button>
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

      {/* DNC Dialog */}
      <Dialog open={isDncDialogOpen} onOpenChange={setIsDncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{prospect.doNotContact ? "Remover Bloqueio" : "Marcar como Do Not Contact"}</DialogTitle>
            <DialogDescription>
              {prospect.doNotContact 
                ? "Deseja liberar este prospect para novas comunicações?" 
                : "Isso impedirá que o prospect apareça no Radar Diário e bloqueará qualquer envio de email."}
            </DialogDescription>
          </DialogHeader>
          {!prospect.doNotContact && (
            <div className="space-y-2 py-4">
              <Label htmlFor="dnc-reason">Motivo do bloqueio</Label>
              <Input 
                id="dnc-reason" 
                placeholder="Ex: Solicitou opt-out, dados incorretos..." 
                value={dncReason} 
                onChange={(e) => setDncReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDncDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant={prospect.doNotContact ? "default" : "destructive"} 
              onClick={handleToggleDnc} 
              disabled={isUpdating || (!prospect.doNotContact && !dncReason)}
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Suggestions Dialog */}
      <Dialog open={isEmailSuggestionDialogOpen} onOpenChange={setIsEmailSuggestionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sugestões de E-mail IA</DialogTitle>
            <DialogDescription>Padrões detectados para o domínio <strong>{prospect.aiEmailDomainUsed || prospect.domain}</strong>.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {emailSuggestions?.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-10">Não foi posible detectar patrones para este dominio.</p>
            ) : (
              emailSuggestions?.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/20 transition-colors">
                  <div className="space-y-1">
                    <div className="text-sm font-mono font-bold text-primary">{s.email}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[8px] uppercase ${
                        s.confidence === 'high' ? 'bg-green-50 text-green-600 border-green-200' :
                        s.confidence === 'medium' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        'bg-orange-50 text-orange-600 border-orange-200'
                      }`}>
                        {s.confidence} confidence
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleAddSuggestedContact(s.email, s.type)} 
                    disabled={isUpdating || prospect.contacts?.some(c => c.email.toLowerCase() === s.email.toLowerCase())}
                  >
                    {prospect.contacts?.some(c => c.email.toLowerCase() === s.email.toLowerCase()) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <UserPlus className="w-4 h-4 text-primary" />
                    )}
                  </Button>
                </div>
              ))
            )}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-700">
                Estes e-mails são baseados em padrões industriais e não são garantidos. Marque como verificado após o primeiro contato.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailSuggestionDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Website Analysis Dialog */}
      <Dialog open={isWebAnalysisDialogOpen} onOpenChange={setIsWebAnalysisDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Análise do Website Concluída</DialogTitle>
            <DialogDescription>A IA analisou o site da empresa. Selecione o que deseja aplicar ao perfil.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Resumo Detectado</Label>
              <div className="p-3 bg-secondary/30 rounded-lg text-sm italic border">
                "{webAnalysisResult?.summary}"
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Tags de Indústria Sugeridas</Label>
              <div className="grid grid-cols-1 gap-2">
                {webAnalysisResult?.industryTags.map(tag => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`tag-${tag}`} 
                      checked={selectedWebTags.includes(tag)}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedWebTags(prev => [...prev, tag]);
                        else setSelectedWebTags(prev => prev.filter(t => t !== tag));
                      }}
                    />
                    <label htmlFor={`tag-${tag}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {tag}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Keywords Técnicas</Label>
              <div className="flex flex-wrap gap-1">
                {webAnalysisResult?.detectedKeywords.map(kw => (
                  <Badge key={kw} variant="outline" className="text-[9px]">{kw}</Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWebAnalysisDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleApplyWebAnalysis} disabled={isUpdating} className="bg-primary">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Aplicar ao Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outbox Preparation Dialog */}
      <Dialog open={isOutboxDialogOpen} onOpenChange={setIsOutboxDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preparar Contato Industrial</DialogTitle>
            <DialogDescription>Escolha um template e verifique a personalização antes de enfileirar.</DialogDescription>
          </DialogHeader>

          {prospect.doNotContact ? (
            <div className="p-8 text-center space-y-4">
              <Ban className="w-12 h-12 mx-auto text-destructive opacity-50" />
              <p className="text-sm font-bold text-destructive">Bloqueado por compliance (Do Not Contact).</p>
              <Button variant="outline" onClick={() => setIsOutboxDialogOpen(false)}>Fechar</Button>
            </div>
          ) : (
            <>
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
                      <SelectTrigger><SelectValue placeholder="Escolha o contacto" /></SelectTrigger>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
