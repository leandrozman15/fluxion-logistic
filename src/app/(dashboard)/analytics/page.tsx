
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
  Scale,
  DollarSign,
  Briefcase,
  User,
  Star
} from "lucide-react";
import { Load, Expense, Truck, Driver, Client } from "@/app/lib/types";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b'];

export default function AnalyticsPage() {
  const db = useFirestore();
  const [range, setRange] = useState("30");

  const loadsQuery = useMemo(() => db ? query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(500)) : null, [db]);
  const expensesQuery = useMemo(() => db ? query(collection(db, "global_expenses"), orderBy("createdAt", "desc")) : null, [db]);
  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);
  const clientsQuery = useMemo(() => db ? collection(db, "clients") : null, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: expenses } = useCollection<Expense>(expensesQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const fleetStats = useMemo(() => {
    if (!loads) return { productiveKm: 0, deadKm: 0, totalKm: 0 };
    
    let productive = 0;
    let dead = 0;

    loads.forEach(load => {
      if (load.status === 'delivered') {
        const total = load.tracking?.distanceTraveledKm || 0;
        // Si no es ida y vuelta, se estima un 40% de km muertos (regreso vacío)
        if (!load.isRoundTrip) {
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

  const fleetProfitability = useMemo(() => {
    if (!trucks) return [];
    return trucks.map(truck => {
      const truckLoads = loads?.filter(l => l.assignedTruckId === truck.id && l.status === 'delivered') || [];
      const revenue = truckLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      const truckExpenses = expenses?.filter(e => e.truckId === truck.id) || [];
      const totalVariableCosts = truckExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      
      const fixedCosts = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      const totalInvestment = totalVariableCosts + fixedCosts;
      const margin = revenue - totalInvestment;
      const marginPercent = totalInvestment > 0 ? (margin / totalInvestment) * 100 : 0;

      return {
        id: truck.id,
        plate: truck.plate,
        model: `${truck.brand} ${truck.model}`,
        avatarUrl: truck.avatarUrl,
        fixedCosts,
        variableCosts: totalVariableCosts,
        totalInvestment,
        revenue,
        margin,
        marginPercent,
        trips: truckLoads.length
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [trucks, loads, expenses]);

  const driversPerformance = useMemo(() => {
    if (!drivers || !loads) return [];
    return drivers
      .filter(d => d.role === 'driver') // Solo choferes, no acompañantes
      .map(driver => {
        const driverLoads = loads.filter(l => l.assignedDriverId === driver.id && l.status === 'delivered');
        const totalKm = driverLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0);
        return { 
          id: driver.id, 
          name: `${driver.lastName}, ${driver.firstName[0]}.`, 
          avatarUrl: driver.avatarUrl,
          km: Math.round(totalKm) 
        };
      })
      .sort((a, b) => b.km - a.km).slice(0, 10);
  }, [drivers, loads]);

  const clientRevenue = useMemo(() => {
    if (!clients || !loads) return [];
    return clients.map(client => {
      const revenue = loads
        .filter(l => (l.clientId === client.id || l.clientName === client.name) && l.status === 'delivered')
        .reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      return { name: client.name, value: revenue };
    }).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [clients, loads]);

  if (loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  const globalRevenue = fleetProfitability.reduce((acc, d) => acc + d.revenue, 0);
  const globalFixedCosts = fleetProfitability.reduce((acc, d) => acc + d.fixedCosts, 0);
  const globalVariableCosts = fleetProfitability.reduce((acc, d) => acc + d.variableCosts, 0);
  const globalMargin = globalRevenue - (globalFixedCosts + globalVariableCosts);
  const globalMarginPercent = (globalFixedCosts + globalVariableCosts) > 0 ? (globalMargin / (globalFixedCosts + globalVariableCosts)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inteligencia de Flota y Costos</h1>
          <p className="text-muted-foreground text-sm">Análisis de rentabilidad real cruzando facturación, gastos fijos y variables.</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[200px] bg-white"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent><SelectItem value="30">Acumulado Anual 2025</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Facturación Bruta" value={globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={TrendingUp} description="Fletes entregados" />
        <KPICard title="Gastos Estructurales" value={globalFixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={Briefcase} description="Sueldos, seguros, patentes" />
        <Card className={cn(globalMargin >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-slate-500 uppercase">Margen Operativo (%)</CardTitle></CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black", globalMargin >= 0 ? "text-green-700" : "text-red-700")}>
              {globalMarginPercent.toFixed(1)}%
            </div>
            <p className={cn("text-[10px] font-bold uppercase mt-1", globalMargin >= 0 ? "text-green-600" : "text-red-600")}>
              {globalMargin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} ganancia real
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold opacity-70 uppercase">Líder de Flota</CardTitle></CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-white/20">
                   <AvatarImage src={driversPerformance[0]?.avatarUrl} className="object-cover" />
                   <AvatarFallback><User size={16} /></AvatarFallback>
                </Avatar>
                <div>
                   <div className="text-sm font-black text-blue-400 truncate">{driversPerformance[0]?.name || 'S/D'}</div>
                   <p className="text-[10px] opacity-50 uppercase font-bold">{driversPerformance[0]?.km.toLocaleString() || 0} KM recorridos</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 size={16} className="text-blue-600" /> Facturación vs. Costos Totales</CardTitle>
            <CardDescription>Comparativa de ingresos y egresos por camión</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetProfitability}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="plate" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip 
                  formatter={(value: any) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                />
                <Legend />
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="Costos Totales" dataKey="totalInvestment" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><PieChartIcon size={16} className="text-blue-600" /> Eficiencia de Ruta (KM)</CardTitle>
            <CardDescription>Tramo con carga vs. Regreso vacío.</CardDescription>
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
            <CardTitle className="text-sm flex items-center gap-2"><Navigation size={16} className="text-blue-600" /> Ranking de Choferes por KM</CardTitle>
            <CardDescription>Kilometraje acumulado (Solo Choferes Profesionales)</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
             <div className="space-y-4">
                {driversPerformance.map((dr, idx) => (
                  <div key={dr.id} className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="text-xs font-bold text-slate-400 w-4">{idx + 1}°</div>
                        <Avatar className="h-8 w-8 border">
                           <AvatarImage src={dr.avatarUrl} className="object-cover" />
                           <AvatarFallback className="text-[10px] bg-slate-50">{dr.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="text-xs font-bold text-slate-700">{dr.name}</div>
                     </div>
                     <Badge variant="secondary" className="font-mono text-[10px]">{dr.km.toLocaleString()} KM</Badge>
                  </div>
                ))}
                {driversPerformance.length === 0 && <p className="text-center py-10 text-xs text-slate-400 italic">Sin datos de viajes.</p>}
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Users size={16} className="text-blue-600" /> Facturación por Cliente</CardTitle>
            <CardDescription>Ingresos generados por cuenta de cliente</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={clientRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                  {clientRevenue.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: any) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-slate-50">
          <CardHeader><CardTitle className="text-sm">Balance Operativo Global</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-xs text-slate-500">Total Ingresos</span>
              <span className="text-lg font-black text-blue-600">{globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-xs text-slate-500">Total Egresos</span>
              <span className="text-lg font-black text-red-600">{(globalFixedCosts + globalVariableCosts).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-white p-3 rounded-lg shadow-sm">
              <span className="text-xs font-bold">Utilidad Neta</span>
              <span className={cn("text-xl font-black", globalMargin >= 0 ? "text-green-600" : "text-red-600")}>
                {globalMargin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
              </span>
            </div>
            <div className="text-[10px] text-center font-bold text-slate-400 uppercase">
              {globalMarginPercent.toFixed(1)}% Margen Promedio Flota
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Auditoría Detallada de Rentabilidad por Unidad</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-[10px] uppercase font-bold text-slate-500">Camión / Unidad</th>
                  <th className="p-4 text-[10px] uppercase font-bold text-slate-500">Gastos Fijos</th>
                  <th className="p-4 text-[10px] uppercase font-bold text-slate-500">Variables (Ruta)</th>
                  <th className="p-4 text-[10px] uppercase font-bold text-slate-500">Inversión Total</th>
                  <th className="p-4 text-[10px] uppercase font-bold text-slate-500">Facturación</th>
                  <th className="p-4 text-[10px] uppercase font-bold text-slate-500 text-right">Índice IE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fleetProfitability.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                       <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 rounded-lg border">
                             <AvatarImage src={row.avatarUrl} className="object-cover" />
                             <AvatarFallback className="bg-blue-50 text-blue-600 rounded-lg"><TruckIcon size={20} /></AvatarFallback>
                          </Avatar>
                          <div>
                             <div className="font-bold text-sm text-slate-900">{row.plate}</div>
                             <div className="text-[9px] text-slate-400 uppercase font-bold">{row.model}</div>
                             <div className="text-[8px] text-blue-500 font-bold uppercase">{row.trips} fletes entregados</div>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-600">{row.fixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td className="p-4 text-sm font-medium text-slate-600">{row.variableCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td className="p-4 text-sm font-bold text-slate-700">{row.totalInvestment.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td className="p-4 text-sm font-black text-blue-600">{row.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td className="p-4 text-right">
                      <Badge className={cn(
                        "text-[9px] uppercase font-black",
                        row.marginPercent > 20 ? "bg-green-600" : row.marginPercent > 0 ? "bg-blue-600" : "bg-red-600"
                      )}>
                        {row.marginPercent.toFixed(1)}% {row.marginPercent > 0 ? 'Saludable' : 'Crítico'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
