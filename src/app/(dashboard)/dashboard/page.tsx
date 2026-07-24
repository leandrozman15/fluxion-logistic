
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Truck, Users, Package, MapPin, TrendingUp, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const stats = [
    { title: "Camiones en Ruta", value: "18", icon: Truck, description: "Unidades activas ahora" },
    { title: "Choferes Disponibles", value: "5", icon: Users, description: "Personal en descanso" },
    { title: "Cargas Pendientes", value: "12", icon: Package, description: "A la espera de asignación" },
    { title: "Entregas Realizadas", value: "45", icon: TrendingUp, description: "Últimas 24 horas" },
  ];

  const alerts = [
    { type: "VTV", title: "Patente AD-455-GH", detail: "Vence en 48hs", color: "bg-red-500" },
    { type: "RUTA", title: "Ruta 9 - Rosario", detail: "Corte por obras", color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monitor Operativo</h1>
        <p className="text-slate-500">Gestión de flota y logística en tiempo real.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <KPICard key={i} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Estado de Unidades</CardTitle>
              <CardDescription>Ubicación y actividad reportada.</CardDescription>
            </div>
            <Button variant="outline" size="sm">Ver Mapa Completo</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border hover:border-blue-200 transition-all group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <Truck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Camión Scania R450</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] uppercase">AD-788-OP</Badge>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Cordoba, Argentina
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3">En Viaje</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" /> Alertas Críticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.map((alert, i) => (
                <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${alert.color}`}></div>
                    <span className="text-[10px] font-bold uppercase text-white/50">{alert.type}</span>
                  </div>
                  <p className="text-sm font-semibold">{alert.title}</p>
                  <p className="text-xs text-white/40">{alert.detail}</p>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-xs text-white/50 hover:text-white" size="sm">
                Ver todas las notificaciones
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed border-2 bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Próximos Arribos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {[1, 2].map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5"></div>
                  <div>
                    <p className="text-xs font-bold">BS AS - Base Logística</p>
                    <p className="text-[10px] text-slate-500">Estimado: 14:30 hs</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
