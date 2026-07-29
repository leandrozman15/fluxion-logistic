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
  Activity,
  BarChart3,
  ArrowUpRight,
  Truck as TruckIcon,
  Scale,
  TrendingDown,
  User,
  Users,
  Briefcase,
  Navigation
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
  Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, data } = props;
  const truck = data.find((d: any) => d.name === payload.value);
  if (!truck) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      {truck.avatar && (
        <>
          <defs><clipPath id={`clip-${truck.id}`}><rect x="-12" y="5" width="24" height="24" rx="4" /></clipPath></defs>
          <image x="-12" y="5" width="24" height="24" href={truck.avatar} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${truck.id})`} />
        </>
      )}
      <text x="0" y={truck.avatar ? 42 : 15} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight="800" className="font-mono">{truck.name}</text>
    </g>
  );
};

const DriverXAxisTick = (props: any) => {
  const { x, y, payload, data } = props;
  const driver = data.find((d: any) => d.name === payload.value);
  if (!driver) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      {driver.avatar && (
        <>
          <defs><clipPath id={`clip-dr-${driver.id}`}><circle cx="0" cy="17" r="12" /></clipPath></defs>
          <image x="-12" y="5" width="24" height="24" href={driver.avatar} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-dr-${driver.id})`} />
        </>
      )}
      <text x="0" y={driver.avatar ? 42 : 15} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight="800">{driver.name}</text>
    </g>
  );
};

export default function AnalyticsPage() {
  const db = useFirestore();
  const [range, setRange] = useState("30");

  const loadsQuery = useMemo(() => db ? query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(500)) : null, [db]);
  const expensesQuery = useMemo(() => db ? query(collection(db, "global_expenses"), orderBy("createdAt", "desc")) : null, [db]);
  const maintenanceQuery = useMemo(() => db ? query(collection(db, "maintenance"), orderBy("scheduledDate", "desc")) : null, [db]);
  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);
  const clientsQuery = useMemo(() => db ? collection(db, "clients") : null, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: expenses } = useCollection<Expense>(expensesQuery);
  const { data: maintenance } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const fleetData = useMemo(() => {
    if (!trucks) return [];
    return trucks.map(truck => {
      const truckLoads = loads?.filter(l => l.assignedTruckId === truck.id && l.status === 'delivered') || [];
      const revenue = truckLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      const truckExpenses = expenses?.filter(e => e.truckId === truck.id) || [];
      const fuelCost = truckExpenses.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
      const otherRouteCosts = truckExpenses.filter(e => e.category !== 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
      const truckMaintenance = maintenance?.filter(m => m.truckId === truck.id && m.status === 'completed') || [];
      const maintenanceCost = truckMaintenance.reduce((acc, m) => acc + (m.actualCost || m.estimatedCost || 0), 0);
      const fixedCosts = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      const totalVariableCosts = fuelCost + otherRouteCosts + maintenanceCost;
      const totalCosts = totalVariableCosts + fixedCosts;
      const ie = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : (revenue > 0 ? 100 : 0);
      return { id: truck.id, name: truck.plate, avatar: truck.avatarUrl, revenue, totalCosts, totalVariableCosts, fixedCosts, ie: parseFloat(ie.toFixed(1)), margin: revenue - totalCosts, trips: truckLoads.length };
    }).sort((a, b) => b.ie - a.ie);
  }, [trucks, loads, expenses, maintenance]);

  const driversPerformance = useMemo(() => {
    if (!drivers || !loads) return [];
    return drivers
      .filter(d => d.role === 'driver')
      .map(driver => {
        const driverLoads = loads.filter(l => l.assignedDriverId === driver.id && l.status === 'delivered');
        const totalKm = driverLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0);
        return { id: driver.id, name: `${driver.lastName}, ${driver.firstName[0]}.`, avatar: driver.avatarUrl, km: Math.round(totalKm), trips: driverLoads.length };
      })
      .sort((a, b) => b.km - a.km).slice(0, 10);
  }, [drivers, loads]);

  const clientsRevenue = useMemo(() => {
    if (!clients || !loads) return [];
    return clients.map(client => {
      const clientLoads = loads.filter(l => l.clientId === client.id && l.status === 'delivered');
      return { id: client.id, name: client.name, revenue: clientLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0), trips: clientLoads.length };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [clients, loads]);

  const globalStats = useMemo(() => {
    const revenue = fleetData.reduce((acc, d) => acc + d.revenue, 0);
    const costs = fleetData.reduce((acc, d) => acc + d.totalCosts, 0);
    return { revenue, costs, margin: revenue - costs, totalFixed: fleetData.reduce((acc, d) => acc + d.fixedCosts, 0), marginPercent: revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0 };
  }, [fleetData]);

  if (loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Inteligencia de Flota y Costos</h1><p className="text-muted-foreground text-sm">Análisis de rentabilidad real cruzando facturación y gastos.</p></div>
        <Select value={range} onValueChange={setRange}><SelectTrigger className="w-[200px] bg-white"><SelectValue placeholder="Período" /></SelectTrigger><SelectContent><SelectItem value="30">Acumulado Anual 2025</SelectItem></SelectContent></Select>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Facturación Bruta" value={globalStats.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={TrendingUp} />
        <KPICard title="Gastos Estructurales" value={globalStats.totalFixed.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={Activity} />
        <Card className="bg-blue-600 text-white"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold opacity-70">MARGEN OPERATIVO</CardTitle></CardHeader><CardContent><div className="text-2xl font-black">{globalStats.marginPercent.toFixed(1)}%</div></CardContent></Card>
        <Card className="bg-slate-900 text-white"><CardHeader className="pb-2"><CardTitle className="text-xs font-bold opacity-70">LÍDER DE RUTA</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-green-400">{driversPerformance[0]?.name || 'S/D'}</div></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 size={16} /> Facturación vs Costos</CardTitle></CardHeader><CardContent className="h-[350px] pt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={fleetData}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="name" tick={<CustomXAxisTick data={fleetData} />} /><YAxis fontSize={10} /><Tooltip /><Legend /><Bar name="Facturación" dataKey="revenue" fill="#2563eb" /><Bar name="Costos" dataKey="totalCosts" fill="#e2e8f0" /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users size={16} /> Ranking Choferes Profesional (KM)</CardTitle></CardHeader><CardContent className="h-[350px] pt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={driversPerformance}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="name" tick={<DriverXAxisTick data={driversPerformance} />} /><YAxis fontSize={10} /><Tooltip /><Bar name="KM" dataKey="km" fill="#3b82f6" /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
    </div>
  );
}
