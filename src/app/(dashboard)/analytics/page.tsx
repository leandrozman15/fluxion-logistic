'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Star,
  Zap,
  Target,
  Package
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
  Cell,
  LabelList
} from "recharts";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

/**
 * Componente de Tick Personalizado para el Eje X.
 * Renderiza la foto, patente y modelo de forma fija bajo las barras.
 */
const CustomXAxisTick = ({ x, y, payload, data }: any) => {
  const item = data.find((d: any) => d.plate === payload.value);
  if (!item) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x="-45" y="15" width="90" height="100">
        <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white shadow-md mb-2 bg-white">
            <img 
              src={item.avatarUrl || "https://picsum.photos/seed/truck/200"} 
              className="w-full h-full object-cover" 
              alt=""
            />
          </div>
          <p className="text-[10px] font-black text-slate-900 uppercase leading-none truncate w-full">{item.plate}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase truncate w-full mt-1">{item.model}</p>
        </div>
      </foreignObject>
    </g>
  );
};

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
      .filter(d => d.role === 'driver')
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
      .sort((a, b) => b.km - a.km).reverse().slice(0, 10);
  }, [drivers, loads]);

  if (loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  const globalRevenue = fleetProfitability.reduce((acc, d) => acc + d.revenue, 0);
  const globalFixedCosts = fleetProfitability.reduce((acc, d) => acc + d.fixedCosts, 0);
  const globalVariableCosts = fleetProfitability.reduce((acc, d) => acc + d.variableCosts, 0);
  const globalMargin = globalRevenue - (globalFixedCosts + globalVariableCosts);
  const globalMarginPercent = (globalFixedCosts + globalVariableCosts) > 0 ? (globalMargin / (globalFixedCosts + globalVariableCosts)) * 100 : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tight uppercase">Inteligencia de Flota</h1>
          <p className="text-slate-500 text-sm font-medium">Análisis de rentabilidad real cruzando facturación, gastos fijos y variables.</p>
        </div>
        <div className="bg-white p-1 rounded-xl border shadow-sm flex items-center">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[220px] border-none shadow-none font-bold text-xs uppercase tracking-widest"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Acumulado Anual 2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-xl bg-white overflow-hidden group">
          <CardHeader className="pb-2 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Facturación Bruta</CardTitle>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><TrendingUp size={16} /></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 italic">{globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Fletes entregados</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white overflow-hidden group">
          <CardHeader className="pb-2 space-y-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gastos Estructurales</CardTitle>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-600 group-hover:text-white transition-colors"><Briefcase size={16} /></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 italic">{globalFixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</div>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">Sueldos, seguros, patentes</p>
          </CardContent>
        </Card>

        <Card className={cn("border-none shadow-xl overflow-hidden", globalMargin >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]">Margen Operativo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic">{globalMarginPercent.toFixed(1)}%</div>
            <p className="text-[10px] font-bold uppercase mt-1 opacity-70">
              {globalMargin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} Utilidad Real
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={64} className="fill-blue-500 text-blue-500" /></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Líder de Flota</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
             <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-white/20 shadow-md">
                   <AvatarImage src={driversPerformance[0]?.avatarUrl} className="object-cover" />
                   <AvatarFallback className="bg-blue-600 text-white font-bold">{driversPerformance[0]?.name[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                   <div className="text-sm font-black text-blue-400 truncate uppercase italic">{driversPerformance[0]?.name || 'S/D'}</div>
                   <p className="text-[10px] text-white/50 uppercase font-black">{driversPerformance[0]?.km.toLocaleString() || 0} KM Conducidos</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl lg:col-span-2 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /> Facturación vs. Costos Totales</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Auditoría financiera por unidad operativa activa</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white text-[8px] font-black uppercase">Auditoría Financiera</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-[500px] pt-12">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetProfitability} barGap={12} margin={{ bottom: 120, top: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis 
                  dataKey="plate" 
                  interval={0} 
                  height={100}
                  tick={<CustomXAxisTick data={fleetProfitability} />} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val/1000)}k`} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 40 }} />
                
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]}>
                   <LabelList 
                    dataKey="revenue" 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `$${(val / 1000).toFixed(0)}k` : ''}
                    style={{ fontSize: '10px', fontWeight: '900', fill: '#2563eb' }}
                   />
                </Bar>
                
                <Bar name="Costos Totales" dataKey="totalInvestment" fill="#ef4444" radius={[6, 6, 0, 0]}>
                   <LabelList 
                    dataKey="totalInvestment" 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `$${(val / 1000).toFixed(0)}k` : ''}
                    style={{ fontSize: '10px', fontWeight: '900', fill: '#ef4444' }}
                   />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2"><PieChartIcon size={18} className="text-blue-600" /> Eficiencia de Ruta (KM)</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tramo con carga vs. Regreso vacío.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={efficiencyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {efficiencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-4 w-full mt-4">
               {efficiencyData.map((entry, i) => (
                 <div key={i} className="text-center">
                    <div className="text-xs font-black uppercase text-slate-500">{entry.name}</div>
                    <div className={cn("text-lg font-black italic", i === 0 ? "text-blue-600" : "text-red-500")}>
                      {entry.value.toLocaleString()} <span className="text-[8px] font-normal opacity-50 uppercase">km</span>
                    </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2"><Navigation size={18} className="text-blue-600" /> Leaderboard Choferes</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rendimiento por KM (Choferes Profesionales)</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
             <div className="space-y-5">
                {driversPerformance.map((dr, idx) => (
                  <div key={dr.id} className="flex items-center justify-between group">
                     <div className="flex items-center gap-4">
                        <div className={cn(
                          "text-xs font-black w-6 h-6 rounded-lg flex items-center justify-center",
                          idx === 0 ? "bg-amber-100 text-amber-600 shadow-sm" : "bg-slate-50 text-slate-400"
                        )}>
                          {idx + 1}
                        </div>
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-slate-100">
                           <AvatarImage src={dr.avatarUrl} className="object-cover" />
                           <AvatarFallback className="text-[10px] bg-slate-50 font-bold">{dr.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-black text-slate-700 uppercase italic leading-none">{dr.name}</div>
                          <div className="text-[8px] text-slate-400 font-bold uppercase mt-1">Conductor Habilitado</div>
                        </div>
                     </div>
                     <Badge variant="secondary" className="font-mono text-[10px] font-black bg-blue-50 text-blue-600 border-none px-3">{dr.km.toLocaleString()} KM</Badge>
                  </div>
                ))}
                {driversPerformance.length === 0 && <p className="text-center py-20 text-xs text-slate-400 italic">Esperando datos de tráfico...</p>}
             </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden lg:col-span-2">
           <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-black uppercase tracking-tighter flex items-center gap-2"><Activity size={18} className="text-blue-600" /> Balance Operativo Global</CardTitle>
           </CardHeader>
           <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Ingresos</p>
                 <p className="text-3xl font-black text-blue-600 italic leading-none">{globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inversión Logística</p>
                 <p className="text-3xl font-black text-red-600 italic leading-none">{(globalFixedCosts + globalVariableCosts).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</p>
              </div>
              <div className={cn("p-6 rounded-3xl border shadow-lg space-y-2", globalMargin >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                 <p className={cn("text-[10px] font-black uppercase tracking-widest", globalMargin >= 0 ? "text-green-600" : "text-red-600")}>Utilidad Neta Estimada</p>
                 <p className={cn("text-3xl font-black italic leading-none", globalMargin >= 0 ? "text-green-700" : "text-red-700")}>
                    {globalMargin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
                 </p>
              </div>
           </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black italic tracking-tighter flex items-center gap-3"><Target size={24} className="text-blue-400" /> Auditoría de Rentabilidad por Unidad</CardTitle>
              <CardDescription className="text-white/50 text-[10px] uppercase font-black tracking-widest mt-1">Análisis quirúrgico de cada activo de la organización</CardDescription>
            </div>
            <div className="hidden sm:flex gap-4">
               <div className="text-right">
                  <p className="text-[8px] font-black text-white/30 uppercase">Meta Eficiencia</p>
                  <p className="text-lg font-black text-green-400 leading-none">85%+</p>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-8 py-5 text-[10px] uppercase font-black text-slate-500 tracking-widest">Unidad Operativa</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black text-slate-500 tracking-widest text-center">Fijos/Mes</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black text-slate-500 tracking-widest text-center">Variables (Ruta)</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black text-slate-500 tracking-widest text-center">Inversión Total</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black text-slate-500 tracking-widest text-center">Facturación</th>
                  <th className="px-8 py-5 text-[10px] uppercase font-black text-slate-500 tracking-widest text-right">Índice IE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fleetProfitability.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-4">
                          <div className="relative h-14 w-14 shrink-0 rounded-2xl overflow-hidden border-2 border-white shadow-md shadow-slate-200">
                             <img src={row.avatarUrl || "https://picsum.photos/seed/truck/200"} className="h-full w-full object-cover" />
                          </div>
                          <div>
                             <div className="font-black text-base text-slate-900 font-mono tracking-tighter leading-none group-hover:text-blue-600 transition-colors">{row.plate}</div>
                             <div className="text-[10px] text-slate-400 uppercase font-black mt-1">{row.model}</div>
                             <div className="flex items-center gap-1.5 text-[8px] text-blue-500 font-black uppercase mt-1">
                               <Package size={10}/> {row.trips} Fletes Finalizados
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-6 text-center font-bold text-slate-600 text-sm">{row.fixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-6 text-center font-bold text-slate-600 text-sm">{row.variableCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-6 text-center font-black text-slate-800 text-sm">{row.totalInvestment.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-6 text-center font-black text-blue-600 text-base italic">{row.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-8 py-6 text-right">
                      <Badge className={cn(
                        "text-[10px] uppercase font-black h-8 px-4 border-none italic shadow-sm",
                        row.marginPercent > 20 ? "bg-green-100 text-green-700" : row.marginPercent > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                      )}>
                        {row.marginPercent.toFixed(1)}% {row.marginPercent > 20 ? 'Saludable' : row.marginPercent > 0 ? 'Regular' : 'Crítico'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {fleetProfitability.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-32 text-center text-slate-400 italic font-medium">
                      No hay registros financieros para el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
