'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Play, Pause, Clock, CheckCircle2, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { Campaign, EmailTemplate, CampaignStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CampaignsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const campaignsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "campaigns"), orderBy("createdAt", "desc"));
  }, [db, tenantId]);

  const { data: campaigns, loading } = useCollection<Campaign>(campaignsQuery);

  const templatesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "templates"), orderBy("name"));
  }, [db, tenantId]);

  const { data: templates } = useCollection<EmailTemplate>(templatesQuery);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !tenantId || !newName || !selectedTemplateId) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "tenants", tenantId, "campaigns"), {
        name: newName,
        templateId: selectedTemplateId,
        status: "draft",
        sentCount: 0,
        failedCount: 0,
        createdAt: serverTimestamp(),
        tenantId
      });
      toast({ title: "Campanha criada!", description: "Você pode configurá-la agora." });
      setIsCreateOpen(false);
      setNewName("");
      setSelectedTemplateId("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao criar campanha" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: CampaignStatus) => {
    if (!db || !tenantId) return;
    try {
      await updateDoc(doc(db, "tenants", tenantId, "campaigns", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'finished' ? { finishedAt: new Date().toISOString() } : {})
      });
      toast({ title: `Campanha ${newStatus === 'running' ? 'iniciada' : newStatus}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao atualizar status" });
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500">Ativa</Badge>;
      case 'finished': return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Finalizada</Badge>;
      case 'paused': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Pausada</Badge>;
      default: return <Badge variant="secondary">Rascunho</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Campanhas</h1>
          <p className="text-muted-foreground">Dispare comunicações em massa para seus prospects filtrados.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateCampaign}>
              <DialogHeader>
                <DialogTitle>Criar Nova Campanha</DialogTitle>
                <DialogDescription>Defina o nome e o modelo base de comunicação.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha</Label>
                  <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Prospecção Metalúrgicas Sul" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Template de E-mail</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} required>
                    <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Criar Campanha
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 bg-card border rounded-xl border-dashed">
          <Target className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
          <p className="text-muted-foreground">Nenhuma campanha encontrada.</p>
          <Button variant="link" onClick={() => setIsCreateOpen(true)}>Comece criando sua primeira campanha</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${
                campaign.status === 'running' ? 'bg-blue-500' : 
                campaign.status === 'finished' ? 'bg-green-500' :
                campaign.status === 'paused' ? 'bg-orange-500' : 'bg-muted'
              }`}></div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  {getStatusBadge(campaign.status)}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {campaign.status === 'running' ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateStatus(campaign.id, 'paused')}>
                        <Pause className="w-3 h-3" />
                      </Button>
                    ) : (campaign.status === 'paused' || campaign.status === 'draft') ? (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => handleUpdateStatus(campaign.id, 'running')}>
                        <Play className="w-3 h-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{campaign.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3" /> 
                  {campaign.createdAt?.toDate ? format(campaign.createdAt.toDate(), "dd 'de' MMM", { locale: ptBR }) : "Recentemente"}
                  {campaign.status === 'finished' && campaign.finishedAt && ` • Concluída em ${format(new Date(campaign.finishedAt), "dd/MM")}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Enviados</div>
                    <div className="text-xl font-bold">{campaign.sentCount || 0}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Falhas</div>
                    <div className="text-xl font-bold text-destructive">{campaign.failedCount || 0}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <Button variant="link" className="p-0 h-auto text-xs font-semibold text-primary">Ver Relatório</Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"><MoreVertical className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
