
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Target, Plus, Play, Pause, Clock, CheckCircle2, Loader2, MoreVertical, Trash2, Rocket, Zap, AlertCircle, MessageCircle, Mail } from "lucide-react";
import { Campaign, EmailTemplate, CampaignStatus, Prospect, OutboxMessage } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { generateWhatsAppMessage } from "@/ai/flows/generate-whatsapp-message-flow";

export default function CampaignsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecutingId, setIsExecutingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'whatsapp'>('email');

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
    if (!db || !tenantId || !newName) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "tenants", tenantId, "campaigns"), {
        name: newName,
        templateId: selectedTemplateId || "",
        channel: selectedChannel,
        status: "draft",
        sentCount: 0,
        failedCount: 0,
        createdAt: serverTimestamp(),
        tenantId
      });
      toast({ title: "Fluxo criado!", description: `Campanha de ${selectedChannel} pronta para rodar.` });
      setIsCreateOpen(false);
      setNewName("");
      setSelectedTemplateId("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao criar campanha" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCampaign = async (campaign: any) => {
    if (!db || !tenantId) return;
    setIsExecutingId(campaign.id);
    
    try {
      const channel = campaign.channel || 'email';
      
      // 1. Get Template (Only if email)
      let template: EmailTemplate | null = null;
      if (channel === 'email' && campaign.templateId) {
        const templateSnap = await getDoc(doc(db, "tenants", tenantId, "templates", campaign.templateId));
        if (templateSnap.exists()) template = templateSnap.data() as EmailTemplate;
      }

      // 2. Find target prospects (status 'new')
      const prospectsQuery = query(
        collection(db, "tenants", tenantId, "prospects"),
        where("status", "==", "new"),
        limit(20)
      );
      
      const pSnapshot = await getDocs(prospectsQuery);
      const candidates = pSnapshot.docs
        .map(d => ({ ...d.data(), id: d.id } as Prospect))
        .filter(p => {
          if (channel === 'email') return p.contacts?.some(c => !!c.email);
          return p.contacts?.some(c => !!c.phone || !!c.whatsapp);
        });

      if (candidates.length === 0) {
        toast({ title: "Sem novos alvos", description: `Não há prospects novos com ${channel === 'email' ? 'e-mail' : 'telefone'} cadastrado.` });
        setIsExecutingId(null);
        return;
      }

      toast({ title: "Iniciando IA", description: `Personalizando ${candidates.length} mensagens de ${channel}...` });

      // 3. Generate messages and add to outbox
      for (const prospect of candidates) {
        try {
          let subject = "";
          let body = "";

          if (channel === 'email' && template) {
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
            subject = aiResponse.subject;
            body = aiResponse.body;
          } else {
            // WhatsApp IA Generation
            const aiResponse = await generateWhatsAppMessage({
              templateBaseText: "Olá, gostaria de apresentar nossa solução industrial.",
              prospect: {
                companyName: prospect.companyName,
                city: prospect.address.city,
                state: prospect.address.state,
                industryTags: prospect.industryTags,
                contactName: prospect.contacts[0]?.name,
                contactRole: prospect.contacts[0]?.role
              }
            });
            body = aiResponse.message;
          }

          const outboxRef = doc(collection(db, "tenants", tenantId, "outbox"));
          await updateDoc(doc(db, "tenants", tenantId, "campaigns", campaign.id), { status: 'running' });
          
          await updateDoc(doc(db, "tenants", tenantId, "outbox", outboxRef.id), {
            id: outboxRef.id,
            tenantId,
            prospectId: prospect.id,
            companyName: prospect.companyName,
            campaignId: campaign.id,
            to: channel === 'email' 
              ? prospect.contacts.find(c => !!c.email)?.email 
              : prospect.contacts.find(c => !!c.phone || !!c.whatsapp)?.phone,
            subject: subject,
            body: body,
            state: 'queued',
            type: channel,
            attempts: 0,
            aiUsed: true,
            effectiveScore: prospect.effectiveScore,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          } as any);

          // Update prospect status
          await updateDoc(doc(db, "tenants", tenantId, "prospects", prospect.id), {
            status: 'contacted',
            lastContactAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

        } catch (err) {
          console.error(`Failed to generate ${channel} for ${prospect.companyName}`, err);
        }
      }

      toast({ title: "Fila Pronta", description: `As mensagens de ${channel} estão no Outbox.` });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro na execução", description: e.message });
    } finally {
      setIsExecutingId(null);
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500 animate-pulse">Ativa</Badge>;
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
          <p className="text-muted-foreground">Dispare comunicações inteligentes via E-mail ou WhatsApp.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Criar Fluxo IA
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateCampaign}>
              <DialogHeader>
                <DialogTitle>Nova Campanha Multicanal</DialogTitle>
                <DialogDescription>Defina o canal e a IA cuidará da personalização industrial.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>Canal de Abordagem</Label>
                  <RadioGroup value={selectedChannel} onValueChange={(v: any) => setSelectedChannel(v)} className="grid grid-cols-2 gap-4">
                    <div>
                      <RadioGroupItem value="email" id="c-email" className="peer sr-only" />
                      <Label htmlFor="c-email" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                        <Mail className="mb-2 h-6 w-6" />
                        <span className="text-xs font-bold uppercase">E-mail SMTP</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="whatsapp" id="c-wa" className="peer sr-only" />
                      <Label htmlFor="c-wa" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                        <MessageCircle className="mb-2 h-6 w-6" />
                        <span className="text-xs font-bold uppercase">WhatsApp Web</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha</Label>
                  <Input id="name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Prospecção Metalúrgicas Sul" required />
                </div>

                {selectedChannel === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Modelo Base (Template)</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                      <SelectContent>
                        {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign: any) => (
            <Card key={campaign.id} className="relative overflow-hidden group border-accent/10">
              <div className={`absolute top-0 left-0 w-1.5 h-full ${
                campaign.status === 'running' ? 'bg-blue-500' : 
                campaign.status === 'finished' ? 'bg-green-500' : 'bg-muted'
              }`}></div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-2">
                    {getStatusBadge(campaign.status)}
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {campaign.channel === 'whatsapp' ? <MessageCircle className="w-3 h-3 mr-1 inline" /> : <Mail className="w-3 h-3 mr-1 inline" />}
                      {campaign.channel || 'email'}
                    </Badge>
                  </div>
                  {campaign.status === 'draft' && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 text-blue-600 font-bold"
                      onClick={() => handleRunCampaign(campaign)}
                      disabled={isExecutingId === campaign.id}
                    >
                      {isExecutingId === campaign.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Rocket className="w-3 h-3 mr-1" />}
                      Rodar
                    </Button>
                  )}
                </div>
                <CardTitle className="text-lg mt-2">{campaign.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs uppercase tracking-tighter font-bold text-muted-foreground">
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
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Fila</div>
                    <div className="text-xl font-bold text-accent">IA Ativa</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
