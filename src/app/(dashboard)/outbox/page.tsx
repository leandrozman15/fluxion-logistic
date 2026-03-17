'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, increment, getDoc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Trash2, Clock, Send, CheckCircle2, AlertCircle, XCircle, RotateCcw, Info, Zap, Play } from "lucide-react";
import { OutboxMessage, OutboxState, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendRealEmail } from "@/services/email-sender";

export default function OutboxPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Load Tenant Settings for SMTP
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

  const handleUpdateState = async (id: string, newState: OutboxState) => {
    if (!db || !tenantId) return;
    setIsActionLoading(id);
    try {
      const msgRef = doc(db, "tenants", tenantId, "outbox", id);
      await updateDoc(msgRef, { 
        state: newState,
        updatedAt: serverTimestamp(),
        lastError: null
      });
      toast({ title: "Estado atualizado!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleProcessQueue = async () => {
    if (!db || !tenantId || !messages || !tenant?.settings?.smtpConfig) {
      toast({ 
        variant: "destructive", 
        title: "SMTP não configurado", 
        description: "Configure seu Gmail e Senha de App no menu Ajustes primeiro." 
      });
      return;
    }

    const queued = messages.filter(m => m.state === 'queued');
    if (queued.length === 0) {
      toast({ title: "Fila Vazia", description: "Não há mensagens aguardando envio." });
      return;
    }

    setIsProcessingQueue(true);
    const smtpConfig = tenant.settings.smtpConfig;
    
    toast({ title: "Iniciando Automação Real", description: `Enviando ${queued.length} e-mails via Gmail SMTP...` });

    for (const msg of queued) {
      try {
        const msgRef = doc(db, "tenants", tenantId, "outbox", msg.id);
        
        // 1. Call real email sender service
        await sendRealEmail({
          config: smtpConfig,
          to: msg.to,
          subject: msg.subject,
          body: msg.body
        });

        // 2. Update status on success
        await updateDoc(msgRef, {
          state: 'sent',
          sentAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          attempts: increment(1)
        });

        // Update Campaign stats if linked
        if (msg.campaignId) {
          const campRef = doc(db, "tenants", tenantId, "campaigns", msg.campaignId);
          await updateDoc(campRef, { sentCount: increment(1) });
        }

        // Add short delay between sends to respect Gmail rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err: any) {
        console.error(`Failed to send email to ${msg.to}:`, err);
        const msgRef = doc(db, "tenants", tenantId, "outbox", msg.id);
        
        await updateDoc(msgRef, {
          state: 'failed',
          lastError: err.message || "Erro desconhecido no SMTP",
          attempts: increment(1),
          updatedAt: serverTimestamp()
        });
        
        if (msg.campaignId) {
          const campRef = doc(db, "tenants", tenantId, "campaigns", msg.campaignId);
          await updateDoc(campRef, { failedCount: increment(1) });
        }
      }
    }

    setIsProcessingQueue(false);
    toast({ title: "Fila processada!", description: "Verifique o status de cada envio na tabela." });
  };

  const getStateBadge = (state: OutboxState) => {
    switch (state) {
      case 'queued': return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 animate-pulse"><Clock className="w-3 h-3 mr-1" /> Na Fila</Badge>;
      case 'sent': return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'failed': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Falha</Badge>;
      default: return <Badge variant="secondary">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Outbox</h1>
          <p className="text-muted-foreground">Fila de saída conectada ao seu Gmail SMTP.</p>
        </div>
        <div className="flex items-center gap-2">
          {!tenant?.settings?.smtpConfig?.user && (
            <Link href="/settings/tenant">
              <Button variant="outline" className="text-amber-600 border-amber-200">Configurar Gmail</Button>
            </Link>
          )}
          <Button 
            className="bg-green-600 hover:bg-green-700 font-bold" 
            onClick={handleProcessQueue} 
            disabled={isProcessingQueue}
          >
            {isProcessingQueue ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Disparar E-mails Reais
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between border-b">
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
            <Input
              type="search"
              placeholder="Buscar por empresa..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa / Destino</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhuma mensagem nesta categoria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{msg.companyName}</span>
                        <span className="text-[10px] text-muted-foreground">{msg.to}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStateBadge(msg.state)}
                        {msg.lastError && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[9px] text-destructive italic truncate max-w-[150px] cursor-help flex items-center gap-1">
                                  <AlertCircle className="w-2 h-2" /> {msg.lastError}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">{msg.lastError}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-accent/5">{msg.effectiveScore}</Badge></TableCell>
                    <TableCell className="text-right">
                      {msg.state === 'failed' && (
                        <Button variant="ghost" size="icon" onClick={() => handleUpdateState(msg.id, 'queued')} title="Reententar">
                          <RotateCcw className="w-4 h-4 text-orange-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
