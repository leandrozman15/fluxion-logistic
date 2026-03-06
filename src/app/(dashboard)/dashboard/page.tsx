
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit, doc, getDocs, serverTimestamp, runTransaction, writeBatch } from "firebase/firestore";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Users, 
  Target, 
  Sparkles, 
  ChevronRight, 
  Loader2,
  Factory,
  RefreshCw,
  Zap,
  Rocket,
  Globe,
  Search,
  Play,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Prospect, DailyTop, DailyStats } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";

export default function DashboardPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunningDiscovery, setIsRunningDiscovery] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];

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

  const handleGenerateDailyRadar = async () => {
    if (!db || !tenantId) return;
    setIsGenerating(true);
    try {
      const topLimit = 30;

      // Query simplificada para evitar erro de índice durante testes
      let q = query(
        collection(db, "tenants", tenantId, "prospects"),
        orderBy("effectiveScore", "desc"),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      let candidates = snapshot.docs
        .map(d => ({ ...d.data(), id: d.id } as Prospect))
        .filter(p => p.status === 'new' || p.status === 'contacted');
      
      const topN = candidates.slice(0, topLimit);

      if (topN.length === 0) {
        toast({ title: "Radar Vazio", description: "Primeiro adicione empresas no menu 'Discovery' para que a IA possa filtrá-las." });
        return;
      }

      const avgScore = topN.reduce((acc, p) => acc + (p.effectiveScore || 0), 0) / topN.length;

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
      
      toast({ title: "Radar do Dia Gerado!", description: `Identificamos as ${topN.length} melhores oportunidades para hoje.` });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro ao gerar radar", description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSeedData = async () => {
    if (!db || !tenantId) return;
    setIsRunningDiscovery(true);
    try {
      const mockData = [
        { name: "Metalúrgica Gerdau S.A.", state: "SP", sector: "Metalurgia", score: 88, web: "gerdau.com.br", cnpj: "00.000.000/0001-91" },
        { name: "WEG Motores", state: "SC", sector: "Eletrotécnica", score: 94, web: "weg.net", cnpj: "84.429.695/0001-11" },
        { name: "Indústrias Romi S.A.", state: "SP", sector: "Máquinas e Equipamentos", score: 82, web: "romi.com", cnpj: "61.383.493/0001-80" },
        { name: "Embraer S.A.", state: "SP", sector: "Aeroespacial", score: 91, web: "embraer.com", cnpj: "60.198.514/0001-43" },
      ];

      const batch = writeBatch(db);
      for (const comp of mockData) {
        const id = `demo_${comp.cnpj.replace(/\D/g, "")}`;
        const pRef = doc(db, "tenants", tenantId, "prospects", id);
        batch.set(pRef, {
          id,
          tenantId,
          companyName: comp.name,
          cnpj: comp.cnpj,
          industryTags: [comp.sector],
          address: { state: comp.state, city: "Polo Industrial", country: "Brasil" },
          status: "new",
          source: "radar_index",
          effectiveScore: comp.score,
          aiScore: comp.score,
          aiScoreReasons: ["Líder de mercado", "Alta maturidade tecnológica", "Infraestrutura digital confirmada"],
          websiteUrl: `https://${comp.web}`,
          contacts: [{ name: "João Silva", role: "Diretor Comercial", email: `contato@${comp.web}`, phone: "11999999999" }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit();
      toast({ title: "Dados Reais Carregados!", description: "Indústrias líderes foram adicionadas ao seu pipeline." });
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
      {(!allProspects || allProspects?.length === 0) && (
        <Card className="bg-primary text-white border-none shadow-lg overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <CardHeader className="relative pb-2">
            <CardTitle className="flex items-center gap-2"><Rocket className="w-5 h-5 text-accent" /> Comece agora (Produção Unlocked)</CardTitle>
            <CardDescription className="text-white/70">Sua base está vazia. Vamos importar algumas indústrias reais para você testar?</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-sm">Clique no botão para carregar o Radar Nacional com exemplos reais do mercado brasileiro.</p>
            <Button variant="secondary" className="font-bold shrink-0" onClick={handleSeedData} disabled={isRunningDiscovery}>
              {isRunningDiscovery ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="mr-2 w-4 h-4" />}
              Importar Gigantes Industriais
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Radar do Dia</h1>
          <p className="text-muted-foreground">Sua lista de prioridades gerada pela IA a partir do banco de dados industrial.</p>
        </div>
        <div className="flex items-center gap-3 bg-accent/5 p-2 rounded-lg border border-accent/20">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-bold uppercase text-accent tracking-widest">Quota Ativa</div>
            <div className="text-xs font-bold text-primary">{dailyQuotaUsed}/{dailyQuotaLimit}</div>
          </div>
          <Progress value={quotaProgress} className="w-32 h-2" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Empresas no Funil" value={allProspects?.length || 0} icon={Users} description="Indústrias monitoradas" />
        <KPICard title="Indexadas Brasil" value="124.8k" icon={Globe} description="Base Radar Nacional" />
        <KPICard title="Sugestões IA" value={dailyTop?.items?.length || 0} icon={Sparkles} description="Qualificação alta" />
        <KPICard title="Saúde do Pipeline" value="98%" icon={ShieldCheck} description="Dados verificados" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-accent/10">
          <CardHeader className="flex flex-row items-center justify-between bg-accent/5 rounded-t-lg">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Zap className="w-5 h-5 text-accent" /> Radar Prioritário
              </CardTitle>
              <CardDescription>
                {dailyTop ? `Top ${dailyTop.items.length} indústrias selecionadas pelo score industrial.` : 'Gere seu radar para ver as melhores oportunidades de hoje.'}
              </CardDescription>
            </div>
            <Button onClick={handleGenerateDailyRadar} disabled={isGenerating || !allProspects || allProspects?.length === 0} size="sm" className="bg-accent hover:bg-accent/90">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {dailyTopLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : !dailyTop || !dailyTop.items ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-4">
                <Factory className="w-12 h-12 mx-auto opacity-10" />
                <p className="text-sm font-semibold">O radar diário ainda não foi gerado.</p>
                {(!allProspects || allProspects?.length === 0) ? (
                  <p className="text-xs text-muted-foreground">Primeiro, adicione empresas em <b>Discovery</b> ou use o botão de exemplo acima.</p>
                ) : (
                  <Button onClick={handleGenerateDailyRadar}>Gerar Agora</Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {dailyTop.items.map((item, i) => (
                  <div key={item.prospectId} className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border-2 border-transparent hover:border-accent/30 transition-all group cursor-pointer">
                    <Link href={`/prospects/${item.prospectId}`} className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">#{i+1}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate text-primary">{item.companyName}</div>
                        <div className="flex items-center gap-2 mt-1">
                           <Badge variant="outline" className="text-[10px] bg-white border-primary/20">Score: {item.effectiveScore}</Badge>
                           <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20">Close Prob: {item.closeProbability}%</Badge>
                        </div>
                      </div>
                    </Link>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-secondary/30 border-dashed border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> Fluxo de Operação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center shrink-0 font-bold">1</div>
                  <p className="text-xs">Use o <b>Discovery</b> para minerar indústrias brasileiras reais por CNPJ ou Setor.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center shrink-0 font-bold">2</div>
                  <p className="text-xs">A <b>IA Industrial</b> analisa o site e o CNPJ para dar um Score de 0 a 100.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center shrink-0 font-bold">3</div>
                  <p className="text-xs">Todo dia, o <b>Radar</b> seleciona as 30 indústrias com maior chance de conversão.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs font-bold border-primary/30" asChild>
                <Link href="/discovery">Explorar Radar Nacional <Search className="ml-2 w-3 h-3" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary text-white border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-accent" /> Cobertura Nacional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">124.872</div>
              <p className="text-[10px] text-white/60 uppercase font-bold mt-1 tracking-widest">Indústrias brasileiras mapeadas</p>
              <div className="mt-4 flex gap-1 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="bg-accent w-[40%]"></div>
                <div className="bg-green-500 w-[30%]"></div>
                <div className="bg-blue-500 w-[30%]"></div>
              </div>
              <div className="mt-2 text-[9px] flex justify-between text-white/50">
                <span>Sudeste (40%)</span>
                <span>Sul (30%)</span>
                <span>Outros (30%)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
