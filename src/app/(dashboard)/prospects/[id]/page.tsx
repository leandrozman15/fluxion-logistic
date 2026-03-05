'use client';

import { useMemo, useState } from "react";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Globe, MapPin, Mail, Phone, ExternalLink, MessageSquare, History, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Prospect, ProspectStatus } from "@/app/lib/types";
import { useParams } from "next/navigation";

export default function ProspectDetailPage() {
  const { id } = useParams();
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const prospectRef = useMemo(() => {
    if (!db || !tenantId || !id) return null;
    return doc(db, "tenants", tenantId, "prospects", id as string);
  }, [db, tenantId, id]);

  const { data: prospect, loading } = useDoc<Prospect>(prospectRef);

  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!prospectRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(prospectRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Status atualizado", description: `O prospect agora está como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar o status." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClaimForToday = async () => {
    if (!db || !tenantId || !prospect || !user) return;
    
    setIsUpdating(true);
    const today = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, "tenants", tenantId, "dailyStats", today);
    const prospectRef = doc(db, "tenants", tenantId, "prospects", prospect.id);

    try {
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        let currentQuota = 0;
        let quotaLimit = 30;

        if (statsDoc.exists()) {
          currentQuota = statsDoc.data().quotaUsed || 0;
          quotaLimit = statsDoc.data().quotaLimit || 30;
        }

        if (currentQuota >= quotaLimit) {
          throw new Error("Quota diária atingida.");
        }

        // Marcar prospect como activado para hoy
        transaction.update(prospectRef, {
          isClaimedToday: true,
          claimedAt: new Date().toISOString(),
          status: 'contacted'
        });

        // Incrementar quota
        if (!statsDoc.exists()) {
          transaction.set(statsRef, {
            quotaUsed: 1,
            quotaLimit: 30,
            date: today,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(statsRef, {
            quotaUsed: currentQuota + 1
          });
        }
      });

      toast({ title: "Ativado!", description: "Este prospect foi adicionado ao seu radar de hoje." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao ativar", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Prospect não encontrado.</h2>
        <Button variant="link" asChild><Link href="/prospects">Voltar para a lista</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{prospect.companyName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{prospect.cnpj}</Badge>
              <Badge variant="default" className="bg-accent">Score: {prospect.effectiveScore}</Badge>
              {prospect.isClaimedToday && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> No Radar de Hoje
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!prospect.isClaimedToday && prospect.status !== 'client' && (
            <Button onClick={handleClaimForToday} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Ativar para Hoje
            </Button>
          )}
          <Button variant="outline" size="sm">Editar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visão Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    {prospect.websiteUrl ? (
                      <a href={prospect.websiteUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                        {prospect.domain || "Website"} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <span>Sem website</span>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{prospect.address?.city || "-"}, {prospect.address?.state || "-"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                   <h4 className="text-xs font-bold uppercase text-muted-foreground">Análise de IA (Score)</h4>
                   <ul className="space-y-1">
                     {prospect.scoreReasons?.length ? prospect.scoreReasons.map((reason, i) => (
                       <li key={i} className="text-sm flex items-start gap-2">
                         <Sparkles className="w-3 h-3 text-accent mt-1" />
                         {reason}
                       </li>
                     )) : (
                       <li className="text-sm text-muted-foreground italic">Score baseado na qualidade dos dados disponíveis.</li>
                     )}
                   </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="contacts">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Contatos ({prospect.contacts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Histórico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contacts" className="mt-6 space-y-4">
              {prospect.contacts?.map((contact, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">{contact.role}</div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email || "-"}</span>
                        <span className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone || "-"}</span>
                      </div>
                      {(contact.whatsapp || contact.phone) && (
                        <Button variant="outline" size="icon" className="text-green-600 border-green-200" asChild>
                          <a href={`https://wa.me/${(contact.whatsapp || contact.phone).replace(/\D/g, "")}`} target="_blank">
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="history" className="mt-6">
               <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div className="w-0.5 h-full bg-border"></div>
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-semibold">Atualizado em {new Date(prospect.updatedAt).toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">Status atual: {prospect.status}</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-border"></div>
                      <div className="w-0.5 h-full bg-border"></div>
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-semibold">Prospecto adicionado via {prospect.source}</div>
                      <div className="text-xs text-muted-foreground">{new Date(prospect.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status do Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-2">
                 <Button disabled={isUpdating} variant={prospect.status === 'new' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('new')}>Novo</Button>
                 <Button disabled={isUpdating} variant={prospect.status === 'contacted' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('contacted')}>Contactado</Button>
                 <Button disabled={isUpdating} variant={prospect.status === 'interested' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('interested')}>Interessado</Button>
                 <Button disabled={isUpdating} variant={prospect.status === 'demo' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('demo')}>Demo</Button>
                 <Button disabled={isUpdating} variant={prospect.status === 'client' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('client')}>Cliente</Button>
                 <Button disabled={isUpdating} variant={prospect.status === 'discarded' ? 'destructive' : 'outline'} size="sm" onClick={() => handleStatusChange('discarded')}>Descartado</Button>
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas de Negócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <Textarea placeholder="Adicione uma observação técnica ou comercial..." className="min-h-[120px]" defaultValue={prospect.notes} />
               <Button className="w-full" size="sm">Salvar Notas</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
