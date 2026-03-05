
"use client";

import { KPICard } from "@/components/dashboard/kpi-card";
import { Users, Mail, Target, TrendingUp, Sparkles, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const dailyQuotaUsed = 12;
  const dailyQuotaLimit = 30;
  const quotaProgress = (dailyQuotaUsed / dailyQuotaLimit) * 100;

  const kpis = [
    { title: "Quota do Dia", value: `${dailyQuotaUsed}/${dailyQuotaLimit}`, icon: Target, description: "Prospects ativados hoje" },
    { title: "Novos Prospects", value: 124, icon: Users, description: "Total no banco" },
    { title: "Contactados", value: 45, icon: Mail, description: "Esta semana" },
    { title: "Interessados", value: 8, icon: TrendingUp, description: "Taxa: 18%" },
  ];

  const dailyTop30 = [
    { id: "1", company: "Metalúrgica Silva", score: 95, reason: "Decisor com LinkedIn e Email validado" },
    { id: "2", company: "Indústria ABC", score: 88, reason: "Site industrial com alta relevância" },
    { id: "3", company: "Logística Express", score: 82, reason: "Localizada em polo industrial" },
    { id: "4", company: "AgroFértil", score: 79, reason: "CNPJ ativo e faturamento compatível" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Radar do Dia</h1>
          <p className="text-muted-foreground">Foco nas melhores oportunidades para hoy.</p>
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
                <Sparkles className="w-5 h-5 text-accent" /> Top Sugestões de Hoje
              </CardTitle>
              <CardDescription>As 30 empresas com maior potencial para abordagem imediata.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/prospects">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyTop30.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border hover:border-accent/50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                      #{i + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{item.company}</div>
                      <div className="text-xs text-muted-foreground">{item.reason}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-accent font-mono">Score: {item.score}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                  </div>
                </div>
              ))}
            </div>
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
                Empresas com score acima de 90 têm 4x mais chances de agendamento de demo. Priorize os contatos via WhatsApp agora de manhã.
              </p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 text-sm">
                 <div className="w-2 h-2 rounded-full bg-green-500"></div>
                 <span>6 Emails agendados para as 14h</span>
               </div>
               <div className="flex items-center gap-3 text-sm">
                 <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                 <span>3 Follow-ups pendentes</span>
               </div>
               <div className="flex items-center gap-3 text-sm">
                 <div className="w-2 h-2 rounded-full bg-muted"></div>
                 <span className="text-muted-foreground">Meta: +18 ativações hoje</span>
               </div>
            </div>

            <Button className="w-full bg-primary">Limpar Quota do Dia</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
