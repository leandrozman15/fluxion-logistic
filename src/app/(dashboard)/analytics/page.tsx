'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  Legend,
  AreaChart,
  Area
} from "recharts";
import { 
  TrendingUp, 
  Users, 
  Target, 
  Mail, 
  ArrowUpRight, 
  ArrowDownRight, 
  Loader2,
  Calendar,
  Zap,
  Filter
} from "lucide-react";
import { DailyStats, WeeklyStats, Prospect } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AnalyticsPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const [range, setRange] = useState("30");

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

  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"), limit(500));
  }, [db, tenantId]);

  const { data: allProspects } = useCollection<Prospect>(prospectsQuery);

  // Procesamiento de datos para gráficos
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

  const kpis = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return null;
    const current = dailyStats[0];
    const totalNew = dailyStats.reduce((acc, s) => acc + (s.newProspects || 0), 0);
    const totalEmails = dailyStats.reduce((acc, s) => acc + (s.emailsSent || 0), 0);
    const avgScore = dailyStats.reduce((acc, s) => acc + (s.radarAvgFinalScore || 0), 0) / dailyStats.length;

    return [
      { title: "Novos Prospects", value: totalNew, icon: Users, description: `Últimos ${range} dias` },
      { title: "Emails Enviados", value: totalEmails, icon: Mail, description: "Volume total de saída" },
      { title: "Score Médio Radar", value: Math.round(avgScore), icon: Target, description: "Qualidade da curadoria" },
      { title: "Conversão Pipeline", value: "12%", icon: TrendingUp, description: "New -> Interested" },
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
          <p className="text-muted-foreground">Analise a saúde do seu funil e a eficácia da IA.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
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
              <Filter className="w-4 h-4 text-primary" /> Conversões do Funil (Semanal)
            </CardTitle>
            <CardDescription>Passagem dos prospectos entre as etapas do pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="contacted" name="Contactado" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="interested" name="Interessado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="demo" name="Demo" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" /> Volume de Saída Operacional
            </CardTitle>
            <CardDescription>Quantidade de e-mails disparados diariamente.</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="emails" name="Emails Enviados" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
