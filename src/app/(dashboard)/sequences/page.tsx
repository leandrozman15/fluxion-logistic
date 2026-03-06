'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Plus, Edit, Trash2, Loader2, Play, Pause, Clock, MessageCircle, Mail, CheckCircle2, Bot, Zap } from "lucide-react";
import { Sequence, SequenceStep, EmailTemplate } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

export default function SequencesPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState("");

  const sequencesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "sequences"), orderBy("createdAt", "desc"));
  }, [db, tenantId]);

  const { data: sequences, loading } = useCollection<Sequence>(sequencesQuery);

  const handleCreateSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !tenantId || !newName) return;

    setIsSubmitting(true);
    try {
      // Default initial steps for a standard industrial sequence
      const defaultSteps: SequenceStep[] = [
        { dayOffset: 0, channel: 'whatsapp', purpose: 'first_touch', useAgent: true },
        { dayOffset: 2, channel: 'email', purpose: 'followup', useAgent: true },
        { dayOffset: 5, channel: 'email', purpose: 'followup', useAgent: false },
        { dayOffset: 10, channel: 'task_only', purpose: 'final', useAgent: false }
      ];

      await addDoc(collection(db, "tenants", tenantId, "sequences"), {
        name: newName,
        isActive: true,
        steps: defaultSteps,
        rules: {
          cooldownDays: 3,
          maxEmailAttempts: 3,
          requireContactMethod: 'email_or_phone',
          respectDNC: true
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tenantId
      });
      
      toast({ title: "Sequência criada!", description: "Você pode editá-la agora." });
      setIsCreateOpen(false);
      setNewName("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao criar sequência" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    if (!db || !tenantId) return;
    try {
      await updateDoc(doc(db, "tenants", tenantId, "sequences", id), {
        isActive: !current,
        updatedAt: serverTimestamp()
      });
      toast({ title: `Sequência ${!current ? 'ativada' : 'pausada'}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !tenantId || !confirm("Remover esta sequência?")) return;
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "sequences", id));
      toast({ title: "Sequência removida" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao excluir" });
    }
  };

  const getStepIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageCircle className="w-3 h-3 text-green-500" />;
      case 'email': return <Mail className="w-3 h-3 text-blue-500" />;
      default: return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Sequências Assistidas</h1>
          <p className="text-muted-foreground">Cadências padronizadas para garantir o follow-up industrial.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Nova Sequência
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateSequence}>
              <DialogHeader>
                <DialogTitle>Criar Nova Sequência</DialogTitle>
                <DialogDescription>Dê um nome ao seu playbook comercial.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Sequência</Label>
                  <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Prospecção Cold Outbound" required />
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg border text-[10px] text-muted-foreground italic leading-relaxed">
                  <Bot className="w-3 h-3 mb-1 text-accent" /> Ao criar, geramos automaticamente 4 passos padrão: Dia 0 (WA), Dia 2 (Email), Dia 5 (Follow-up) e Dia 10 (Handoff).
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Criar Sequência
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-20 bg-card border rounded-xl border-dashed">
          <Layers className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
          <p className="text-muted-foreground">Nenhuma sequência configurada.</p>
          <Button variant="link" onClick={() => setIsCreateOpen(true)}>Crie sua primeira cadência comercial</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sequences.map((seq) => (
            <Card key={seq.id} className="relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${seq.isActive ? 'bg-accent' : 'bg-muted'}`}></div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant={seq.isActive ? "default" : "secondary"} className={seq.isActive ? "bg-accent" : ""}>
                    {seq.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(seq.id, seq.isActive)}>
                      {seq.isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-green-600" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(seq.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{seq.name}</CardTitle>
                <CardDescription className="text-xs">
                  {seq.steps.length} passos em {seq.steps[seq.steps.length-1].dayOffset} dias.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mt-2">
                  {seq.steps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary/20 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-muted-foreground w-8">D+{step.dayOffset}</span>
                        <div className="flex items-center gap-1.5 font-medium">
                          {getStepIcon(step.channel)}
                          <span className="capitalize">{step.channel.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.useAgent && <Badge variant="outline" className="text-[8px] h-4 bg-accent/5 text-accent border-accent/20">IA Agent</Badge>}
                        <span className="text-[9px] text-muted-foreground uppercase">{step.purpose}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <div className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> Controle humano obrigatório
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                    <Link href={`/sequences/${seq.id}`}>Editar Playbook</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
