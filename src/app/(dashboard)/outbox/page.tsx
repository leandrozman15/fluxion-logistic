
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, where, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Trash2, Clock, Send, CheckCircle2, AlertCircle, Eye, XCircle, RotateCcw, Info } from "lucide-react";
import { OutboxMessage, OutboxState } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function OutboxPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  const outboxQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    let q = query(collection(db, "tenants", tenantId, "outbox"), orderBy("createdAt", "desc"));
    if (activeTab !== "all") {
      q = query(collection(db, "tenants", tenantId, "outbox"), where("state", "==", activeTab), orderBy("createdAt", "desc"));
    }
    return q;
  }, [db, tenantId, activeTab]);

  const { data: messages, loading } = useCollection<OutboxMessage>(outboxQuery);

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    return messages.filter(m => m.companyName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [messages, searchTerm]);

  const getStateBadge = (state: OutboxState) => {
    switch (state) {
      case 'draft': return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Rascunho</Badge>;
      case 'queued': return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50"><Send className="w-3 h-3 mr-1" /> Na Fila</Badge>;
      case 'sent': return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" /> Enviado</Badge>;
      case 'failed': return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Falha</Badge>;
      case 'canceled': return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" /> Cancelado</Badge>;
      default: return <Badge>{state}</Badge>;
    }
  };

  const handleUpdateState = async (id: string, newState: OutboxState) => {
    if (!db || !tenantId) return;
    setIsActionLoading(id);
    try {
      const msgRef = doc(db, "tenants", tenantId, "outbox", id);
      const updates: any = { 
        state: newState,
        updatedAt: serverTimestamp()
      };
      
      // Si estamos reintentando, reseteamos errores y intentos
      if (newState === 'queued') {
        updates.lastError = null;
        // Solo el backend debería resetear attempts en producción, 
        // pero aquí lo permitimos para la lógica de reintento manual
      }

      await updateDoc(msgRef, updates);
      toast({ title: `Mensagem movida para ${newState}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na operação", description: "Verifique suas permissões." });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !tenantId || !confirm("Remover esta mensagem permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "outbox", id));
      toast({ title: "Mensagem removida" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro al excluir" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Outbox</h1>
          <p className="text-muted-foreground">Monitoramento e controle de comunicações enviadas e em fila.</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="queued">Na Fila</TabsTrigger>
              <TabsTrigger value="failed">Falhas</TabsTrigger>
              <TabsTrigger value="sent">Enviados</TabsTrigger>
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
                <TableHead>Tentativas</TableHead>
                <TableHead>Última Att</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhuma mensagem encontrada nesta categoria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMessages.map((msg) => (
                  <TableRow key={msg.id} className={msg.state === 'failed' ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/prospects/${msg.prospectId}`} className="font-semibold hover:underline text-primary">
                          {msg.companyName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{msg.to}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStateBadge(msg.state)}
                        {msg.lastError && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] text-destructive flex items-center gap-1 cursor-help truncate max-w-[150px]">
                                  <Info className="w-2.5 h-2.5" /> {msg.lastError}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent><p className="max-w-xs text-xs">{msg.lastError}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {msg.attempts} {msg.attempts > 0 && <span className="text-muted-foreground">/ 3</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {msg.updatedAt?.toDate ? msg.updatedAt.toDate().toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {msg.state === 'draft' && (
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateState(msg.id, 'queued')} title="Enfileirar">
                            <Send className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {(msg.state === 'failed' || msg.state === 'canceled') && (
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateState(msg.id, 'queued')} title="Reententar">
                            <RotateCcw className="w-4 h-4 text-orange-600" />
                          </Button>
                        )}
                        {msg.state === 'queued' && (
                          <Button variant="ghost" size="icon" onClick={() => handleUpdateState(msg.id, 'canceled')} title="Cancelar">
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(msg.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
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
