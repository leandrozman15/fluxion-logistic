
'use client';

import { useMemo } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Users, 
  Mail, 
  Target, 
  TrendingUp, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Loader2,
  PieChart,
  BarChart3,
  Factory
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent, 
  ChartLegend, 
  ChartLegendContent 
} from "@/components/ui/chart";
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Pie,
  PieChart as RechartsPieChart
} from "recharts";
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

  // Top Prospects (Radar Sugerido)
  const topProspectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "prospects"),
      where("status", "==", "new"),
      orderBy("effectiveScore", "desc"),
      limit(10)
    );
  }, [db, tenantId]);

  const { data: topProspects, loading: prospectsLoading } = useCollection<Prospect>(topProspectsQuery);

  // Datos para gráfico de distribución por industria
  const industryStatsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"), limit(100));
  }, [db, tenantId]);

  const { data: allProspects } = useCollection<Prospect>(industryStatsQuery);

  const industryData = useMemo(() => {
    const counts: Record<string, number> = {};
    allProspects.forEach(p => {
      p.industryTags?.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [allProspects]);

  const dailyQuotaUsed = stats?.quotaUsed || 0;
  const dailyQuotaLimit = stats?.quotaLimit || 30;
  const quotaProgress = (dailyQuotaUsed / dailyQuotaLimit) * 100;

  const kpis = [
    { title: "Ativados Hoje", value: `${dailyQuotaUsed}/${dailyQuotaLimit}`, icon: Target, description: "Progresso da meta diária" },
    { title: "Base Total", value: allProspects.length, icon: Users, description: "Empresas cadastradas" },
    { title: "Emails na Fila", value: stats?.emailsSent || 0, icon: Mail, description: "Comunicações disparadas" },
    { title: "Potencial IA", value: "84%", icon: Sparkles, description: "Qualidade média da base" },
  ];

  const chartConfig = {
    value: { label: "Empresas", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Radar do Dia</h1>
          <p className="text-muted-foreground">Foco nas mejores oportunidades industriales.</p>
        </div>
        <Card className="w-full md:w-80 bg-accent/5 border-accent/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="font-semibold text-accent flex items-center gap-1">
                <Target className="w-3 h-3" /> Progresso da Quota
              </span>
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
        {/* Sugeridos - Prioridad Operativa */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> Sugestões de Hoje
              </CardTitle>
              <CardDescription>Top 10 empresas com maior Score Efetivo para ativação.</CardDescription>
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
                  <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
                    <Factory className="w-10 h-10 mx-auto opacity-10" />
                    <p>Sem sugestões novas. Importe mais prospects para o Radar.</p>
                  </div>
                ) : (
                  topProspects?.map((item, i) => (
                    <Link key={item.id} href={`/prospects/${item.id}`}>
                      <div className="flex items-center justify-between p-4 mb-3 rounded-xl bg-secondary/20 border hover:border-accent/50 transition-all group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                            #{i + 1}
                          </div>
                          <div>
                            <div className="font-bold text-sm line-clamp-1">{item.companyName}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                              {item.industryTags?.[0] || "Indústria Geral"} • <MapPin className="w-2.5 h-2.5" /> {item.address?.city || "Brasil"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge className={item.effectiveScore > 80 ? "bg-accent" : "bg-primary"}>
                            Score: {item.effectiveScore}
                          </Badge>
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

        {/* Analytics Lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" /> Mix de Indústrias
              </CardTitle>
              <CardDescription className="text-[10px]">Distribuição detectada pela IA.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                {industryData.length > 0 ? (
                  <ChartContainer config={chartConfig}>
                    <BarChart data={industryData} layout="vertical" margin={{ left: -20, right: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                    Dados insuficientes
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Performance Operativa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase opacity-70">Conversão New -> Contacted</div>
                <div className="text-xl font-bold">24.5%</div>
                <Progress value={24} className="h-1 bg-white/20" />
              </div>
              <Button variant="secondary" size="sm" className="w-full text-xs" asChild>
                <Link href="/outbox">Ver Outbox Completo</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
