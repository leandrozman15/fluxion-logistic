
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit, doc, getDocs, serverTimestamp, runTransaction, writeBatch } from "firebase/firestore";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Users, 
  Mail, 
  Target, 
  Sparkles, 
  ChevronRight, 
  Loader2,
  PieChart,
  Factory,
  RefreshCw,
  Zap,
  CheckCircle2,
  Lightbulb,
  Rocket,
  Activity,
  MessageCircle,
  Globe,
  TrendingUp,
  Search,
  Play
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  ChartContainer, 
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
import { Prospect, DailyTop, Tenant, DailyStats, SegmentStats } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { getSegmentKey } from "@/lib/utils/learning-loop";

export default function DashboardPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  
  const today = new Date().toISOString().split('T')[0];

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenantData } = useDoc<Tenant>(tenantRef);

  const statsRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId, "dailyStats", today);
  }, [db, tenantId, today]);

  const { data: stats } = useDoc<DailyStats>(statsRef);

  const dailyTopRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId, "dailyTop", today);
  }, [db, tenantId, today]);

  const { data: dailyTop, loading: dailyTopLoading } = useDoc<DailyTop>(dailyTopRef);

  const segmentStatsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "segmentStats"));
  }, [db, tenantId]);

  const { data: allSegments } = useCollection<SegmentStats>(segmentStatsQuery);

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
      const topLimit = 30;

      let q = query(
        collection(db, "tenants", tenantId, "prospects"),
        where("status", "in", ["new", "contacted"]),
        orderBy("effectiveScore", "desc"),
        limit(200)
      );
      
      const snapshot = await getDocs(q);
      let candidates = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Prospect));
      
      const topN = candidates.slice(0, topLimit);

      if (topN.length === 0) {
        toast({ title: "Radar vazio", description: "Clique em 'Simular Dados' para ver o radar em ação." });
        return;
      }

      const avgScore = topN.reduce((acc, p) => acc + p.effectiveScore, 0) / topN.length;

      const dailyTopData: DailyTop = {
        id: today,
        date: today,
        limit: topLimit,
        generatedAt: new Date().toISOString(),
        items: topN.map(p => ({
          prospectId: p.id,
          companyName: p.companyName,
          effectiveScore: p.effectiveScore,
          closeProbability: p.closeProbability || 50,
          hasEmail: p.contacts?.some(c => !!c.email) || false,
          hasPhone: p.contacts?.some(c => !!c.phone || !!c.whatsapp) || false,
          hasWebsite: !!p.websiteUrl,
          reasons: p.aiScoreReasons || p.scoreReasons || ["Perfil industrial compatível"]
        }))
      };

      await runTransaction(db, async (transaction) => {
        transaction.set(doc(db, "tenants", tenantId, "dailyTop", today), dailyTopData);
        
        const statsDoc = await transaction.get(statsRef as any);
        if (statsDoc.exists()) {
          transaction.update(statsRef as any, { radarAvgFinalScore: Math.round(avgScore) });
        } else {
          transaction.set(statsRef as any, {
            date: today,
            radarAvgFinalScore: Math.round(avgScore),
            quotaUsed: 0,
            quotaLimit: topLimit,
            emailsSent: 0,
            emailsFailed: 0,
            newProspects: 0,
            createdAt: serverTimestamp()
          });
        }
      });
      
      toast({ title: "Radar gerado!", description: `As melhores ${topN.length} oportunidades estão prontas.` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro ao gerar radar" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSeedData = async () => {
    if (!db || !tenantId) return;
    setIsRunningDiscovery(true);
    try {
      const mockData = [
        { name: "Metalúrgica Gerdau", state: "SP", sector: "Metalurgia", score: 85, web: "gerdau.com.br" },
        { name: "WEG Motores", state: "SC", sector: "Eletrotécnica", score: 92, web: "weg.net" },
        { name: "Marcopolo S.A.", state: "RS", sector: "Automotivo", score: 78, web: "marcopolo.com.br" }
      ];

      const batch = writeBatch(db);
      for (const comp of mockData) {
        const id = `demo_${Math.random().toString(36).substr(2, 9)}`;
        const pRef = doc(db, "tenants", tenantId, "prospects", id);
        batch.set(pRef, {
          id,
          tenantId,
          companyName: comp.name,
          cnpj: "00.000.000/0001-00",
          industryTags: [comp.sector],
          address: { state: comp.state, city: "Industrial City", country: "Brasil" },
          status: "new",
          source: "demo_seed",
          effectiveScore: comp.score,
          aiScore: comp.score,
          aiScoreReasons: ["Líder de mercado detectado", "Alta maturidade digital"],
          websiteUrl: `https://www.${comp.web}`,
          contacts: [{ name: "João Silva", role: "Diretor Industrial", email: `comercial@${comp.web}`, phone: "11999999999" }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      await batch.commit();
      toast({ title: "Dados de Exemplo Criados!", description: "Agora você já pode ver o radar e as oportunidades." });
      handleGenerateDailyRadar();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao criar dados" });
    } finally {
      setIsRunningDiscovery(false);
    }
  };

  const dailyQuotaUsed = stats?.quotaUsed || 0;
  const dailyQuotaLimit = stats?.quotaLimit || 30;
  const quotaProgress = (dailyQuotaUsed / dailyQuotaLimit) * 100;

  return (
    <div className="space-y-6">
      {allProspects?.length === 0 && (
        <Card className="bg-primary text-white border-none shadow-lg overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <CardHeader className="relative pb-2">
            <CardTitle className="flex items-center gap-2"><Rocket className="w-5 h-5 text-accent" /> Comece agora (Modo Teste)</CardTitle>
            <CardDescription className="text-white/70">O sistema está vazio. Vamos populá-lo com dados reais simulados.</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm">Clique no botão ao lado para criar prospects de exemplo e ver a IA em ação.</p>
            <Button variant="secondary" className="font-bold shrink-0" onClick={handleSeedData} disabled={isRunningDiscovery}>
              {isRunningDiscovery ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="mr-2 w-4 h-4" />}
              Gerar Dados de Exemplo
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Radar do Dia</h1>
          <p className="text-muted-foreground">Priorização automática de leads industriais.</p>
        </div>
        <div className="flex items-center gap-3 bg-accent/5 p-2 rounded-lg border border-accent/20">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-bold uppercase text-accent">Quota Diária</div>
            <div className="text-xs font-bold text-primary">{dailyQuotaUsed}/{dailyQuotaLimit}</div>
          </div>
          <Progress value={quotaProgress} className="w-32 h-2" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Ativados Hoje" value={dailyQuotaUsed} icon={Target} description="Progresso da meta" />
        <KPICard title="Base Total" value={allProspects?.length || 0} icon={Users} description="Indústrias no CRM" />
        <KPICard title="Sugestões" value={dailyTop?.items.length || 0} icon={Sparkles} description="Qualificados pela IA" />
        <KPICard title="Performance" value="High" icon={Activity} description="Saúde do funil" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" /> Sugestões de Hoje
              </CardTitle>
              <CardDescription>
                {dailyTop ? `Top ${dailyTop.items.length} indústrias para abordar.` : 'Clique em atualizar para gerar o radar.'}
              </CardDescription>
            </div>
            <Button onClick={handleGenerateDailyRadar} disabled={isGenerating || allProspects?.length === 0} size="sm" className="bg-accent hover:bg-accent/90">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {dailyTopLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : !dailyTop ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-4">
                <Factory className="w-12 h-12 mx-auto opacity-10" />
                <p className="text-sm font-semibold">Nenhum radar gerado hoje.</p>
                {allProspects?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Primeiro adicione empresas em 'Discovery' ou clique em 'Gerar Dados de Exemplo'.</p>
                ) : (
                  <Button onClick={handleGenerateDailyRadar}>Gerar Agora</Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {dailyTop.items.map((item, i) => (
                  <div key={item.prospectId} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border hover:border-accent/50 transition-all group">
                    <Link href={`/prospects/${item.prospectId}`} className="flex items-center gap-4 flex-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">#{i+1}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{item.companyName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <Badge variant="outline" className="text-[9px]">Score: {item.effectiveScore}</Badge>
                           <Badge className="text-[9px] bg-accent/10 text-accent border-accent/20">Close: {item.closeProbability}%</Badge>
                        </div>
                      </div>
                    </Link>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-secondary/30 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-accent" /> Como funciona?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center shrink-0">1</div>
                  <p className="text-xs">Vá em <b>Discovery</b> e encontre empresas brasileiras.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center shrink-0">2</div>
                  <p className="text-xs">A IA analisa o site e dá uma <b>Nota (Score)</b>.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center shrink-0">3</div>
                  <p className="text-xs">Todo dia o <b>Radar</b> te dá as Top 30 oportunidades.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs" asChild>
                <Link href="/discovery">Encontrar Empresas <Search className="ml-2 w-3 h-3" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-accent" /> Radar Nacional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">124.8k</div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">Indústrias brasileiras indexadas</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
