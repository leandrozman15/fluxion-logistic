
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, increment, addDoc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Search, Loader2, Clock, CheckCircle2, AlertCircle, RotateCcw, Play, MessageCircle, Mail, ExternalLink, Zap, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import { OutboxMessage, OutboxState, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendRealEmail } from "@/services/email-sender";
import { normalizePhoneBR, buildWaMeUrl } from "@/lib/utils/whatsapp";

export default function OutboxPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // WhatsApp Fast-Blast State
  const [isWABlastOpen, setIsWhatsAppBlastOpen] = useState(false);
  const [waCurrentIndex, setWaCurrentIndex] = useState(0);

  const { data: tenant } = useDoc<Tenant>(useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]));

  const outboxQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "outbox"), orderBy("createdAt", "desc"));
  }, [db, tenantId]);

  const { data: messages, loading } = useCollection<OutboxMessage>(outboxQuery);

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => {
      const matchesSearch = !searchTerm || 
        m.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.to?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === "all" || m.state === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [messages, searchTerm, activeTab]);

  const waQueue = useMemo(() => {
    return filteredMessages.filter(m => m.type === 'whatsapp' && m.state === 'queued');
  }, [filteredMessages]);

  const handleUpdateState = async (id: string, newState: OutboxState) => {
    if (!db || !tenantId) return;
    setIsActionLoading(id);
    try {
      const msgRef = doc(db, "tenants", tenantId, "outbox", id);
      await updateDoc(msgRef, { 
        state: newState,
        lastError: newState === 'queued' ? null : undefined,
        updatedAt: serverTimestamp()
      });
      toast({ title: newState === 'queued' ? "Mensagem resetada para a fila" : "Status atualizado" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleProcessEmailQueue = async () => {
    if (!db || !tenantId || !messages) return;

    const smtp = tenant?.settings?.smtpConfig;
    if (!smtp || !smtp.user || !smtp.pass) {
      toast({ 
        variant: "destructive", 
        title: "SMTP não configurado", 
        description: "Vá em 'Ajustes do Motor' e insira seu Gmail e Senha de App de 16 dígitos." 
      });
      return;
    }

    const queued = messages.filter(m => m.state === 'queued' && m.type === 'email');
    if (queued.length === 0) {
      toast({ title: "Fila de E-mail Vazia", description: "Não há e-mails pendentes para disparar." });
      return;
    }

    setIsProcessingQueue(true);
    
    let successCount = 0;
    let failCount = 0;

    for (const msg of queued) {
      try {
        await sendRealEmail({ config: smtp, to: msg.to, subject: msg.subject, body: msg.body });
        await updateDoc(doc(db, "tenants", tenantId, "outbox", msg.id), {
          state: 'sent',
          sentAt: serverTimestamp(),
          attempts: increment(1),
          lastError: null
        });
        if (msg.campaignId) {
          await updateDoc(doc(db, "tenants", tenantId, "campaigns", msg.campaignId), { sentCount: increment(1) });
        }
        successCount++;
        // Delay para evitar bloqueios de SPAM do Gmail
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        failCount++;
        await updateDoc(doc(db, "tenants", tenantId, "outbox", msg.id), {
          state: 'failed',
          lastError: err.message || "Erro desconhecido no SMTP",
          attempts: increment(1)
        });
      }
    }
    
    setIsProcessingQueue(false);
    toast({ 
      title: "Processamento concluído", 
      description: `${successCount} enviados com sucesso, ${failCount} falhas.` 
    });
  };

  const startWhatsAppBlast = () => {
    if (waQueue.length === 0) {
      toast({ title: "Sem WhatsApp na fila" });
      return;
    }
    setWaCurrentIndex(0);
    setIsWhatsAppBlastOpen(true);
  };

  const sendCurrentWhatsApp = async () => {
    const current = waQueue[waCurrentIndex];
    if (!current || !db || !tenantId || !user) return;

    const normalized = normalizePhoneBR(current.to);
    if (!normalized) {
      toast({ variant: "destructive", title: "Número inválido" });
      return;
    }

    await updateDoc(doc(db, "tenants", tenantId, "outbox", current.id), {
      state: 'sent',
      sentAt: serverTimestamp(),
      attempts: increment(1)
    });

    if (current.campaignId) {
      await updateDoc(doc(db, "tenants", tenantId, "campaigns", current.campaignId), { sentCount: increment(1) });
    }

    await addDoc(collection(db, "tenants", tenantId, "events"), {
      type: "whatsapp_opened",
      prospectId: current.prospectId,
      companyName: current.companyName,
      actorUid: user.uid,
      createdAt: serverTimestamp(),
      metadata: { phoneE164: normalized }
    });

    window.open(buildWaMeUrl(normalized, current.body), "_blank");

    if (waCurrentIndex < waQueue.length - 1) {
      setWaCurrentIndex(prev => prev + 1);
    } else {
      setIsWhatsAppBlastOpen(false);
      toast({ title: "Sequência concluída!" });
    }
  };

  const getStateBadge = (state: OutboxState, error?: string | null) => {
    switch (state) {
      case 'queued': return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 animate-pulse"><Clock className="w-3 h-3 mr-1" /> Na Fila</Badge>;
      case 'sent': return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'failed': return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="cursor-help"><AlertCircle className="w-3 h-3 mr-1" /> Falha</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs bg-destructive text-destructive-foreground">
              <p className="text-xs font-bold mb-1">Motivo do Erro:</p>
              <p className="text-[10px] leading-tight">{error || "Erro de conexão SMTP"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
      default: return <Badge variant="secondary">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Outbox Multicanal</h1>
          <p className="text-muted-foreground">Fila de saída para E-mails (SMTP) e WhatsApp (Fast-Blast).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="text-green-600 border-green-200 font-bold" onClick={startWhatsAppBlast}>
            <MessageCircle className="w-4 h-4 mr-2" /> WA Fast-Blast ({waQueue.length})
          </Button>
          <Button className="bg-primary font-bold" onClick={handleProcessEmailQueue} disabled={isProcessingQueue}>
            {isProcessingQueue ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Disparar E-mails Reais
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between border-b bg-muted/10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="queued">Fila</TabsTrigger>
              <TabsTrigger value="sent">Enviados</TabsTrigger>
              <TabsTrigger value="failed">Falhas</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar empresa..." className="pl-8 bg-background" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-20 text-center text-muted-foreground text-sm">
            Nenhuma mensagem encontrada para os critérios selecionados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinatário</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">{msg.companyName}</span>
                      <span className="text-[10px] text-muted-foreground">{msg.to || "Sem destino cadastrado"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                      {msg.type === 'whatsapp' ? <MessageCircle className="w-3 h-3 mr-1 text-green-600" /> : <Mail className="w-3 h-3 mr-1 text-blue-600" />}
                      {msg.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStateBadge(msg.state, msg.lastError)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {msg.state === 'failed' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-blue-600 font-bold" 
                          onClick={() => handleUpdateState(msg.id, 'queued')}
                          disabled={isActionLoading === msg.id}
                        >
                          {isActionLoading === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                          Reenviar
                        </Button>
                      )}
                      {msg.state === 'queued' && msg.type === 'whatsapp' && (
                        <Button variant="ghost" size="sm" className="text-green-600 font-bold h-8" onClick={() => { setWaCurrentIndex(waQueue.findIndex(q => q.id === msg.id)); setIsWhatsAppBlastOpen(true); }}>
                          Disparar <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* WhatsApp Blast Dialog */}
      <Dialog open={isWABlastOpen} onOpenChange={setIsWhatsAppBlastOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" /> WhatsApp Fast-Blast
            </DialogTitle>
            <DialogDescription>
              A IA já personalizou a mensagem. Clique no botão para abrir o chat e enviar.
            </DialogDescription>
          </DialogHeader>
          
          {waQueue[waCurrentIndex] ? (
            <div className="py-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-primary">{waQueue[waCurrentIndex].companyName}</h3>
                  <p className="text-xs text-muted-foreground">{waQueue[waCurrentIndex].to}</p>
                </div>
                <Badge className="bg-accent/10 text-accent">Lead {waCurrentIndex + 1} de {waQueue.length}</Badge>
              </div>

              <div className="p-4 bg-secondary/30 border rounded-xl font-mono text-sm leading-relaxed italic whitespace-pre-wrap">
                {waQueue[waCurrentIndex].body}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsWhatsAppBlastOpen(false)}>Pausar</Button>
                <Button className="bg-green-600 hover:bg-green-700 flex-[2] font-bold text-lg h-14 shadow-lg shadow-green-200" onClick={sendCurrentWhatsApp}>
                  <MessageCircle className="w-6 h-6 mr-2" /> Enviar e Próximo <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">Fim da fila de WhatsApp.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
