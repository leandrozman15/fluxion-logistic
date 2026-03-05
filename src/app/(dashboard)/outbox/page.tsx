
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, where, deleteDoc, doc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Trash2, Clock, Send, CheckCircle2, AlertCircle, Eye } from "lucide-react";
import { OutboxMessage, OutboxState } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function OutboxPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

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
      case 'canceled': return <Badge variant="outline">Cancelado</Badge>;
      default: return <Badge>{state}</Badge>;
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !tenantId || !confirm("Remover esta mensagem da fila?")) return;
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "outbox", id));
      toast({ title: "Mensagem removida" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Outbox</h1>
          <p className="text-muted-foreground">Gerencie a fila de comunicações e rascunhos preparados.</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between border-b">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="draft">Rascunhos</TabsTrigger>
                <TabsTrigger value="queued">Na Fila</TabsTrigger>
                <TabsTrigger value="sent">Enviados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
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
                <TableHead>Empresa</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhuma mensagem encontrada nesta categoria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/prospects/${msg.prospectId}`} className="font-semibold hover:underline text-primary">
                          {msg.companyName}
                        </Link>
                        <span className="text-xs text-muted-foreground">Score: {msg.effectiveScore}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{msg.to}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{msg.subject}</TableCell>
                    <TableCell>{getStateBadge(msg.state)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Ver detalhes"><Eye className="w-4 h-4" /></Button>
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
