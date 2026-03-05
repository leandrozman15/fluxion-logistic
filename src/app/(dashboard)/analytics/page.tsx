
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
  Line,
  Cell
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
  Lightbulb,
  ShieldCheck,
  AlertTriangle
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
      delivered: s.emailsDelivered || Math.floor((s.emailsSent || 0) * 0.95),
      new: s.newProspects || 0
    }));
  }, [dailyStats]);

  const deliverabilityData = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return [];
    const latest = dailyStats[0];
    const delivered = latest.emailsDelivered || Math.floor((latest.emailsSent || 0) * 0.95);
    const bounced = (latest.emailsSent || 0) - delivered;
    return [
      { name: 'Entregue', value: delivered, color: '#10b981' },
      { name: 'Falha/Spam', value: bounced, color: '#ef4444' }
    ];
  }, [dailyStats]);

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
    return {
      title: "Otimize Deliverability",
      description: "Sua taxa de entrega de e-mails está estável. Considere ativar o Warmup se for trocar de domínio.",
      type: "neutral"
    };
  }, [weeklyStats]);

  const handleReconcileStats = async () => {
    if (!db || !tenantId || !isAdmin) return;
    setIsSyncing(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const yearWeek = `${new Date().getFullYear()}-${Math.ceil((new Date().getDate() + 6 - new Date().getDay()) / 7)}`;
      
      const pSnapshot = await getDocs(query(collection(db, "tenants", tenantId, "prospects")));
      const prospects = pSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Prospect));
      
      const eSnapshot = await getDocs(query(collection(db, "tenants", tenantId, "events")));
      const events = eSnapshot.docs.map(d => d.data());

      const counts = {
        contacted: prospects.filter(p => p.status === 'contacted').length,
        interested: prospects.filter(p => p.status === 'interested').length,
        waOpened: events.filter(e => e.type === 'whatsapp_opened').length,
        emailSent: events.filter(e => e.type === 'email_prepared').length,
      };

      const waInterested = prospects.filter(p => p.status === 'interested' && events.some(e => e.prospectId === p.id && e.type === 'whatsapp_opened')).length;
      const emailInterested = prospects.filter(p => p.status === 'interested' && events.some(e => e.prospectId === p.id && e.type === 'email_prepared')).length;

      const batch = writeBatch(db);
      const weeklyRef = doc(db, "tenants", tenantId, "weeklyStats", yearWeek);
      
      batch.set(weeklyRef, {
        id: yearWeek,
        weekId: yearWeek,
        statusChangedTo_contacted: counts.contacted,
        statusChangedTo_interested: counts.interested,
        whatsappOpenedCount: counts.waOpened,
        emailsSentCount: counts.emailSent,
        whatsappInterestedCount: waInterested,
        emailInterestedCount: emailInterested,
        reconciledAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      toast({ title: "Sincronização completa" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na sincronização" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (dailyLoading || weeklyLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { title: "Deliverability", value: "98.2%", icon: ShieldCheck, description: "Saúde do domínio" },
    { title: "Abordagens WA", value: dailyStats?.reduce((acc, s) => acc + (s.whatsappOpened || 0), 0) || 0, icon: MessageCircle, description: "Total WhatsApp" },
    { title: "Score Médio Radar", value: Math.round(dailyStats?.reduce((acc, s) => acc + (s.radarAvgFinalScore || 0), 0) / (dailyStats?.length || 1)), icon: Target, description: "Qualidade IA" },
    { title: "Taxa Interesse", value: "14%", icon: TrendingUp, description: "Conversão Global" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Insights Industriais</h1>
          <p className="text-muted-foreground">Analise a saúde da sua prospecção e entregabilidade.</p>
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
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      {operationalInsight && (
        <Card className={`border-none ${operationalInsight.type === 'positive' ? 'bg-green-50 text-green-900' : 'bg-blue-50 text-blue-900'}`}>
          <CardContent className="pt-6 flex items-start gap-4">
            <div className={`p-3 rounded-xl ${operationalInsight.type === 'positive' ? 'bg-green-100' : 'bg-blue-100'}`}>
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
              <ShieldCheck className="w-4 h-4 text-green-600" /> Saúde de Entrega (E-mail)
            </CardTitle>
            <CardDescription>Volume de envios bem sucedidos vs rejeitados.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deliverabilityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {deliverabilityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Conversões por Canal
            </CardTitle>
            <CardDescription>Volume de abordagens versus leads interessados.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={80} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="sent" name="Abordagens" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={20} />
                <Bar dataKey="conv" name="Interessados" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
