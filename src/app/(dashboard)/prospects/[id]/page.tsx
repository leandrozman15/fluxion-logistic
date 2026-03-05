
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, runTransaction, serverTimestamp, setDoc, getDoc, collection, query, orderBy, increment, addDoc, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2, Globe, MapPin, Mail, Phone, ExternalLink, MessageSquare, History, Sparkles, Loader2, CheckCircle2, Send, Wand2, BrainCircuit, AlertCircle, SearchCode, MailPlus, UserPlus, Info, Ban, ShieldAlert, MessageCircle, ArrowLeft, Lightbulb, Clock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus, EmailTemplate, OutboxMessage, OutboxState, AiConfidence, Contact, Task } from "@/app/lib/types";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { renderTemplate } from "@/lib/utils/template-renderer";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { generateWhatsAppMessage } from "@/ai/flows/generate-whatsapp-message-flow";
import { normalizePhoneBR, buildWaMeUrl, buildWhatsAppMessage } from "@/lib/utils/whatsapp";
import { calculateNextAction } from "@/lib/utils/nba";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { addDays } from "date-fns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOutboxDialogOpen, setIsOutboxDialogOpen] = useState(false);
  const [isDncDialogOpen, setIsDncDialogOpen] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedContactIndex, setSelectedContactIndex] = useState<string>("0");
  const [isSavingOutbox, setIsSavingOutbox] = useState(false);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isAiWhatsAppDrafting, setIsAiWhatsAppDrafting] = useState(false);
  
  const [customSubject, setCustomSubject] = useState<string | null>(null);
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [dncReason, setDncReason] = useState("");
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

  const nba = useMemo(() => prospect ? calculateNextAction(prospect) : null, [prospect]);

  useEffect(() => {
    if (searchParams?.get('action') === 'prepare' && !loading && prospect) {
      setIsOutboxDialogOpen(true);
    }
    if (searchParams?.get('action') === 'whatsapp' && !loading && prospect) {
      handleOpenWhatsAppDialog();
    }
  }, [searchParams, loading, prospect]);

  const createFollowUpTask = async (type: 'followup_whatsapp' | 'followup_email') => {
    if (!db || !tenantId || !prospect || !user) return;
    try {
      const dueAt = addDays(new Date(), 2);
      await addDoc(collection(db, "tenants", tenantId, "tasks"), {
        tenantId,
        prospectId: prospect.id,
        companyName: prospect.companyName,
        type,
        dueAt,
        state: "open",
        assignedTo: user.uid,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      toast({ title: "Follow-up agendado", description: "Tarefa criada para daqui a 2 dias." });
    } catch (e) {
      console.error("Error creating task:", e);
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

  const handleToggleDnc = async () => {
    if (!prospectRef || !prospect || !user) return;
    setIsUpdating(true);
    try {
      const isEnabling = !prospect.doNotContact;
      await updateDoc(prospectRef, {
        doNotContact: isEnabling,
        doNotContactReason: isEnabling ? dncReason : "",
        doNotContactAt: isEnabling ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, "tenants", tenantId, "events"), {
        type: isEnabling ? "dnc_enabled" : "dnc_disabled",
        prospectId: prospect.id,
        companyName: prospect.companyName,
        actorUid: user.uid,
        createdAt: serverTimestamp(),
        metadata: { reason: dncReason }
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

  const handleImproveEmailWithAi = async () => {
    if (!prospect || !selectedTemplate) return;
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
          contactName: selectedContact?.name,
          contactRole: selectedContact?.role,
          effectiveScore: prospect.effectiveScore,
          scoreReasons: prospect.aiScoreReasons || prospect.scoreReasons
        }
      });
      setCustomSubject(result.subject);
      setCustomBody(result.body);
      toast({ title: "Email melhorado com IA!" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na IA" });
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handleSaveToOutbox = async (state: OutboxState) => {
    if (!db || !tenantId || !prospect || !user) return;
    setIsSavingOutbox(true);
    try {
      const outboxRef = collection(db, "tenants", tenantId, "outbox");
      await addDoc(outboxRef, {
        tenantId,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        type: 'email',
        state,
        to: selectedContact?.email || "",
        subject: previewSubject,
        body: previewBody,
        prospectId: prospect.id,
        companyName: prospect.companyName,
        effectiveScore: prospect.effectiveScore,
        attempts: 0,
        lastError: null,
        aiUsed: !!customBody
      });

      await updateDoc(prospectRef as any, { 
        lastContactAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await addDoc(collection(db, "tenants", tenantId, "events"), {
        type: "email_prepared",
        prospectId: prospect.id,
        companyName: prospect.companyName,
        actorUid: user.uid,
        createdAt: serverTimestamp(),
        metadata: { state, to: selectedContact?.email, aiUsed: !!customBody }
      });

      if (state === 'queued') {
        createFollowUpTask('followup_email');
      }

      toast({ title: state === 'queued' ? "Email na fila!" : "Rascunho salvo!" });
      setIsOutboxDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar no Outbox" });
    } finally {
      setIsSavingOutbox(false);
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
      metadata: { phoneE164: normalized, hasPrefilledText: !!whatsAppDraft }
    });

    await updateDoc(prospectRef as any, { 
      lastContactAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    createFollowUpTask('followup_whatsapp');

    window.open(buildWaMeUrl(normalized, whatsAppDraft), "_blank");
    setIsWhatsAppDialogOpen(false);
  };

  const executeNBA = () => {
    if (!nba) return;
    switch (nba.type) {
      case 'suggest_emails':
      case 'analyze_website':
        toast({ title: "Ação Sugerida", description: nba.reason });
        break;
      case 'prepare_email':
        setIsOutboxDialogOpen(true);
        break;
      case 'whatsapp_first':
      case 'followup':
        handleOpenWhatsAppDialog();
        break;
      default:
        break;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'whatsapp_opened': return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'email_prepared': return <Mail className="w-4 h-4 text-blue-500" />;
      case 'status_changed': return <RefreshCw className="w-4 h-4 text-orange-500" />;
      case 'dnc_enabled': return <Ban className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = (event: any) => {
    switch (event.type) {
      case 'whatsapp_opened': return "Contato via WhatsApp iniciado";
      case 'email_prepared': return `E-mail preparado para ${event.metadata?.to}`;
      case 'status_changed': return `Status alterado de ${event.metadata?.from} para ${event.metadata?.to}`;
      case 'dnc_enabled': return `Adicionado à lista DNC: ${event.metadata?.reason}`;
      case 'dnc_disabled': return "Removido da lista DNC";
      default: return event.type;
    }
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
                <Badge 
                  variant="secondary" 
                  className="bg-accent/10 text-accent border-accent/20 cursor-pointer hover:bg-accent/20"
                  onClick={executeNBA}
                >
                  <Lightbulb className="w-3 h-3 mr-1" /> {nba.label}
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

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        onClick={() => setIsOutboxDialogOpen(true)} 
                        className="bg-primary" 
                        disabled={!hasEmail || prospect.doNotContact}
                      >
                        <Send className="w-4 h-4 mr-2" /> E-mail
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!hasEmail && <TooltipContent>Sem e-mail cadastrado</TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Visão Geral</CardTitle></CardHeader>
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

          <Tabs defaultValue="history">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Linha do Tempo
              </TabsTrigger>
              <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
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
                        {events?.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground text-sm italic">Nenhuma atividade registrada ainda.</div>
                        ) : (
                          events?.map((event: any, i: number) => (
                            <div key={i} className="flex gap-4 group">
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                  {getEventIcon(event.type)}
                                </div>
                                {i !== events.length - 1 && <div className="w-0.5 h-full bg-border mt-2"></div>}
                              </div>
                              <div className="pb-6">
                                <div className="text-sm font-semibold text-primary">{getEventLabel(event)}</div>
                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                                  <Clock className="w-3 h-3" /> 
                                  {event.createdAt?.toDate ? format(event.createdAt.toDate(), "dd 'de' MMMM, HH:mm", { locale: ptBR }) : "Agora"}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
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
               <Button 
                variant={prospect.doNotContact ? "destructive" : "outline"} 
                size="sm" 
                className="w-full text-xs"
                onClick={() => setIsDncDialogOpen(true)}
               >
                 <Ban className="w-4 h-4 mr-2" /> {prospect.doNotContact ? "Remover Bloqueio" : "Não Contactar (DNC)"}
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs... */}
      <Dialog open={isOutboxDialogOpen} onOpenChange={setIsOutboxDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preparar Comunicação por E-mail</DialogTitle>
            <DialogDescription>Personalize o contato antes de enviar.</DialogDescription>
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
                <Label>Contato Alvo</Label>
                <Select value={selectedContactIndex} onValueChange={setSelectedContactIndex}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {prospect.contacts?.map((c, i) => (
                      <SelectItem key={i} value={i.toString()}>{c.name} ({c.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                className="w-full text-accent border-accent" 
                onClick={handleImproveEmailWithAi}
                disabled={isAiDrafting || !selectedTemplateId}
              >
                {isAiDrafting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Personalizar com IA
              </Button>
            </div>

            <div className="bg-secondary/20 p-4 rounded-xl space-y-3 border">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Preview do Envio</h4>
              <div className="space-y-1">
                <Label className="text-[10px]">Assunto</Label>
                <div className="text-sm font-semibold border-b pb-1">{previewSubject || "..."}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Corpo</Label>
                <div 
                  className="text-xs bg-white p-3 rounded border min-h-[150px] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewBody || "<i>Selecione um template...</i>" }}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOutboxDialogOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => handleSaveToOutbox('draft')} disabled={isSavingOutbox || !previewBody}>
              Salvar Rascunho
            </Button>
            <Button onClick={() => handleSaveToOutbox('queued')} disabled={isSavingOutbox || !previewBody}>
              {isSavingOutbox ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enfileirar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button onClick={handleFinalizeWhatsApp} className="bg-green-500 hover:bg-green-600 w-full">
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDncDialogOpen} onOpenChange={setIsDncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{prospect.doNotContact ? "Remover DNC" : "Ativar Do Not Contact"}</DialogTitle>
          </DialogHeader>
          {!prospect.doNotContact && (
            <div className="space-y-2 py-4">
              <Label>Motivo do Bloqueio</Label>
              <Input value={dncReason} onChange={e => setDncReason(e.target.value)} placeholder="Ex: Solicitou opt-out" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDncDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleToggleDnc} disabled={isUpdating}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
