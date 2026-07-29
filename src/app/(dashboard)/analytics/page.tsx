
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  TrendingUp, 
  Loader2,
  Activity,
  BarChart3,
  Truck as TruckIcon,
  Users,
  Navigation,
  PieChart as PieChartIcon,
  AlertTriangle,
  Scale
} from "lucide-react";
import { Load, Expense, Maintenance, Truck, Driver, Client } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b'];

export default function AnalyticsPage() {
  const db = useFirestore();
  const [range, setRange] = useState("30");

  const loadsQuery = useMemo(() => db ? query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(500)) : null, [db]);
  const expensesQuery = useMemo(() => db ? query(collection(db, "global_expenses"), orderBy("createdAt", "desc")) : null, [db]);
  const maintenanceQuery = useMemo(() => db ? query(collection(db, "maintenance"), orderBy("scheduledDate", "desc")) : null, [db]);
  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: expenses } = useCollection<Expense>(expensesQuery);
  const { data: maintenance } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const fleetStats = useMemo(() => {
    if (!loads) return { productiveKm: 0, deadKm: 0, totalKm: 0 };
    
    let productive = 0;
    let dead = 0;

    loads.forEach(load => {
      if (load.status === 'delivered') {
        const total = load.tracking?.distanceTraveledKm || 0;
        // Heurística: Si no hay retorno y no es round trip, el tramo de vuelta (aprox 40%) es muerto
        if (!load.isRoundTrip && (!load.returnStops || load.returnStops.length === 0)) {
           productive += (total * 0.6);
           dead += (total * 0.4);
        } else {
           productive += total;
        }
      }
    });

    return { 
      productiveKm: Math.round(productive), 
      deadKm: Math.round(dead), 
      totalKm: Math.round(productive + dead) 
    };
  }, [loads]);

  const efficiencyData = [
    { name: 'KM Productivos', value: fleetStats.productiveKm },
    { name: 'KM Muertos (Vacío)', value: fleetStats.deadKm },
  ];

  const fleetData = useMemo(() => {
    if (!trucks) return [];
    return trucks.map(truck => {
      const truckLoads = loads?.filter(l => l.assignedTruckId === truck.id && l.status === 'delivered') || [];
      const revenue = truckLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      const truckExpenses = expenses?.filter(e => e.truckId === truck.id) || [];
      const totalVariableCosts = truckExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      const fixedCosts = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      const totalCosts = totalVariableCosts + fixedCosts;
      return { id: truck.id, name: truck.plate, revenue, totalCosts, margin: revenue - totalCosts };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [trucks, loads, expenses]);

  const driversPerformance = useMemo(() => {
    if (!drivers || !loads) return [];
    return drivers
      .filter(d => d.role === 'driver') // EXCLUIR ACOMPAÑANTES
      .map(driver => {
        const driverLoads = loads.filter(l => l.assignedDriverId === driver.id && l.status === 'delivered');
        const totalKm = driverLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0);
        return { id: driver.id, name: `${driver.lastName}, ${driver.firstName[0]}.`, km: Math.round(totalKm) };
      })
      .sort((a, b) => b.km - a.km).slice(0, 10);
  }, [drivers, loads]);

  if (loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  const globalRevenue = fleetData.reduce((acc, d) => acc + d.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inteligencia y Eficiencia de Flota</h1>
          <p className="text-muted-foreground text-sm">Análisis de rentabilidad y auditoría de kilómetros muertos.</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[200px] bg-white"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent><SelectItem value="30">Acumulado Anual 2025</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Facturación Bruta" value={globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={TrendingUp} />
        <KPICard title="Kilometraje Total" value={`${fleetStats.totalKm.toLocaleString()} KM`} icon={Navigation} />
        <Card className="bg-red-50 border-red-100">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-red-600 uppercase">KM Improductivos (Vacío)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-700">{fleetStats.deadKm.toLocaleString()} KM</div>
            <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Pérdida por falta de retorno</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold opacity-70 uppercase">Líder de Ruta</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black text-blue-400">{driversPerformance[0]?.name || 'S/D'}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><PieChartIcon size={16} className="text-blue-600" /> Eficiencia de Ruta (KM)</CardTitle>
            <CardDescription>Comparativa entre tramos con carga vs. tramos vacíos.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={efficiencyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {efficiencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 size={16} className="text-blue-600" /> Facturación por Unidad</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
