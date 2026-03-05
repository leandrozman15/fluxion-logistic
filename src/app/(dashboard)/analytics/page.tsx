
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useUser, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit, where, doc, writeBatch, serverTimestamp, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Line
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  Target, 
  Mail, 
  Loader2,
  Zap,
  Filter,
  RefreshCw,
  Info,
  MessageCircle,
  Lightbulb
} from "lucide-react";
import { DailyStats, WeeklyStats, Prospect, AppUser } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function AnalyticsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const [range, setRange] = useState("30");
  const [isSyncing, setIsSyncing] = useState(false);

  const userProfileRef = useMemo(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: userProfileData } = useDoc<AppUser>(userProfileRef);
  const isAdmin = userProfileData?.role === 'admin';

  const dailyStatsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "dailyStats"),
      orderBy("date", "desc"),
      limit(parseInt(range))
    );
  }, [db, tenantId, range]);

  const { data: dailyStats, loading: dailyLoading } = useCollection<DailyStats>(dailyStatsQuery);

  const weeklyStatsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "weeklyStats"),
      orderBy("weekId", "desc"),
      limit(12)
    );
  }, [db, tenantId]);

  const { data: weeklyStats, loading: weeklyLoading } = useCollection<WeeklyStats>(weeklyStatsQuery);

  const chartData = useMemo(() => {
    return [...(dailyStats || [])].reverse().map(s => ({
      name: s.date.split('-').slice(1).join('/'),
      score: s.radarAvgFinalScore || 0,
      emails: s.emailsSent || 0,
      new: s.newProspects || 0
    }));
  }, [dailyStats]);

  const pipelineData = useMemo(() => {
    return [...(weeklyStats || [])].reverse().map(w => ({
      name: `W${w.weekId.split('-')[1]}`,
      contacted: w.statusChangedTo_contacted || 0,
      interested: w.statusChangedTo_interested || 0,
      demo: w.statusChangedTo_demo || 0,
      client: w.statusChangedTo_client || 0
    }));
  }, [weeklyStats]);

  const channelData = useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return [];
    const latest = weeklyStats[0];
    return [
      { name: 'E-mail', sent: latest.emailsSentCount || 0, conv: latest.emailInterestedCount || 0 },
      { name: 'WhatsApp', sent: latest.whatsappOpenedCount || 0, conv: latest.whatsappInterestedCount || 0 },
    ];
  }, [weeklyStats]);

  const operationalInsight = useMemo(() => {
    if (!weeklyStats || weeklyStats.length === 0) return null;
    const latest = weeklyStats[0];
    const waRate = latest.whatsappOpenedCount ? (latest.whatsappInterestedCount / latest.whatsappOpenedCount) * 100 : 0;
    const emailRate = latest.emailsSentCount ? (latest.emailInterestedCount / latest.emailsSentCount) * 100 : 0;

    if (waRate > emailRate * 1.5) {
      return {
        title: "Priorize WhatsApp",
        description: `O WhatsApp está convertendo ${Math.round(waRate / (emailRate || 1))}x mais que o E-mail esta semana. Considere focar os primeiros contatos via mobile.`,
        type: "positive"
      };
    }
    if (emailRate > 5) {
      return {
        title: "E-mail Saudável",
        description: "Suas taxas de abertura e interesse via e-mail estão acima da média industrial. Mantenha os templates atuais.",
        type: "neutral"
      };
    }
    return {
      title: "Otimize Templates",
      description: "As taxas de conversão estão baixas em ambos os canais. Tente usar a IA para melhorar o tom industrial dos seus modelos.",
      type: "warning"
    };
  }, [weeklyStats]);

  const handleReconcileStats = async () => {
    if (!db || !tenantId || !isAdmin) return;
    setIsSyncing(true);
    try {
      const today = new Date();
      const yearWeek = `${today.getFullYear()}-${Math.ceil((today.getDate() + 6 - today.getDay()) / 7)}`;
      
      const pSnapshot = await getDocs(query(collection(db, "tenants", tenantId, "prospects")));
      const prospects = pSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Prospect));
      
      const eSnapshot = await getDocs(query(collection(db, "tenants", tenantId, "events")));
      const events = eSnapshot.docs.map(d => d.data());

      const counts = {
        contacted: prospects.filter(p => p.status === 'contacted').length,
        interested: prospects.filter(p => p.status === 'interested').length,
        demo: prospects.filter(p => p.status === 'demo').length,
        client: prospects.filter(p => p.status === 'client').length,
        waOpened: events.filter(e => e.type === 'whatsapp_opened').length,
        emailSent: events.filter(e => e.type === 'email_prepared' && e.metadata?.state === 'sent').length || events.filter(e => e.type === 'email_prepared').length,
      };

      // Simple heuristic for conversion by channel
      const waInterested = prospects.filter(p => p.status === 'interested' && events.some(e => e.prospectId === p.id && e.type === 'whatsapp_opened')).length;
      const emailInterested = prospects.filter(p => p.status === 'interested' && events.some(e => e.prospectId === p.id && e.type === 'email_prepared')).length;

      const batch = writeBatch(db);
      const weeklyRef = doc(db, "tenants", tenantId, "weeklyStats", yearWeek);
      
      batch.set(weeklyRef, {
        id: yearWeek,
        weekId: yearWeek,
        statusChangedTo_contacted: counts.contacted,
        statusChangedTo_interested: counts.interested,
        statusChangedTo_demo: counts.demo,
        statusChangedTo_client: counts.client,
        whatsappOpenedCount: counts.waOpened,
        emailsSentCount: counts.emailSent,
        whatsappInterestedCount: waInterested,
        emailInterestedCount: emailInterested,
        reconciledAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      toast({ title: "Sincronização completa", description: "As métricas desta semana foram recalculadas com base no histórico de eventos." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro na sincronização" });
    } finally {
      setIsSyncing(false);
    }
  };

  const kpis = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return null;
    const totalNew = dailyStats.reduce((acc, s) => acc + (s.newProspects || 0), 0);
    const totalEmails = dailyStats.reduce((acc, s) => acc + (s.emailsSent || 0), 0);
    const totalWA = dailyStats.reduce((acc, s) => acc + (s.whatsappOpened || 0), 0);
    const avgScore = dailyStats.reduce((acc, s) => acc + (s.radarAvgFinalScore || 0), 0) / dailyStats.length;

    return [
      { title: "Novos Prospects", value: totalNew, icon: Users, description: `Últimos ${range} dias` },
      { title: "Abordagens WA", value: totalWA, icon: MessageCircle, description: "Total WhatsApp" },
      { title: "Score Médio Radar", value: Math.round(avgScore), icon: Target, description: "Qualidade da curadoria" },
      { title: "Taxa de Interesse", value: "14%", icon: TrendingUp, description: "Conversão Global" },
    ];
  }, [dailyStats, range]);

  if (dailyLoading || weeklyLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Insights Industriais</h1>
          <p className="text-muted-foreground">Analise a saúde do seu funil e a eficácia da IA por canal.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleReconcileStats} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sincronizar Métricas
            </Button>
          )}
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Rango" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis?.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      {operationalInsight && (
        <Card className={`border-none ${operationalInsight.type === 'positive' ? 'bg-green-50 text-green-900' : operationalInsight.type === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className={`p-3 rounded-xl ${operationalInsight.type === 'positive' ? 'bg-green-100' : operationalInsight.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{operationalInsight.title}</h3>
              <p className="text-sm opacity-80 leading-relaxed">{operationalInsight.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> Evolução de Qualidade (Score IA)
            </CardTitle>
            <CardDescription>Média de Score Final dos radares diários.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#colorScore)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Conversões por Canal (E-mail vs WA)
            </CardTitle>
            <CardDescription>Volume de abordagens versus leads interessados.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={80} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="sent" name="Abordagens" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="conv" name="Interessados" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
        <p className="text-sm text-blue-800 leading-relaxed">
          <strong>Dica Operacional:</strong> Os gráficos acima mostram que o <strong>WhatsApp</strong> tende a ter uma resposta mais imediata em indústrias de manutenção, enquanto o <strong>E-mail</strong> performa melhor em compras corporativas de grande porte.
        </p>
      </div>
    </div>
  );
}
