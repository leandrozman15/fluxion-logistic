
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit, doc, setDoc, getDocs, serverTimestamp, getDoc, runTransaction, updateDoc, addDoc } from "firebase/firestore";
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
  Rocket
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
import { Prospect, DailyTop, Tenant, DailyStats } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
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
      const settings = tenantData?.settings;
      const topLimit = settings?.dailyTopLimit || 30;
      const requireContact = settings?.requireContactMethod || 'email_or_phone';

      let q = query(
        collection(db, "tenants", tenantId, "prospects"),
        where("status", "in", ["new", "contacted"]),
        where("doNotContact", "==", false),
        orderBy("effectiveScore", "desc"),
        limit(200)
      );
      
      const snapshot = await getDocs(q);
      let candidates = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Prospect));
      
      if (requireContact !== 'none') {
        candidates = candidates.filter(p => {
          const hasEmail = p.contacts?.some(c => !!c.email);
          const hasPhone = p.contacts?.some(c => !!c.phone || !!c.whatsapp);
          if (requireContact === 'email_only') return hasEmail;
          return hasEmail || hasPhone;
        });
      }

      const topN = candidates
        .filter(p => !p.isClaimedToday)
        .slice(0, topLimit);

      if (topN.length === 0) {
        toast({ title: "Radar vazio", description: "Não há novos prospectos para gerar o radar hoje." });
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
          hasEmail: p.contacts?.some(c => !!c.email) || false,
          hasPhone: p.contacts?.some(c => !!c.phone || !!c.whatsapp) || false,
          hasWebsite: !!p.websiteUrl,
          reasons: p.aiScoreReasons || p.scoreReasons || []
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

  const handleQuickClaim = async (prospectId: string) => {
    if (!db || !tenantId) return;
    setIsActionLoading(prospectId);
    try {
      const statsRef = doc(db, "tenants", tenantId, "dailyStats", today);
      const pRef = doc(db, "tenants", tenantId, "prospects", prospectId);

      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        let currentQuota = 0;
        let quotaLimit = 30;

        if (statsDoc.exists()) {
          currentQuota = statsDoc.data().quotaUsed || 0;
          quotaLimit = statsDoc.data().quotaLimit || 30;
        }

        if (currentQuota >= quotaLimit) throw new Error("Quota atingida");

        transaction.update(pRef, {
          isClaimedToday: true,
          claimedAt: new Date().toISOString(),
          status: 'contacted'
        });

        transaction.update(statsRef, { quotaUsed: currentQuota + 1 });
      });
      toast({ title: "Ativado!", description: "Prospect adicionado ao radar de hoje." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleActionClick = (prospectId: string, type: string) => {
    router.push(`/prospects/${prospectId}`);
  };

  const dailyQuotaUsed = stats?.quotaUsed || 0;
  const dailyQuotaLimit = stats?.quotaLimit || tenantData?.settings?.dailyTopLimit || 30;
  const quotaProgress = (dailyQuotaUsed / dailyQuotaLimit) * 100;

  const kpis = [
    { title: "Ativados Hoje", value: `${dailyQuotaUsed}/${dailyQuotaLimit}`, icon: Target, description: "Progresso da meta diária" },
    { title: "Base Total", value: allProspects?.length || 0, icon: Users, description: "Empresas cadastradas" },
    { title: "Emails na Fila", value: stats?.emailsSent || 0, icon: Mail, description: "Comunicações disparadas" },
    { title: "Potencial IA", value: "84%", icon: Sparkles, description: "Qualidade média da base" },
  ];

  return (
    <div className="space-y-6">
      {tenantData && !tenantData.settings?.onboardingCompleted && (
        <Card className="bg-primary text-white border-none shadow-lg overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <CardHeader className="relative pb-2">
            <CardTitle className="flex items-center gap-2"><Rocket className="w-5 h-5 text-accent" /> Comece com o pé direito</CardTitle>
            <CardDescription className="text-white/70">Seu motor de prospecção ainda não foi calibrado.</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm">Complete o onboarding para configurar seus pesos de IA, importar leads e gerar seu primeiro radar.</p>
            <Button variant="secondary" className="font-bold shrink-0" asChild>
              <Link href="/onboarding">Configurar Agora <ChevronRight className="ml-1 w-4 h-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Radar do Dia</h1>
          <p className="text-muted-foreground">Foco nas melhores oportunidades industriais.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" /> Sugestões de Hoje
              </CardTitle>
              <CardDescription>
                {dailyTop ? `Top ${dailyTop.items.length} oportunidades congeladas para hoje.` : 'O radar ainda não foi gerado.'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerateDailyRadar} disabled={isGenerating} size="sm" className="bg-accent hover:bg-accent/90">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dailyTopLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-3">
                {!dailyTop ? (
                  <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-4">
                    <Factory className="w-12 h-12 mx-auto opacity-10" />
                    <p className="text-sm font-semibold">Radar pronto para ser gerado</p>
                    <Button onClick={handleGenerateDailyRadar} disabled={isGenerating}>Começar agora</Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {dailyTop.items.map((item, i) => (
                      <div key={item.prospectId} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border hover:border-accent/50 transition-all group">
                        <Link href={`/prospects/${item.prospectId}`} className="flex items-center gap-4 flex-1">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">#{i+1}</div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm truncate">{item.companyName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                               <Badge variant="outline" className="text-[9px] px-1 h-4">Score: {item.effectiveScore}</Badge>
                            </div>
                          </div>
                        </Link>
                        
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-8 text-[10px] font-bold"
                            onClick={() => handleActionClick(item.prospectId, 'followup')}
                          >
                            <Lightbulb className="w-3 h-3 mr-1 text-accent" /> Próxima Ação
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-600" 
                            onClick={() => handleQuickClaim(item.prospectId)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><PieChart className="w-4 h-4" /> Mix de Indústrias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                {industryData.length > 0 ? (
                  <ChartContainer config={{ value: { label: "Empresas", color: "hsl(var(--primary))" } }}>
                    <BarChart data={industryData} layout="vertical" margin={{ left: -20, right: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">Dados insuficientes</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
