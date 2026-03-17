
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDocs, 
  where, 
  limit,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Play, Pause, Clock, CheckCircle2, Loader2, MoreVertical, Trash2, Rocket, Zap, AlertCircle } from "lucide-react";
import { Campaign, EmailTemplate, CampaignStatus, Prospect, OutboxMessage } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";

export default function CampaignsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecutingId, setIsExecutingId] = useState<string | null>(null);
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
      toast({ title: "Campanha criada!", description: "Você pode iniciá-la para gerar os e-mails." });
      setIsCreateOpen(false);
      setNewName("");
      setSelectedTemplateId("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao criar campanha" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCampaign = async (campaign: Campaign) => {
    if (!db || !tenantId) return;
    setIsExecutingId(campaign.id);
    
    try {
      // 1. Get Template
      const templateSnap = await getDoc(doc(db, "tenants", tenantId, "templates", campaign.templateId));
      if (!templateSnap.exists()) throw new Error("Template não encontrado.");
      const template = templateSnap.data() as EmailTemplate;

      // 2. Find target prospects (status 'new' and have email)
      const prospectsQuery = query(
        collection(db, "tenants", tenantId, "prospects"),
        where("status", "==", "new"),
        limit(20) // Batch size for safety
      );
      
      const pSnapshot = await getDocs(prospectsQuery);
      const candidates = pSnapshot.docs
        .map(d => ({ ...d.data(), id: d.id } as Prospect))
        .filter(p => p.contacts?.some(c => !!c.email));

      if (candidates.length === 0) {
        toast({ title: "Sem novos alvos", description: "Não há prospects novos com e-mail cadastrado." });
        setIsExecutingId(null);
        return;
      }

      toast({ title: "Iniciando Automação", description: `Gerando ${candidates.length} e-mails personalizados com IA...` });

      // 3. Generate messages and add to outbox
      for (const prospect of candidates) {
        try {
          // AI Personalization
          const aiResponse = await generateEmailDraft({
            templateSubject: template.subject,
            templateBody: template.body,
            prospect: {
              companyName: prospect.companyName,
              city: prospect.address.city,
              state: prospect.address.state,
              industryTags: prospect.industryTags,
              websiteUrl: prospect.websiteUrl,
              effectiveScore: prospect.effectiveScore,
              contactName: prospect.contacts[0]?.name,
              contactRole: prospect.contacts[0]?.role
            }
          });

          const outboxRef = doc(collection(db, "tenants", tenantId, "outbox"));
          await updateDoc(doc(db, "tenants", tenantId, "campaigns", campaign.id), { status: 'running' });
          
          await updateDoc(doc(db, "tenants", tenantId, "outbox", outboxRef.id), {
            id: outboxRef.id,
            tenantId,
            prospectId: prospect.id,
            companyName: prospect.companyName,
            campaignId: campaign.id,
            to: prospect.contacts.find(c => !!c.email)?.email,
            subject: aiResponse.subject,
            body: aiResponse.body,
            state: 'queued',
            type: 'email',
            attempts: 0,
            aiUsed: true,
            effectiveScore: prospect.effectiveScore,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          } as any);

          // Update prospect status to contacted
          await updateDoc(doc(db, "tenants", tenantId, "prospects", prospect.id), {
            status: 'contacted',
            lastContactAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

        } catch (err) {
          console.error(`Failed to generate email for ${prospect.companyName}`, err);
        }
      }

      toast({ title: "Fila de Disparo Pronta", description: "As mensagens foram movidas para o Outbox para envio automático." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro na execução", description: e.message });
    } finally {
      setIsExecutingId(null);
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500 animate-pulse">Em Execução</Badge>;
      case 'finished': return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Finalizada</Badge>;
      case 'paused': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Pausada</Badge>;
      default: return <Badge variant="secondary">Rascunho</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Automação de Campanhas</h1>
          <p className="text-muted-foreground">Dispare comunicações inteligentes baseadas no perfil industrial.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Criar Fluxo de Disparo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateCampaign}>
              <DialogHeader>
                <DialogTitle>Nova Campanha Industrial</DialogTitle>
                <DialogDescription>A IA personalizará cada e-mail com base no template escolhido.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha</Label>
                  <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Prospecção Metalúrgicas Sul" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Modelo Base (Template)</Label>
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
                  Confirmar e Criar
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
          <p className="text-muted-foreground">Nenhuma campanha configurada.</p>
          <Button variant="link" onClick={() => setIsCreateOpen(true)}>Inicie sua primeira automação</Button>
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
                  <div className="flex gap-1">
                    {campaign.status === 'draft' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-blue-600 font-bold"
                        onClick={() => handleRunCampaign(campaign)}
                        disabled={isExecutingId === campaign.id}
                      >
                        {isExecutingId === campaign.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Rocket className="w-3 h-3 mr-1" />}
                        Rodar IA
                      </Button>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{campaign.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3" /> 
                  {campaign.createdAt?.toDate ? format(campaign.createdAt.toDate(), "dd 'de' MMM", { locale: ptBR }) : "Recém criada"}
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
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Zap className="w-3 h-3 text-accent" /> Automação de IA Ativa
                  </div>
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
