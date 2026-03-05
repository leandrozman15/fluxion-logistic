
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit, doc, setDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Users, 
  Mail, 
  Target, 
  Sparkles, 
  ChevronRight, 
  Loader2,
  PieChart,
  BarChart3,
  Factory,
  MapPin,
  RefreshCw,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent
} from "@/components/ui/chart";
import { 
  Bar, 
  BarChart, 
  XAxis, 
  YAxis, 
  Tooltip
} from "recharts";
import Link from "next/link";
import { Prospect, DailyTop } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];

  // Stats y Quota
  const statsRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId, "dailyStats", today);
  }, [db, tenantId, today]);

  const { data: stats } = useDoc<any>(statsRef);

  // Daily Top (Radar Congelado)
  const dailyTopRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId, "dailyTop", today);
  }, [db, tenantId, today]);

  const { data: dailyTop, loading: dailyTopLoading } = useDoc<DailyTop>(dailyTopRef);

  // Datos para gráficos (Mix de Industrias) - Muestreo de los últimos 100
  const industryStatsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"), limit(100));
  }, [db, tenantId]);

  const { data: allProspects } = useCollection<Prospect>(industryStatsQuery);

  const industryData = useMemo(() => {
    const counts: Record<string, number> = {};
    (allProspects || []).forEach(p => {
      p.industryTags?.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [allProspects]);

  const handleGenerateDailyRadar = async () => {
    if (!db || !tenantId) return;
    setIsGenerating(true);
    try {
      // 1. Buscar mejores prospectos (No descartados, no clientes)
      const q = query(
        collection(db, "tenants", tenantId, "prospects"),
        where("status", "in", ["new", "contacted"]),
        orderBy("effectiveScore", "desc"),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const candidates = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Prospect));
      
      // 2. Filtrar y seleccionar top 30 (priorizando accionabilidad)
      const top30 = candidates
        .filter(p => !p.isClaimedToday)
        .sort((a, b) => b.effectiveScore - a.effectiveScore)
        .slice(0, 30);

      if (top30.length === 0) {
        toast({ title: "Radar vazio", description: "Não há novos prospectos para gerar o radar hoje." });
        return;
      }

      // 3. Guardar dailyTop
      const dailyTopData: DailyTop = {
        id: today,
        date: today,
        limit: 30,
        generatedAt: new Date().toISOString(),
        items: top30.map(p => ({
          prospectId: p.id,
          companyName: p.companyName,
          effectiveScore: p.effectiveScore,
          hasEmail: p.contacts?.some(c => !!c.email) || false,
          hasPhone: p.contacts?.some(c => !!c.phone || !!c.whatsapp) || false,
          hasWebsite: !!p.websiteUrl,
          reasons: p.aiScoreReasons || p.scoreReasons || []
        }))
      };

      await setDoc(doc(db, "tenants", tenantId, "dailyTop", today), dailyTopData);
      
      toast({ title: "Radar gerado!", description: `As melhores ${top30.length} oportunidades estão prontas.` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro ao gerar radar", description: "Verifique suas permissões de rede." });
    } finally {
      setIsGenerating(false);
    }
  };

  const dailyQuotaUsed = stats?.quotaUsed || 0;
  const dailyQuotaLimit = stats?.quotaLimit || 30;
  const quotaProgress = (dailyQuotaUsed / dailyQuotaLimit) * 100;

  const kpis = [
    { title: "Ativados Hoje", value: `${dailyQuotaUsed}/${dailyQuotaLimit}`, icon: Target, description: "Progresso da meta diária" },
    { title: "Base Total", value: allProspects?.length || 0, icon: Users, description: "Empresas cadastradas" },
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
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
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
                <Zap className="w-5 h-5 text-accent" /> Sugestões de Hoje
              </CardTitle>
              <CardDescription>
                {dailyTop ? `Top ${dailyTop.items.length} oportunidades congeladas para hoje.` : 'O radar ainda no foi gerado para este dia.'}
              </CardDescription>
            </div>
            {!dailyTop && !dailyTopLoading && (
              <Button onClick={handleGenerateDailyRadar} disabled={isGenerating} size="sm" className="bg-accent hover:bg-accent/90">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Gerar Radar
              </Button>
            )}
            {dailyTop && (
              <Button variant="outline" size="sm" onClick={handleGenerateDailyRadar} disabled={isGenerating}>
                 {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {dailyTopLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-3">
                {!dailyTop ? (
                  <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-4">
                    <Factory className="w-12 h-12 mx-auto opacity-10" />
                    <div className="max-w-xs mx-auto">
                      <p className="text-sm font-semibold">Radar pronto para ser gerado</p>
                      <p className="text-xs text-muted-foreground mt-1">O sistema selecionará as melhores 30 empresas para você focar hoje.</p>
                    </div>
                    <Button onClick={handleGenerateDailyRadar} disabled={isGenerating}>
                      Começar o dia agora
                    </Button>
                  </div>
                ) : (
                  dailyTop.items.map((item, i) => (
                    <Link key={item.prospectId} href={`/prospects/${item.prospectId}`}>
                      <div className="flex items-center justify-between p-4 mb-3 rounded-xl bg-secondary/20 border hover:border-accent/50 transition-all group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                            #{i + 1}
                          </div>
                          <div>
                            <div className="font-bold text-sm line-clamp-1">{item.companyName}</div>
                            <div className="flex items-center gap-2 mt-1">
                               <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background">Score: {item.effectiveScore}</Badge>
                               <div className="flex gap-1">
                                 {item.hasEmail && <Mail className="w-3 h-3 text-green-600" />}
                                 {item.hasPhone && <Zap className="w-3 h-3 text-orange-600" />}
                                 {item.hasWebsite && <MapPin className="w-3 h-3 text-blue-600" />}
                               </div>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
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
                <div className="text-[10px] uppercase opacity-70">Conversão New {'->'} Contacted</div>
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
