
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
  Package,
  Calendar,
  ChevronDown,
  CheckCircle2
} from "lucide-react";
import { Load, Expense, Truck, Driver, Client } from "@/app/lib/types";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toSafeDate } from "@/lib/utils/date-utils";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

const MONTHS = [
  { id: 0, name: "Enero" },
  { id: 1, name: "Febrero" },
  { id: 2, name: "Marzo" },
  { id: 3, name: "Abril" },
  { id: 4, name: "Mayo" },
  { id: 5, name: "Junio" },
  { id: 6, name: "Julio" },
  { id: 7, name: "Agosto" },
  { id: 8, name: "Septiembre" },
  { id: 9, name: "Octubre" },
  { id: 10, name: "Noviembre" },
  { id: 11, name: "Diciembre" },
];

/**
 * Componente de Tick Personalizado para el Eje X.
 * Maximiza el espacio mostrando foto y 3 renglones de texto.
 */
const CustomXAxisTick = ({ x, y, payload, data }: any) => {
  const item = data.find((d: any) => d.plate === payload.value);
  if (!item) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x="-45" y="10" width="90" height="110">
        <div xmlns="http://www.w3.org/1999/xhtml" className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm mb-1 bg-white">
            <img 
              src={item.avatarUrl || "https://picsum.photos/seed/truck/200"} 
              className="w-full h-full object-cover" 
              alt=""
            />
          </div>
          <p className="text-[9px] font-black text-slate-900 uppercase leading-tight truncate w-full">{item.plate}</p>
          <p className="text-[8px] text-blue-600 font-bold uppercase truncate w-full leading-none">{item.brand}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase truncate w-full leading-none mt-0.5">{item.model}</p>
        </div>
      </foreignObject>
    </g>
  );
};

