
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { 
  Building2, Globe, MapPin, Mail, Phone, ExternalLink, 
  Loader2, Send, BrainCircuit, MessageCircle, 
  ArrowLeft, Clock, Cpu, FileSearch, RefreshCw, Plus, UserPlus, Trash2, Edit, Sparkles, SearchCode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus, Contact } from "@/app/lib/types";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { analyzeWebsiteContent } from "@/ai/flows/analyze-website-content-flow";
import { normalizePhoneBR, buildWaMeUrl, buildWhatsAppMessage } from "@/lib/utils/whatsapp";
import { calculateNextAction } from "@/lib/utils/nba";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import Link from "next/link";
import { getSegmentKey } from "@/lib/utils/learning-loop";
import { fetchCnpjData } from "@/services/receita-ws";
import { formatSafeDate, toSafeDate } from "@/lib/utils/date-utils";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isAnalyzingWeb, setIsAnalyzingWeb] = useState(false);
  const [isSyncingReceita, setIsSyncingReceita] = useState(false);
  const [whatsAppDraft, setWhatsAppDraft] = useState("");

  // Contact Form State
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<Contact>({ name: "", role: "", email: "", phone: "" });

  const prospectRef = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return doc(db, "tenants", tenantId, "prospects", id as string);
  }, [db, tenantId, id]);

  const { data: prospect, loading } = useDoc<Prospect>(prospectRef);

  // Consulta simplificada para evitar erro de índice
  const historyQuery = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return query(
      collection(db, "tenants", tenantId, "events"),
      where("prospectId", "==", id as string)
    );
  }, [db, tenantId, id]);

  const { data: rawEvents, loading: eventsLoading } = useCollection<any>(historyQuery);

  // Ordenação manual em memória
  const sortedEvents = useMemo(() => {
    if (!rawEvents) return [];
    return [...rawEvents].sort((a, b) => {
      const dateA = toSafeDate(a.createdAt)?.getTime() || 0;
      const dateB = toSafeDate(b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [rawEvents]);

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

      if ((prospect.contacts?.length || 0) === 0) {
        updates.contacts = [{ name: "Contato via ReceitaWS", role: "N/A", email: data.email || "", phone: data.telefone || "" }];
      }

      await updateDoc(prospectRef, updates);
      toast({ title: "Dados Sincronizados!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na sincronização", description: e.message });
    } finally {
      setIsSyncingReceita(false);
    }
  };

  const handleAnalyzeWeb = async () => {
    if (!prospect?.websiteUrl || !prospectRef) return;
    setIsAnalyzingWeb(true);
    try {
      const analysis = await analyzeWebsiteContent({
        websiteUrl: prospect.websiteUrl,
        companyName: prospect.companyName
      });

      await updateDoc(prospectRef, {
        aiWebSummary: analysis.summary,
        aiDetectedKeywords: analysis.detectedKeywords,
        aiIndustrySuggestions: analysis.industryTags,
        aiWebAnalysisAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast({ title: "Site Analisado!", description: "Inteligência extraída com sucesso." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na análise web", description: e.message });
    } finally {
      setIsAnalyzingWeb(false);
    }
  };

  const handleSaveContact = async () => {
    if (!prospect || !prospectRef) return;
    setIsUpdating(true);
    try {
      const newContacts = [...(prospect.contacts || [])];
      if (editingContactIndex !== null) {
        newContacts[editingContactIndex] = contactForm;
      } else {
        newContacts.push(contactForm);
      }

      await updateDoc(prospectRef, { 
        contacts: newContacts,
        updatedAt: new Date().toISOString()
      });

      toast({ title: editingContactIndex !== null ? "Contato atualizado" : "Contato adicionado" });
      setIsContactDialogOpen(false);
      setContactForm({ name: "", role: "", email: "", phone: "" });
      setEditingContactIndex(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar contato" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteContact = async (index: number) => {
    if (!prospect || !prospectRef || !confirm("Remover este contato?")) return;
    try {
      const newContacts = prospect.contacts.filter((_, i) => i !== index);
      await updateDoc(prospectRef, { contacts: newContacts });
      toast({ title: "Contato removido" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao remover" });
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
    const primaryPhone = prospect.contacts?.find(c => !!c.phone || !!c.whatsapp)?.phone;
    const normalized = normalizePhoneBR(primaryPhone || "");
    if (!normalized) {
      toast({ variant: "destructive", title: "Cadastre um telefone válido primeiro." });
      return;
    }

    await addDoc(collection(db, "tenants", tenantId, "events"), {
      type: "whatsapp_opened",
      prospectId: prospect.id,
      companyName: prospect.companyName,
      actorUid: user.uid,
      createdAt: serverTimestamp(),
      metadata: { phoneE164: normalized }
    });

    window.open(buildWaMeUrl(normalized, whatsAppDraft), "_blank");
    setIsWhatsAppDialogOpen(false);
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  if (!prospect) return <div className="text-center py-20">Prospect não encontrado.</div>;

  const primaryPhone = prospect.contacts?.find(c => !!c.phone || !!c.whatsapp)?.phone;
  const isPhoneValid = !!normalizePhoneBR(primaryPhone || "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/prospects"><ArrowLeft className="w-4 h-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">{prospect.companyName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{prospect.cnpj}</Badge>
              <Badge className="bg-accent">Score: {prospect.effectiveScore}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAnalyzeWeb} disabled={isAnalyzingWeb || !prospect.websiteUrl}>
            {isAnalyzingWeb ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SearchCode className="w-4 h-4 mr-2" />}
            IA: Analisar Site
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncReceitaWS} disabled={isSyncingReceita}>
            {isSyncingReceita ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar ReceitaWS
          </Button>
          <Button onClick={handleOpenWhatsAppDialog} className="bg-green-600" disabled={!isPhoneValid}>
            <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-4 h-4" /> 
                  {prospect.websiteUrl ? (
                    <a href={prospect.websiteUrl.startsWith('http') ? prospect.websiteUrl : `https://${prospect.websiteUrl}`} target="_blank" className="hover:underline flex items-center gap-1">
                      {prospect.websiteUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : "Sem site"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {prospect.address?.city}, {prospect.address?.state}</div>
              </div>
              <div className="p-3 bg-accent/5 rounded-lg border">
                <h4 className="text-[10px] font-bold uppercase text-accent mb-1">Inteligência Extraída</h4>
                <div className="space-y-2">
                  {prospect.aiWebSummary ? (
                    <p className="text-xs leading-relaxed">{prospect.aiWebSummary}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">Site ainda não analisado pela IA.</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {(prospect.aiDetectedKeywords || []).map(kw => (
                      <Badge key={kw} variant="secondary" className="text-[8px] h-4 bg-white border">{kw}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="contacts">
            <TabsList>
              <TabsTrigger value="contacts">Contatos ({prospect.contacts?.length || 0})</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            
            <TabsContent value="contacts" className="space-y-4 pt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setEditingContactIndex(null); setContactForm({ name: "", role: "", email: "", phone: "" }); setIsContactDialogOpen(true); }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Novo Contato
                </Button>
              </div>
              
              {prospect.contacts?.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
                  Nenhum contato cadastrado.
                </div>
              ) : (
                prospect.contacts.map((contact, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">{contact.name.charAt(0)}</div>
                        <div>
                          <div className="font-bold">{contact.name}</div>
                          <div className="text-xs text-muted-foreground">{contact.role}</div>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email || "-"}</span>
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone || "-"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingContactIndex(i); setContactForm(contact); setIsContactDialogOpen(true); }}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteContact(i)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <Card><CardContent className="pt-6">
                <div className="space-y-4">
                  {sortedEvents?.map((e: any, i: number) => (
                    <div key={i} className="flex gap-3 text-sm border-l-2 pl-4 pb-4">
                      <div className="font-bold text-xs whitespace-nowrap">{formatSafeDate(e.createdAt, "dd/MM")}</div>
                      <div>
                        <div className="font-semibold">{e.type === 'whatsapp_opened' ? "WhatsApp Aberto" : "Status Alterado"}</div>
                        <div className="text-xs text-muted-foreground">{e.metadata?.phoneE164 || ""}</div>
                      </div>
                    </div>
                  ))}
                  {sortedEvents.length === 0 && (
                    <p className="text-center py-10 text-muted-foreground text-xs italic">Nenhuma ação registrada para este prospecto.</p>
                  )}
                </div>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="bg-secondary/30 border-dashed border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                <Sparkles className="w-3 h-3 text-accent" /> Próxima Melhor Ação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="font-bold text-sm text-primary">Análise Profunda do Site</div>
                  <p className="text-[10px] text-muted-foreground mt-1">A IA detectou que o site está disponível. Clique em "Analisar Site" para extrair tecnologias e o resumo operacional.</p>
                </div>
                <Button variant="outline" className="w-full text-xs font-bold" onClick={handleAnalyzeWeb} disabled={isAnalyzingWeb || !prospect.websiteUrl}>
                  Executar Pesquisa Web
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Status Atual</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {['new', 'contacted', 'interested', 'demo', 'client', 'discarded'].map((s) => (
                <Button key={s} variant={prospect.status === s ? 'default' : 'outline'} size="sm" className="capitalize text-[10px]" onClick={() => updateDoc(prospectRef!, { status: s })}>
                  {s}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para Contatos */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContactIndex !== null ? "Editar Contato" : "Novo Contato"}</DialogTitle>
            <DialogDescription>Cadastre o telefone com DDD para habilitar o WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={contactForm.role} onChange={e => setContactForm({...contactForm, role: e.target.value})} placeholder="Ex: Diretor de Compras" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} placeholder="email@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp</Label>
                <Input value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveContact} disabled={isUpdating || !contactForm.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para WhatsApp */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mensagem para {prospect.companyName}</DialogTitle></DialogHeader>
          <Textarea className="min-h-[150px] mt-4" value={whatsAppDraft} onChange={e => setWhatsAppDraft(e.target.value)} />
          <DialogFooter>
            <Button onClick={handleFinalizeWhatsApp} className="bg-green-600 w-full">Abrir WhatsApp Web</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
