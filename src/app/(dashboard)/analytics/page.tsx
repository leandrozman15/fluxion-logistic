'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  TrendingUp, 
  Loader2,
  Lightbulb,
  Filter,
  Activity,
  Package,
  CheckCircle2
} from "lucide-react";
import { Load } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AnalyticsPage() {
  const db = useFirestore();
  const [range, setRange] = useState("30");

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(100));
  }, [db]);

  const { data: loads, loading } = useCollection<Load>(loadsQuery);

  const stats = useMemo(() => {
    if (!loads) return { total: 0, delivered: 0, revenue: 0, avgWeight: 0 };
    const delivered = loads.filter(l => l.status === 'delivered');
    const revenue = delivered.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
    const avgWeight = delivered.length > 0 
      ? delivered.reduce((acc, l) => acc + (l.weightKg || 0), 0) / delivered.length 
      : 0;

    return {
      total: loads.length,
      delivered: delivered.length,
      revenue,
      avgWeight
    };
  }, [loads]);

  const chartData = useMemo(() => {
    if (!loads) return [];
    // Simulação de dados por tipo de serviço
    return [
      { name: 'Carga General', total: loads.filter(l => l.serviceType === 'standard').length },
      { name: 'Internacional', total: loads.filter(l => l.serviceType === 'customs').length },
      { name: 'Refrigerado', total: loads.filter(l => l.serviceType === 'reefer').length },
      { name: 'Peligrosa', total: loads.filter(l => l.serviceType === 'dangerous').length },
    ];
  }, [loads]);

  if (loading) {
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
          <h1 className="text-2xl font-bold text-slate-900">Análisis Operativo</h1>
          <p className="text-muted-foreground">Métricas de rendimiento y salud del negocio logístico.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Último trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Facturación Total" value={stats.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} icon={TrendingUp} description="Basado en entregas realizadas" />
        <KPICard title="Operaciones" value={stats.total} icon={Package} description="Total de fletes registrados" />
        <KPICard title="Tasa de Entrega" value={`${Math.round((stats.delivered / stats.total) * 100) || 0}%`} icon={CheckCircle2} description="Efectividad de servicio" />
        <KPICard title="Peso Promedio" value={`${Math.round(stats.avgWeight)} Kg`} icon={Activity} description="Por operación finalizada" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" /> Operaciones por Tipo de Servicio
            </CardTitle>
            <CardDescription>Distribución de la carga de trabajo actual.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <div className="flex items-center justify-center h-full bg-slate-50 rounded-lg border border-dashed border-slate-200">
               <p className="text-xs text-slate-400">Gráfico de distribución por servicio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-600 text-white border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lightbulb className="w-5 h-5 text-yellow-400" /> Insight Estratégico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm opacity-90 leading-relaxed">
              Sus operaciones internacionales representan un volumen significativo de la carga. 
              Dada la rentabilidad del flete regional, considere optimizar las rutas del corredor bioceánico para reducir el consumo de combustible.
            </p>
            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center text-xs mb-2">
                <span>Eficiencia de Ruta Regional</span>
                <span className="font-bold">92%</span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white h-full" style={{ width: '92%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