export default function AnalyticsPage() {
  const db = useFirestore();
  const [selectedMonths, setSelectedMonths] = useState<number[]>(MONTHS.map(m => m.id));

  const loadsQuery = useMemo(() => db ? query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(500)) : null, [db]);
  const expensesQuery = useMemo(() => db ? query(collection(db, "global_expenses"), orderBy("createdAt", "desc")) : null, [db]);
  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);

  const { data: allLoads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: allExpenses } = useCollection<Expense>(expensesQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  // Filtrado de datos por meses seleccionados
  const filteredData = useMemo(() => {
    if (!allLoads) return { loads: [], expenses: [] };

    const loads = allLoads.filter(l => {
      const date = toSafeDate(l.pickupDate) || toSafeDate(l.createdAt);
      return date && selectedMonths.includes(date.getMonth());
    });

    const expenses = allExpenses?.filter(e => {
      const date = toSafeDate(e.createdAt);
      return date && selectedMonths.includes(date.getMonth());
    }) || [];

    return { loads, expenses };
  }, [allLoads, allExpenses, selectedMonths]);

  const fleetStats = useMemo(() => {
    const { loads } = filteredData;
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
  }, [filteredData]);

  const efficiencyData = [
    { name: 'KM Productivos', value: fleetStats.productiveKm },
    { name: 'KM Muertos', value: fleetStats.deadKm },
  ];

  const fleetProfitability = useMemo(() => {
    if (!trucks) return [];
    const { loads, expenses } = filteredData;

    return trucks.map(truck => {
      const truckLoads = loads.filter(l => l.assignedTruckId === truck.id && l.status === 'delivered');
      const revenue = truckLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      const truckExpenses = expenses.filter(e => e.truckId === truck.id);
      const totalVariableCosts = truckExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      
      // Costo fijo prorrateado por meses seleccionados
      const monthlyFixed = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      const fixedCosts = monthlyFixed * selectedMonths.length;
      
      const totalInvestment = totalVariableCosts + fixedCosts;
      const margin = revenue - totalInvestment;
      const marginPercent = totalInvestment > 0 ? (margin / totalInvestment) * 100 : 0;

      return {
        id: truck.id,
        plate: truck.plate,
        brand: truck.brand,
        model: truck.model,
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
  }, [trucks, filteredData, selectedMonths]);

  const driversPerformance = useMemo(() => {
    if (!drivers || !filteredData.loads) return [];
    const { loads } = filteredData;

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
      .sort((a, b) => b.km - a.km).slice(0, 5);
  }, [drivers, filteredData]);

  if (loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  const globalRevenue = fleetProfitability.reduce((acc, d) => acc + d.revenue, 0);
  const globalFixedCosts = fleetProfitability.reduce((acc, d) => acc + d.fixedCosts, 0);
  const globalVariableCosts = fleetProfitability.reduce((acc, d) => acc + d.variableCosts, 0);
  const globalMargin = globalRevenue - (globalFixedCosts + globalVariableCosts);
  const globalMarginPercent = (globalFixedCosts + globalVariableCosts) > 0 ? (globalMargin / (globalFixedCosts + globalVariableCosts)) * 100 : 0;

  const toggleMonth = (monthId: number) => {
    setSelectedMonths(prev => 
      prev.includes(monthId) ? prev.filter(m => m !== monthId) : [...prev, monthId]
    );
  };

  const isAnnual = selectedMonths.length === 12;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase leading-none">Inteligencia de Flota y Costos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Auditoría en tiempo real de rentabilidad y eficiencia</p>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between font-black text-[10px] uppercase tracking-widest h-9 rounded-xl">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-blue-600" />
                {isAnnual ? 'Acumulado Anual 2025' : `${selectedMonths.length} Meses seleccionados`}
              </div>
              <ChevronDown size={14} className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 rounded-2xl" align="end">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 border-b pb-2 mb-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Seleccionar Período</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[8px] font-black uppercase text-blue-600"
                  onClick={() => setSelectedMonths(isAnnual ? [] : MONTHS.map(m => m.id))}
                >
                  {isAnnual ? 'Limpiar' : 'Todo el año'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {MONTHS.map(month => (
                  <div key={month.id} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded-lg transition-colors">
                    <Checkbox 
                      id={`month-${month.id}`} 
                      checked={selectedMonths.includes(month.id)} 
                      onCheckedChange={() => toggleMonth(month.id)}
                    />
                    <label htmlFor={`month-${month.id}`} className="text-[10px] font-bold uppercase text-slate-600 cursor-pointer flex-1">
                      {month.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facturación Bruta</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 italic">{globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos Estructurales</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-slate-900 italic">{globalFixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>

        <Card className={cn("border-none shadow-md overflow-hidden", globalMargin >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[9px] font-black opacity-60 uppercase tracking-widest">Margen Operativo (%)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black italic">{globalMarginPercent.toFixed(1)}%</div>
            <p className="text-[8px] font-bold uppercase opacity-70 mt-1">
              {globalMargin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} ganancia real
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-slate-900 text-white overflow-hidden">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[9px] font-black text-white/50 uppercase tracking-widest">Líderes de Ruta</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
             <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border border-white/20">
                   <AvatarImage src={driversPerformance[0]?.avatarUrl} className="object-cover" />
                   <AvatarFallback className="bg-blue-600 text-white font-bold text-[10px]">{driversPerformance[0]?.name[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                   <div className="text-xs font-black text-blue-400 truncate uppercase italic">{driversPerformance[0]?.name || 'S/D'}</div>
                   <p className="text-[8px] text-white/50 uppercase font-bold">{driversPerformance[0]?.km.toLocaleString() || 0} KM recorridos</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md lg:col-span-3 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14} className="text-blue-600" /> Facturación vs. Costos Totales</CardTitle>
                <CardDescription className="text-[8px] font-bold uppercase text-slate-400">Comparativa de ingresos y egresos por camión</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white text-[8px] font-black uppercase">Auditoría Financiera</Badge>
            </div>
          </CardHeader>
          <CardContent className="h-[480px] pt-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetProfitability} barGap={8} margin={{ bottom: 110, top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis 
                  dataKey="plate" 
                  interval={0} 
                  height={110}
                  tick={<CustomXAxisTick data={fleetProfitability} />} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val/1000)}k`} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', paddingBottom: 20 }} />
                
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]}>
                   <LabelList 
                    dataKey="revenue" 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `$${(val / 1000).toFixed(0)}k` : ''}
                    style={{ fontSize: '9px', fontWeight: '900', fill: '#2563eb' }}
                   />
                </Bar>
                
                <Bar name="Costos Totales" dataKey="totalInvestment" fill="#ef4444" radius={[4, 4, 0, 0]}>
                   <LabelList 
                    dataKey="totalInvestment" 
                    position="top" 
                    formatter={(val: number) => val > 0 ? `$${(val / 1000).toFixed(0)}k` : ''}
                    style={{ fontSize: '9px', fontWeight: '900', fill: '#ef4444' }}
                   />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-1">
          <Card className="border-none shadow-md rounded-3xl overflow-hidden h-[240px]">
            <CardHeader className="bg-slate-50/50 border-b py-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><PieChartIcon size={14} className="text-blue-600" /> Eficiencia de Ruta</CardTitle>
            </CardHeader>
            <CardContent className="h-[170px] flex items-center justify-center p-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={efficiencyData}
                    cx="50%"
                    cy="55%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {efficiencyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md rounded-3xl overflow-hidden h-[284px]">
            <CardHeader className="bg-slate-50/50 border-b py-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Navigation size={14} className="text-blue-600" /> Ranking de Choferes por KM</CardTitle>
              <CardDescription className="text-[8px] font-bold uppercase text-slate-400">Kilometraje total acumulado por conductor</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
               <div className="space-y-3">
                  {driversPerformance.map((dr, idx) => (
                    <div key={dr.id} className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border shadow-sm">
                             <AvatarImage src={dr.avatarUrl} className="object-cover" />
                             <AvatarFallback className="text-[8px] font-bold">{dr.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="text-[10px] font-black text-slate-700 uppercase italic leading-none">{dr.name}</div>
                       </div>
                       <Badge variant="secondary" className="font-mono text-[9px] font-black bg-blue-50 text-blue-600 border-none">{dr.km.toLocaleString()} KM</Badge>
                    </div>
                  ))}
                  {driversPerformance.length === 0 && (
                    <p className="text-center py-10 text-[10px] text-slate-400 italic">Sin actividad en este período.</p>
                  )}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-none shadow-md rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b py-3">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Activity size={14} className="text-blue-600" /> Balance Operativo Global</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Ingresos</p>
              <p className="text-xl font-black text-blue-600 italic leading-none mt-1">{globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</p>
           </div>
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Egresos</p>
              <p className="text-xl font-black text-red-600 italic leading-none mt-1">{(globalFixedCosts + globalVariableCosts).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</p>
           </div>
           <div className={cn("p-4 rounded-2xl border shadow-sm", globalMargin >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
              <p className={cn("text-[8px] font-black uppercase tracking-widest", globalMargin >= 0 ? "text-green-600" : "text-red-600")}>Utilidad Neta Estimada</p>
              <p className={cn("text-xl font-black italic leading-none mt-1", globalMargin >= 0 ? "text-green-700" : "text-red-700")}>
                 {globalMargin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}
              </p>
              <div className="text-[8px] font-bold uppercase mt-1 opacity-60">{globalMarginPercent.toFixed(1)}% Margen Promedio</div>
           </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-900 text-white py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black italic tracking-tighter flex items-center gap-2"><Target size={18} className="text-blue-400" /> Auditoría Detallada de Rentabilidad</CardTitle>
            <div className="text-right">
               <p className="text-[8px] font-black text-white/30 uppercase">Período: {selectedMonths.length} Meses</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-[9px] uppercase font-black text-slate-500 tracking-widest">Camión</th>
                  <th className="px-4 py-4 text-[9px] uppercase font-black text-slate-500 tracking-widest text-center">Fijos Período</th>
                  <th className="px-4 py-4 text-[9px] uppercase font-black text-slate-500 tracking-widest text-center">Ruta (Variables)</th>
                  <th className="px-4 py-4 text-[9px] uppercase font-black text-slate-500 tracking-widest text-center">Inversión Total</th>
                  <th className="px-4 py-4 text-[9px] uppercase font-black text-slate-500 tracking-widest text-center">Facturación</th>
                  <th className="px-6 py-4 text-[9px] uppercase font-black text-slate-500 tracking-widest text-right">Índice IE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fleetProfitability.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden border shadow-sm">
                             <img src={row.avatarUrl || "https://picsum.photos/seed/truck/200"} className="h-full w-full object-cover" />
                          </div>
                          <div>
                             <div className="font-black text-sm text-slate-900 font-mono tracking-tighter leading-none">{row.plate}</div>
                             <div className="flex items-center gap-1 text-[8px] text-blue-500 font-black uppercase mt-1">
                               <Package size={10}/> {row.trips} fletes finalizados
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600 text-xs">{row.fixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600 text-xs">{row.variableCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-4 text-center font-black text-slate-800 text-xs">{row.totalInvestment.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-4 text-center font-black text-blue-600 text-sm italic">{row.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-4 text-right">
                      <Badge className={cn(
                        "text-[8px] uppercase font-black h-6 px-3 border-none italic",
                        row.marginPercent > 20 ? "bg-green-100 text-green-700" : row.marginPercent > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                      )}>
                        {row.marginPercent.toFixed(1)}% {row.marginPercent > 20 ? 'Saludable' : row.marginPercent > 0 ? 'Regular' : 'Crítico'}
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
