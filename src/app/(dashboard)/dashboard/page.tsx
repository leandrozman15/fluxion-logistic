import { KPICard } from "@/components/dashboard/kpi-card";
import { Users, Mail, Target, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const kpis = [
    { title: "Novos Prospects", value: 124, icon: Users, description: "+12% desde ontem" },
    { title: "Contactados (Semana)", value: 45, icon: Mail, description: "Meta: 50" },
    { title: "Interessados", value: 12, icon: TrendingUp, description: "Taxa: 26%" },
    { title: "Demos Agendadas", value: 5, icon: Target, description: "Próximos 7 dias" },
  ];

  const recentActivity = [
    { company: "Metalúrgica Silva", status: "interested", score: 85, time: "2 horas atrás" },
    { company: "Indústria de Plásticos ABC", status: "contacted", score: 72, time: "4 horas atrás" },
    { company: "Tech Logística BR", status: "new", score: 45, time: "6 horas atrás" },
    { company: "AgroFértil Sul", status: "demo", score: 92, time: "1 dia atrás" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas interações e atualizações de prospects.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{activity.company}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {activity.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={activity.score > 80 ? "default" : "secondary"} className={activity.score > 80 ? "bg-accent" : ""}>
                      Score: {activity.score}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {activity.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metas do Período</CardTitle>
            <CardDescription>Progresso das campanhas ativas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Emails Enviados</span>
                <span className="font-bold">450 / 1000</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Novas Conexões</span>
                <span className="font-bold">25 / 40</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: '62.5%' }}></div>
              </div>
            </div>
            <div className="pt-4 border-t">
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <CheckCircle2 className="w-4 h-4 text-green-500" />
                 <span>Campanha "Indústria Sul" concluída com sucesso.</span>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}