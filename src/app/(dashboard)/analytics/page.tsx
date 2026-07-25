'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Loader2,
  Lightbulb,
  Filter,
  Activity,
  Package,
  CheckCircle2,
  Fuel,
  Wrench,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  BarChart3
} from "lucide-react";
import { Load, Expense, Maintenance, Truck } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from "recharts";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const db = useFirestore();
  const [range, setRange] = useState("30");

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(200));
  }, [db]);

  const expensesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "global_expenses"), orderBy("createdAt", "desc"));
  }, [db]);

  const maintenanceQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "maintenance"), orderBy("createdAt", "desc"));
  }, [db]);

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "trucks");
  }, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: expenses } = useCollection<Expense>(expensesQuery);
  const { data: maintenance } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);

  const stats = useMemo(() => {
    if (!loads) return { total: 0, delivered: 0, revenue: 0, avgWeight: 0 };
    const delivered = loads.filter(l => l.status === 'delivered');
    const revenue = delivered.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
    const avgWeight = delivered.length > 0 
      ? delivered.reduce((acc, l) => acc + (l.outboundStops?.reduce((sAcc, s) => s + (s.weightKg || 0), 0) || 0), 0) / delivered.length 
      : 0;

    return {
      total: loads.length,
      delivered: delivered.length,
      revenue,
      avgWeight
    };
  }, [loads]);

  const efficiencyData = useMemo(() => {
    if (!trucks) return [];

    return trucks.map(truck => {
      const truckExpenses = expenses?.filter(e => e.truckId === truck.id) || [];
      const truckMaintenance = maintenance?.filter(m => m.truckId === truck.id && m.status === 'completed') || [];
      
      const fuelCost = truckExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      const repairCost = truckMaintenance.reduce((acc, m) => acc + (m.actualCost || m.estimatedCost || 0), 0);
      
      const totalCost = fuelCost + repairCost;
      const km = truck.odometerKm || 1; // Evitar división por cero
      
      // Cálculo de Costo por Kilómetro (ARS/KM)
      // Nota: En un sistema real usaríamos el delta de KM del periodo, aquí usamos acumulado para el MVP
      const costPerKm = totalCost / km;

      return {
        name: truck.plate,
        costPerKm: parseFloat(costPerKm.toFixed(2)),
        totalCost,
        fuelCost,
        repairCost,
        km
      };
    }).sort((a, b) => b.costPerKm - a.costPerKm);
  }, [trucks, expenses, maintenance]);

  const fleetAverages = useMemo(() => {
    if (efficiencyData.length === 0) return { avgCostPerKm: 0 };
    const sum = efficiencyData.reduce((acc, d) => acc + d.costPerKm, 0);
    return {
      avgCostPerKm: sum / efficiencyData.length
    };
  }, [efficiencyData]);

  const loading = loadsLoading;

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
          <h1 className="text-2xl font-bold text-slate-900">Análisis de Inteligencia Logística</h1>
          <p className="text-muted-foreground">Monitoreo de rentabilidad y eficiencia de la flota pesada.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Acumulado Anual 2025</SelectItem>
              <SelectItem value="90">Último Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Facturación Total" value={stats.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={TrendingUp} description="Por entregas finalizadas" />
        <KPICard title="Costo Avg / KM" value={`$${fleetAverages.avgCostPerKm.toFixed(2)}`} icon={Activity} description="Promedio de toda la flota" />
        <KPICard title="Operaciones" value={stats.total} icon={Package} description="Fletes registrados" />
        <KPICard title="Eficiencia Entrega" value={`${Math.round((stats.delivered / stats.total) * 100) || 0}%`} icon={CheckCircle2} description="Cumplimiento de misión" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Ranking de Costo por Kilómetro (ARS/KM)
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">¿Qué unidad es la que más gasta?</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white">MAYOR GASTO A LA IZQUIERDA</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} unit="$" />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-xl space-y-1">
                          <p className="font-bold text-slate-900">{data.name}</p>
                          <p className="text-xs text-blue-600 font-bold">Costo/KM: ${data.costPerKm}</p>
                          <p className="text-[10px] text-slate-500">Gasto Total: ${data.totalCost.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-500">Recorrido: {data.km.toLocaleString()} KM</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="costPerKm" radius={[4, 4, 0, 0]}>
                  {efficiencyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.costPerKm > fleetAverages.avgCostPerKm ? '#ef4444' : '#2563eb'} 
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={cn(
            "border-none shadow-md",
            efficiencyData[0]?.costPerKm > fleetAverages.avgCostPerKm * 1.2 ? "bg-red-50" : "bg-blue-50"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase font-black text-slate-500 flex items-center gap-2">
                <AlertTriangle className={cn(
                   "w-4 h-4",
                   efficiencyData[0]?.costPerKm > fleetAverages.avgCostPerKm * 1.2 ? "text-red-600" : "text-blue-600"
                )} /> Alerta de Desvío Crítico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {efficiencyData.length > 0 ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Unidad {efficiencyData[0].name}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Esta unidad presenta un costo de <span className="font-bold text-red-600">${efficiencyData[0].costPerKm}/KM</span>, lo cual está un {Math.round(((efficiencyData[0].costPerKm / fleetAverages.avgCostPerKm) - 1) * 100)}% por encima del promedio de la flota.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Composición del Gasto:</p>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="flex items-center gap-1"><Fuel size={10} /> Combustible</span>
                      <span className="font-bold">{Math.round((efficiencyData[0].fuelCost / efficiencyData[0].totalCost) * 100)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1"><Wrench size={10} /> Mantenimiento</span>
                      <span className="font-bold">{Math.round((efficiencyData[0].repairCost / efficiencyData[0].totalCost) * 100)}%</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs italic text-slate-400">Sin datos suficientes para análisis de desvío.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-sm">
                <Lightbulb className="w-5 h-5 text-yellow-400" /> Insight Estratégico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs opacity-90 leading-relaxed italic">
                "El 60% de los sobrecostos de la flota se concentran en unidades con más de 10 años. Considere un plan de renovación para los vehículos marcados en rojo en el ranking de eficiencia."
              </p>
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-[10px] mb-2 font-bold uppercase tracking-widest text-white/50">
                  <span>Optimización de Ruta Regional</span>
                  <span>92%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: '92%' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
