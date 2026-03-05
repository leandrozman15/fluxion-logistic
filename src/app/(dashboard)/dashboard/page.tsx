'use client';

import { useMemo } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Users, Mail, Target, TrendingUp, Sparkles, CheckCircle2, Clock, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Prospect } from "@/app/lib/types";

export default function DashboardPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const today = new Date().toISOString().split('T')[0];

  // Stats y Quota
  const statsRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId, "dailyStats", today);
  }, [db, tenantId, today]);

  const { data: stats, loading: statsLoading } = useDoc<any>(statsRef);

  // Top Prospects (Candidatos)
  const topProspectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "prospects"),
      where("status", "==", "new"),
      orderBy("effectiveScore", "desc"),
      limit(30)
    );
  }, [db, tenantId]);

  const { data: topProspects, loading: prospectsLoading } = useCollection<Prospect>(topProspectsQuery);

  const dailyQuotaUsed = stats?.quotaUsed || 0;
  const dailyQuotaLimit = stats?.quotaLimit || 30;
  const quotaProgress = (dailyQuotaUsed / dailyQuotaLimit) * 100;

  const kpis = [
    { title: "Quota do Dia", value: `${dailyQuotaUsed}/${dailyQuotaLimit}`, icon: Target, description: "Prospects ativados hoje" },
    { title: "Novos Prospects", value: topProspects?.length || 0, icon: Users, description: "Disponíveis para hoje" },
    { title: "Contactados", value: stats?.emailsSent || 0, icon: Mail, description: "Ações realizadas" },
    { title: "Taxa de Sucesso", value: "18%", icon: TrendingUp, description: "Média do setor" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Radar do Dia</h1>
          <p className="text-muted-foreground">Foco nas mejores oportunidades para hoje.</p>
        </div>
        <Card className="w-full md:w-72 bg-accent/5 border-accent/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-semibold text-accent">Progresso da Quota</span>
              <span>{dailyQuotaUsed}/{dailyQuotaLimit}</span>
            </div>
            <Progress value={quotaProgress} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> Sugestões de Hoje
              </CardTitle>
              <CardDescription>Empresas com maior potencial detectado pela IA.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/prospects">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {prospectsLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {topProspects?.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground text-sm">Sem sugestões novas. Importe mais prospects!</p>
                ) : (
                  topProspects?.map((item, i) => (
                    <Link key={item.id} href={`/prospects/${item.id}`}>
                      <div className="flex items-center justify-between p-4 mb-3 rounded-xl bg-secondary/20 border hover:border-accent/50 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                            #{i + 1}
                          </div>
                          <div>
                            <div className="font-bold text-sm">{item.companyName}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.industryTags?.[0] || "Indústria Geral"} • {item.address?.city || "Brasil"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-accent font-mono">Score: {item.effectiveScore}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Operação</CardTitle>
            <CardDescription>Fluxo de trabalho diário.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 space-y-2">
              <h4 className="text-xs font-bold text-blue-800 uppercase">Dica do Radar</h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                Priorize empresas com score acima de 80. Elas têm 3x mais probabilidade de agendamento de demo.
              </p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 text-sm">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div>
                 <span>{dailyQuotaUsed} Prospects ativados hoje</span>
               </div>
               <div className="flex items-center gap-3 text-sm">
                 <div className="w-2 h-2 rounded-full bg-muted"></div>
                 <span className="text-muted-foreground">Meta: {dailyQuotaLimit} ativações</span>
               </div>
            </div>

            <Button className="w-full bg-primary" asChild>
              <Link href="/prospects">Ir para Prospects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
