'use client';

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Target, Plus, Clock,
  Loader2, MoreVertical, Trash2, Rocket,
  MessageCircle, Mail, ExternalLink,
  BarChart3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEmailDraft } from "@/ai/flows/generate-email-draft-flow";
import { generateWhatsAppMessage } from "@/ai/flows/generate-whatsapp-message-flow";
import Link from "next/link";
import { CampaignPayload, createCampaign, deleteCampaign, listCampaigns, updateCampaign } from "@/lib/campaigns-api";
import { EmailTemplatePayload, getTemplate, listTemplates } from "@/lib/templates-api";
import { createOutboxMessage } from "@/lib/outbox-api";
import { listProspects, updateProspect } from "@/lib/prospects-api";

function formatCreatedAt(value: any) {
  if (value?.toDate) return format(value.toDate(), "dd 'de' MMM", { locale: ptBR });
  if (!value) return "Recem criada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recem criada";
  return format(date, "dd 'de' MMM", { locale: ptBR });
}

export default function CampaignsPage() {
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<CampaignPayload[]>([]);
  const [templates, setTemplates] = useState<EmailTemplatePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExecutingId, setIsExecutingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'whatsapp'>('email');

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        if (active) setLoading(true);
        const [campaignRows, templateRows] = await Promise.all([listCampaigns(), listTemplates()]);
        if (!active) return;
        setCampaigns(campaignRows);
        setTemplates(templateRows);
      } catch (error) {
        if (!active) return;
        setCampaigns([]);
        setTemplates([]);
        toast({ variant: "destructive", title: "Erro ao carregar campanhas", description: (error as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [toast]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    setIsSubmitting(true);
    try {
      const created = await createCampaign({
        name: newName,
        templateId: selectedTemplateId || "",
        channel: selectedChannel,
        status: "draft",
        sentCount: 0,
        failedCount: 0,
        targetCount: 20,
      });
      setCampaigns((prev) => [created, ...prev]);
      toast({ title: "Fluxo criado!", description: `Campanha de ${selectedChannel} pronta para rodar.` });
      setIsCreateOpen(false);
      setNewName("");
      setSelectedTemplateId("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao criar campanha", description: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCampaign = async (campaign: CampaignPayload) => {
    setIsExecutingId(campaign.id);

    try {
      const channel = campaign.channel || 'email';
      let template: EmailTemplatePayload | null = null;

      if (channel === 'email' && campaign.templateId) {
        template = await getTemplate(campaign.templateId);
      }

      const allProspects = await listProspects(2000);
      const candidates = allProspects
        .filter((p) => p.status === 'new')
        .filter((p) => {
          if (channel === 'email') return p.contacts?.some((c: any) => !!c.email);
          return p.contacts?.some((c: any) => !!c.phone || !!c.whatsapp);
        })
        .slice(0, campaign.targetCount || 20);

      if (candidates.length === 0) {
        toast({ title: "Sem novos alvos", description: `Nao ha prospects 'Novos' com ${channel === 'email' ? 'e-mail' : 'telefone'} cadastrado.` });
        setIsExecutingId(null);
        return;
      }

      toast({ title: "IA em Acao", description: `Personalizando ${candidates.length} mensagens...` });

      for (const prospect of candidates) {
        try {
          let subject = "";
          let body = "";

          const prospectDataForAi = {
            companyName: prospect.companyName || "Empresa",
            city: prospect.address?.city || "N/A",
            state: prospect.address?.state || "N/A",
            industryTags: prospect.industryTags || [],
            websiteUrl: (prospect as any).websiteUrl || "",
            effectiveScore: prospect.effectiveScore || 0,
            contactName: (prospect.contacts as any)?.[0]?.name || "Responsavel",
            contactRole: (prospect.contacts as any)?.[0]?.role || "N/A",
          };

          if (channel === 'email' && template) {
            const aiResponse = await generateEmailDraft({
              templateSubject: template.subject,
              templateBody: template.body,
              prospect: prospectDataForAi,
            });
            subject = aiResponse.subject;
            body = aiResponse.body;
          } else {
            const aiResponse = await generateWhatsAppMessage({
              templateBaseText: "Ola, gostaria de apresentar nossa solucao industrial.",
              prospect: prospectDataForAi,
            });
            body = aiResponse.message;
          }

          await createOutboxMessage({
            prospectId: prospect.id,
            companyName: prospect.companyName,
            campaignId: campaign.id,
            to: channel === 'email'
              ? (prospect.contacts as any)?.find((c: any) => !!c.email)?.email
              : (prospect.contacts as any)?.find((c: any) => !!c.phone || !!c.whatsapp)?.phone,
            subject,
            body,
            state: 'queued',
            type: channel,
            attempts: 0,
            aiUsed: true,
            effectiveScore: prospect.effectiveScore || 0,
          } as any);

          await updateProspect(prospect.id, {
            status: 'contacted' as any,
            updatedAt: new Date().toISOString(),
          } as any);
        } catch {
          // Continue processing remaining candidates.
        }
      }

      const updated = await updateCampaign(campaign.id, {
        status: 'running',
        targetCount: candidates.length,
      });
      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

      toast({ title: "Fila pronta!", description: "As mensagens estao no Outbox aguardando disparo." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na execucao", description: error.message });
    } finally {
      setIsExecutingId(null);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Deseja remover esta campanha?")) return;
    try {
      await deleteCampaign(id);
      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== id));
      toast({ title: "Campanha removida" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: (error as Error).message });
    }
  };

  const getStatusBadge = (status: string | undefined) => {
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
          <h1 className="text-2xl font-bold text-primary">Automacao de Campanhas</h1>
          <p className="text-muted-foreground">Dispare comunicacoes inteligentes em massa via E-mail ou WhatsApp.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-2" /> Nova Campanha IA
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateCampaign}>
              <DialogHeader>
                <DialogTitle>Nova Campanha Multicanal</DialogTitle>
                <DialogDescription>A IA cuidara da personalizacao baseada no seu template.</DialogDescription>
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
                  <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Prospeccao Metalurgicas Sul" required />
                </div>

                {selectedChannel === 'email' && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Modelo Base (Template)</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um modelo" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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
      ) : campaigns.length === 0 ? (
        <div className="text-center py-32 border-2 border-dashed rounded-2xl space-y-4">
          <Target className="w-12 h-12 mx-auto text-muted-foreground opacity-20" />
          <div className="space-y-1">
            <p className="font-bold text-primary">Nenhuma campanha ativa</p>
            <p className="text-xs text-muted-foreground">Crie uma campanha para automatizar sua prospeccao com IA.</p>
          </div>
          <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Criar Minha Primeira Campanha</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => {
            const progress = campaign.targetCount ? ((campaign.sentCount || 0) / campaign.targetCount) * 100 : 0;

            return (
              <Card key={campaign.id} className="relative overflow-hidden group border-accent/10 shadow-sm hover:shadow-md transition-all">
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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCampaign(campaign.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-lg mt-2 truncate">{campaign.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatCreatedAt(campaign.createdAt)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Sucesso</div>
                      <div className="text-xl font-bold text-primary">{campaign.sentCount || 0}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Alvos</div>
                      <div className="text-xl font-bold">{campaign.targetCount || 0}</div>
                    </div>
                  </div>

                  {campaign.status !== 'draft' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                        <span>PROGRESSO</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 border-t flex gap-2">
                  {campaign.status === 'draft' ? (
                    <Button
                      className="w-full bg-primary font-bold text-xs"
                      onClick={() => handleRunCampaign(campaign)}
                      disabled={isExecutingId === campaign.id}
                    >
                      {isExecutingId === campaign.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Rocket className="w-3 h-3 mr-2" />}
                      Rodar IA e Gerar Fila
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" className="flex-1 text-xs font-bold" asChild>
                        <Link href="/outbox">
                          <ExternalLink className="w-3 h-3 mr-2" /> Ver Fila
                        </Link>
                      </Button>
                      <Button className="flex-1 bg-accent hover:bg-accent/90 text-xs font-bold" asChild>
                        <Link href="/analytics">
                          <BarChart3 className="w-3 h-3 mr-2" /> Relatorio
                        </Link>
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
