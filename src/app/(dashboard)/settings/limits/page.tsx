
'use client';

import { useMemo } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, limit, doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, ShieldCheck, Loader2 } from "lucide-react";
import { DailyStats, Tenant } from "@/app/lib/types";

export default function LimitsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const statsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "dailyStats"), limit(31));
  }, [db, tenantId]);

  const { data: stats, loading } = useCollection<DailyStats>(statsQuery);

  const monthlyConsumption = useMemo(() => {
    if (!stats) return { emails: 0, quota: 0 };
    return stats.reduce((acc, s) => ({
      emails: acc.emails + (s.emailsSent || 0),
      quota: acc.quota + (s.quotaUsed || 0)
    }), { emails: 0, quota: 0 });
  }, [stats]);

  const dailyLimit = tenant?.settings?.dailyEmailLimit || 200;
  const hourlyLimit = tenant?.settings?.hourlyEmailLimit || 20;

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Limites e Consumo</h1>
        <p className="text-muted-foreground">Acompanhe o uso dos recursos do seu plano em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" /> Limite de Emails Diários
            </CardTitle>
            <CardDescription>Configurado nas definições da organização.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Hoje: {stats?.[0]?.emailsSent || 0}</span>
              <span className="text-muted-foreground">Limite: {dailyLimit}</span>
            </div>
            <Progress value={((stats?.[0]?.emailsSent || 0) / dailyLimit) * 100} className="h-2" />
            <div className="pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Sua conta está operando dentro dos limites de segurança.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" /> Limite de Emails por Hora
            </CardTitle>
            <CardDescription>Controle de cadência para evitar SPAM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Máximo Recomendado</span>
              <span className="text-muted-foreground">{hourlyLimit} msg/h</span>
            </div>
            <Progress value={30} className="h-2" />
            <p className="text-xs text-muted-foreground">Este limite ajuda a manter a reputación do seu domínio alta.</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
             <div className="flex justify-between items-start">
               <div>
                 <CardTitle>Plano Atual: {tenant?.plan === 'pro' ? 'Industrial PRO' : 'Gratuito'}</CardTitle>
                 <CardDescription>Consumo acumulado do mês atual.</CardDescription>
               </div>
               <Badge className="bg-green-600">ATIVO</Badge>
             </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
               <div className="p-4 rounded-lg bg-secondary/50 border">
                 <div className="text-xs text-muted-foreground mb-1">Emails este mês</div>
                 <div className="text-lg font-bold">{monthlyConsumption.emails}</div>
                 <div className="text-xs text-muted-foreground">Total de comunicações</div>
               </div>
               <div className="p-4 rounded-lg bg-secondary/50 border">
                 <div className="text-xs text-muted-foreground mb-1">Prospects Ativados</div>
                 <div className="text-lg font-bold">{monthlyConsumption.quota}</div>
                 <div className="text-xs text-muted-foreground">Quota de Radar utilizada</div>
               </div>
               <div className="p-4 rounded-lg bg-secondary/50 border">
                 <div className="text-xs text-muted-foreground mb-1">Status do Plano</div>
                 <div className="text-lg font-bold">Ok</div>
                 <div className="text-xs text-accent font-semibold cursor-pointer">Ver Faturas</div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
