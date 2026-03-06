
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, runTransaction, serverTimestamp, collection, query, orderBy, increment, addDoc, where, getDocs, limit } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Building2, Globe, MapPin, Mail, Phone, ExternalLink, 
  MessageSquare, History, Sparkles, Loader2, CheckCircle2, 
  Send, Wand2, BrainCircuit, AlertCircle, SearchCode, 
  MailPlus, UserPlus, Info, Ban, ShieldAlert, MessageCircle, 
  ArrowLeft, Lightbulb, Clock, User, AlertTriangle, ShieldCheck, Zap,
  Cpu, FileSearch, CheckCircle, TrendingUp, TrendingDown,
  Target, Bot, Layers, Play, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus, EmailTemplate, OutboxState, SegmentStats, Sequence, SequenceEnrollment } from "@/app/lib/types";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { renderTemplate } from "@/lib/utils/template-renderer";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { generateWhatsAppMessage } from "@/ai/flows/generate-whatsapp-message-flow";
import { analyzeWebsiteContent } from "@/ai/flows/analyze-website-content-flow";
import { predictCloseProbability } from "@/ai/flows/predict-close-probability-flow";
import { generateApproachPlan, type GenerateApproachPlanOutput } from "@/ai/flows/generate-approach-plan-flow";
import { normalizePhoneBR, buildWaMeUrl, buildWhatsAppMessage } from "@/lib/utils/whatsapp";
import { calculateNextAction } from "@/lib/utils/nba";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { computeBaselineProbability } from "@/lib/utils/close-probability";
import { checkEmailQuality, calculateSpamProbability, isEmailOnCooldown } from "@/lib/utils/deliverability";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { addDays } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSegmentKey } from "@/lib/utils/learning-loop";
import { fetchCnpjData } from "@/services/receita-ws";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOutboxDialogOpen, setIsOutboxDialogOpen] = useState(false);
  const [isDncDialogOpen, setIsDncDialogOpen] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [isAiAgentDialogOpen, setIsAiAgentDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");
  const [selectedContactIndex, setSelectedContactIndex] = useState<string>("0");
  const [isSavingOutbox, setIsSavingOutbox] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isAiWhatsAppDrafting, setIsAiWhatsAppDrafting] = useState(false);
  const [isAnalyzingWeb, setIsAnalyzingWeb] = useState(false);
  const [isPredictingClose, setIsPredictingClose] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isSyncingReceita, setIsSyncingReceita] = useState(false);
  
  const [customSubject, setCustomSubject] = useState<string | null>(null);
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [dncReason, setDncReason] = useState("");
  const [whatsAppDraft, setWhatsAppDraft] = useState("");
  const [aiPlan, setAiPlan] = useState<GenerateApproachPlanOutput | null>(null);

  const prospectRef = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return doc(db, "tenants", tenantId, "prospects", id as string);
  }, [db, tenantId, id]);

  const { data: prospect, loading } = useDoc<Prospect>(prospectRef);

  // Active Sequence Data
  const enrollmentsQuery = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return query(collection(db, "tenants", tenantId, "sequenceEnrollments"), where("prospectId", "==", id), where("state", "==", "active"), limit(1));
  }, [db, tenantId, id]);
  const { data: enrollments } = useCollection<SequenceEnrollment>(enrollmentsQuery);
  const activeEnrollment = enrollments?.[0];

  const activeSequenceRef = useMemo(() => {
    if (!db || !tenantId || !activeEnrollment) return null;
    return doc(db, "tenants", tenantId, "sequences", activeEnrollment.sequenceId);
  }, [db, tenantId, activeEnrollment]);
  const { data: activeSequence } = useDoc<Sequence>(activeSequenceRef);

  // All sequences for enrollment
  const allSequencesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "sequences"), where("isActive", "==", true));
  }, [db, tenantId]);
  const { data: allSequences } = useCollection<Sequence>(allSequencesQuery);

  const segmentKey = useMemo(() => prospect ? getSegmentKey(prospect) : null, [prospect]);
  const segmentRef = useMemo(() => (db && tenantId && segmentKey) ? doc(db, "tenants", tenantId, "segmentStats", segmentKey) : null, [db, tenantId, segmentKey]);
  const { data: segmentData } = useDoc<SegmentStats>(segmentRef);

  const templatesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "templates"), orderBy("name"));
  }, [db, tenantId]);

  const { data: templates } = useCollection<EmailTemplate>(templatesQuery);

  const historyQuery = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return query(
      collection(db, "tenants", tenantId, "events"),
      where("prospectId", "==", id as string),
      orderBy("createdAt", "desc")
    );
  }, [db, tenantId, id]);

  const { data: events, loading: eventsLoading } = useCollection<any>(historyQuery);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedContact = prospect?.contacts?.[parseInt(selectedContactIndex)];

  const previewSubject = customSubject || (selectedTemplate && prospect ? renderTemplate(selectedTemplate.subject, prospect) : "");
  const previewBody = customBody || (selectedTemplate && prospect ? renderTemplate(selectedTemplate.body, prospect) : "");

  // Deliverability Checks
  const emailQuality = selectedContact?.email ? checkEmailQuality(selectedContact.email) : null;
  const spamProb = previewBody ? calculateSpamProbability(previewSubject, previewBody) : 0;
  const onCooldown = prospect ? isEmailOnCooldown(prospect.lastEmailSentAt) : false;

  const nba = useMemo(() => prospect ? calculateNextAction(prospect, segmentData, activeEnrollment, activeSequence) : null, [prospect, segmentData, activeEnrollment, activeSequence]);

  useEffect(() => {
    if (searchParams?.get('action') === 'prepare' && !loading && prospect) {
      setIsOutboxDialogOpen(true);
    }
    if (searchParams?.get('action') === 'whatsapp' && !loading && prospect) {
      handleOpenWhatsAppDialog();
    }
  }, [searchParams, loading, prospect]);

  const handleSyncReceitaWS = async () => {
    if (!prospect?.cnpj || !prospectRef) return;
    setIsSyncingReceita(true);
    try {
      const data = await fetchCnpjData(prospect.cnpj);
      const updates: any = {
        companyName: data.nome,
        industryTags: [data.atividade_principal[0].text, ...data.atividades_secundarias.slice(0, 2).map(a => a.text)],
        address: { city: data.municipio, state: data.uf, country: "Brasil" },
        updatedAt: new Date().toISOString()
      };

      // Add contact if empty
      if ((prospect.contacts?.length || 0) === 0) {
        updates.contacts = [{ name: "Contato via ReceitaWS", role: "N/A", email: data.email || "", phone: data.telefone || "" }];
      }

      await updateDoc(prospectRef, updates);
      
      await addDoc(collection(db!, "tenants", tenantId!, "events"), {
        type: "status_changed",
        prospectId: id,
        companyName: prospect.companyName,
        actorUid: user?.uid,
        createdAt: serverTimestamp(),
        metadata: { from: "manual", to: "official_receita", label: "Sincronização ReceitaWS" }
      });

      toast({ title: "Dados Sincronizados!", description: "Informações oficiais da ReceitaWS aplicadas." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na sincronização", description: e.message });
    } finally {
      setIsSyncingReceita(false);
    }
  };

  const handleAnalyzeWebsite = async () => {
    if (!prospect?.websiteUrl || !prospectRef) return;
    setIsAnalyzingWeb(true);
    try {
      const result = await analyzeWebsiteContent({ 
        websiteUrl: prospect.websiteUrl, 
        companyName: prospect.companyName 
      });

      const updates: Partial<Prospect> = {
        aiWebSummary: result.summary,
        aiDetectedKeywords: result.detectedKeywords,
        aiScoreConfidence: result.confidence,
        aiWebAnalysisAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const newScore = calculateEffectiveScore({ ...prospect, ...updates });
      updates.effectiveScore = newScore;

      await updateDoc(prospectRef, updates as any);

      await addDoc(collection(db!, "tenants", tenantId!, "events"), {
        type: "website_analyzed",
        prospectId: prospect.id,
        companyName: prospect.companyName,
        actorUid: user?.uid,
        createdAt: serverTimestamp(),
        metadata: { confidence: result.confidence, tagsFound: result.industryTags.length }
      });

      toast({ title: "Site analisado!", description: "Inteligência industrial extraída com sucesso." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na análise", description: e.message });
    } finally {
      setIsAnalyzingWeb(false);
    }
  };

  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!prospectRef || !db || !tenantId || !user) return;
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

        transaction.set(doc(collection(db, "tenants", tenantId, "events")), {
          type: "status_changed",
          prospectId: id,
          companyName: prospect?.companyName,
          actorUid: user.uid,
          createdAt: serverTimestamp(),
          metadata: { from: prospect?.status, to: newStatus }
        });

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
          }, { merge: true });
        }
      });

      toast({ title: "Status atualizado", description: `O prospect agora está como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenWhatsAppDialog = () => {
    if (!prospect) return;
    const initialMsg = buildWhatsAppMessage(prospect);
    setWhatsAppDraft(initialMsg);
    setIsWhatsAppDialogOpen(true);
  };

  const handleFinalizeWhatsApp = async () => {
    if (!prospect || !db || !tenantId || !user) return;
    const phone = prospect.contacts?.find(c => !!c.phone || !!c.whatsapp)?.phone || prospect.contacts?.find(c => !!c.phone || !!c.whatsapp)?.whatsapp;
    const normalized = normalizePhoneBR(phone || "");
    if (!normalized) {
      toast({ variant: "destructive", title: "Telefone inválido" });
      return;
    }

    await addDoc(collection(db, "tenants", tenantId, "events"), {
      type: "whatsapp_opened",
      prospectId: prospect.id,
      companyName: prospect.companyName,
      actorUid: user.uid,
      createdAt: serverTimestamp(),
      metadata: { phoneE164: normalized, hasPrefilledText: !!whatsAppDraft, enrollmentId: activeEnrollment?.id }
    });

    window.open(buildWaMeUrl(normalized, whatsAppDraft), "_blank");
    setIsWhatsAppDialogOpen(false);
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-muted-foreground" /></div>;
  if (!prospect) return <div className="text-center py-20"><h2 className="text-xl font-bold">Prospect não encontrado.</h2></div>;

  const primaryPhone = prospect.contacts?.find(c => !!c.phone || !!c.whatsapp)?.phone || prospect.contacts?.find(c => !!c.phone || !!c.whatsapp)?.whatsapp;
  const isPhoneValid = !!normalizePhoneBR(primaryPhone || "");
  const hasEmail = prospect.contacts?.some(c => !!c.email);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/prospects"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{prospect.companyName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{prospect.cnpj}</Badge>
              <Badge variant="default" className="bg-accent">Score Radar: {prospect.effectiveScore}</Badge>
              {nba && nba.type !== 'none' && (
                <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                  <Lightbulb className="w-3 h-3 mr-1" /> {nba.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncReceitaWS} 
            disabled={isSyncingReceita || !prospect.cnpj}
          >
            {isSyncingReceita ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar ReceitaWS
          </Button>
          {prospect.isClaimedToday && (
            <>
              <Button onClick={handleOpenWhatsAppDialog} className="bg-green-500" disabled={!isPhoneValid || prospect.doNotContact}>
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button onClick={() => setIsOutboxDialogOpen(true)} className="bg-primary" disabled={!hasEmail || prospect.doNotContact}>
                <Send className="w-4 h-4 mr-2" /> E-mail
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Visão Geral</CardTitle>
              {segmentData?.preferredChannel && (
                <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Recomendado: {segmentData.preferredChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                </Badge>
              )}
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
                   <h4 className="text-xs font-bold uppercase text-accent flex items-center gap-1">
                     <BrainCircuit className="w-3 h-3" /> Análise de IA
                   </h4>
                   <ul className="space-y-1">
                     {(prospect.aiScoreReasons || prospect.scoreReasons || [])?.map((reason, i) => (
                       <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {reason}</li>
                     ))}
                   </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-purple-50/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSearch className="w-5 h-5 text-purple-600" /> Website Intelligence
                </CardTitle>
                <CardDescription className="text-xs">Extração automática de produtos e processos industriais.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 border-purple-200 text-purple-700 hover:bg-purple-100"
                onClick={handleAnalyzeWebsite}
                disabled={isAnalyzingWeb || !prospect.websiteUrl}
              >
                {isAnalyzingWeb ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Cpu className="w-3 h-3 mr-2" />}
                {prospect.aiWebSummary ? "Reanalisar Site" : "Analisar Site"}
              </Button>
            </CardHeader>
            <CardContent>
              {prospect.aiWebSummary ? (
                <div className="space-y-4">
                  <div className="p-3 bg-white rounded-lg border border-purple-100 text-sm italic text-gray-700 leading-relaxed shadow-sm">
                    "{prospect.aiWebSummary}"
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-purple-600 mb-2">Palavras-chave Detectadas</h4>
                    <div className="flex flex-wrap gap-1">
                      {prospect.aiDetectedKeywords?.map(kw => (
                        <Badge key={kw} variant="outline" className="text-[9px] border-purple-200 bg-purple-50 text-purple-700">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg bg-white/50">
                  <Globe className="w-8 h-8 mx-auto text-purple-200 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma inteligência de website disponível ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="history">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Linha do Tempo
              </TabsTrigger>
              <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Contatos ({prospect.contacts?.length || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="mt-6">
               <Card>
                 <CardContent className="pt-6">
                    {eventsLoading ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : (
                      <div className="space-y-6">
                        {events?.map((event: any, i: number) => (
                          <div key={i} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                {event.type === 'whatsapp_opened' ? <MessageCircle className="w-4 h-4 text-green-500" /> : <Mail className="w-4 h-4 text-blue-500" />}
                              </div>
                              {i !== events.length - 1 && <div className="w-0.5 h-full bg-border mt-2"></div>}
                            </div>
                            <div className="pb-6">
                              <div className="text-sm font-semibold">{event.type === 'whatsapp_opened' ? "Contato via WhatsApp" : "E-mail Preparado"}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">{format(event.createdAt.toDate(), "dd 'de' MMMM, HH:mm", { locale: ptBR })}</div>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center"><div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><Clock className="w-4 h-4 text-primary" /></div></div>
                          <div>
                            <div className="text-sm font-semibold">Prospecto adicionado ao sistema</div>
                            <div className="text-[10px] text-muted-foreground">{format(new Date(prospect.createdAt), "dd 'de' MMMM, HH:mm", { locale: ptBR })}</div>
                          </div>
                        </div>
                      </div>
                    )}
                 </CardContent>
               </Card>
            </TabsContent>
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
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Status do Pipeline</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {['new', 'contacted', 'interested', 'demo', 'client', 'discarded'].map((s) => (
                <Button key={s} disabled={isUpdating} variant={prospect.status === s ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange(s as any)} className="capitalize text-[10px] h-8">
                  {s}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Compliance</CardTitle></CardHeader>
            <CardContent>
               <Button variant={prospect.doNotContact ? "destructive" : "outline"} size="sm" className="w-full text-xs" onClick={() => setIsDncDialogOpen(true)}>
                 <Ban className="w-4 h-4 mr-2" /> {prospect.doNotContact ? "Remover DNC" : "Ativar DNC"}
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preparar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea 
              className="min-h-[150px] text-sm" 
              value={whatsAppDraft}
              onChange={(e) => setWhatsAppDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleFinalizeWhatsApp} className="bg-green-500 hover:bg-green-600 w-full">
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDncDialogOpen} onOpenChange={setIsDncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar DNC</DialogTitle>
            <DialogDescription>Marcar esta empresa como "Do Not Contact" irá removê-la do Radar diário.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDncDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
