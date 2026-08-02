
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  TrendingUp, 
  Loader2,
  BarChart3,
  Truck as TruckIcon,
  PieChart as PieChartIcon,
  DollarSign,
  Calendar,
  Navigation,
  User,
  AlertTriangle,
  Scale,
  Fuel,
  ArrowRight,
  ChevronRight,
  Trophy,
  Activity
} from "lucide-react";
import { Load, Expense, Truck, Driver } from "@/app/lib/types";
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
  AreaChart,
  Area
} from "recharts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toSafeDate } from "@/lib/utils/date-utils";
import { calculateDistance } from "@/lib/utils/tracking-math";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1'];

const MONTHS = [
  { id: 0, name: "Enero" }, { id: 1, name: "Febrero" }, { id: 2, name: "Marzo" }, { id: 3, name: "Abril" },
  { id: 4, name: "Mayo" }, { id: 5, name: "Junio" }, { id: 6, name: "Julio" }, { id: 7, name: "Agosto" },
  { id: 8, name: "Septiembre" }, { id: 9, name: "Octubre" }, { id: 10, name: "Noviembre" }, { id: 11, name: "Diciembre" },
];

export default function AnalyticsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const [mounted, setMounted] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "loads"), orderBy("createdAt", "desc"), limit(1000)) : null, [db, tenantId]);
  const expensesQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "expenses"), orderBy("createdAt", "desc")) : null, [db, tenantId]);
  const trucksQuery = useMemo(() => (db && tenantId) ? collection(db, "tenants", tenantId, "trucks") : null, [db, tenantId]);
  const driversQuery = useMemo(() => (db && tenantId) ? collection(db, "tenants", tenantId, "drivers") : null, [db, tenantId]);

  const { data: allLoads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: allExpenses } = useCollection<Expense>(expensesQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

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

  // Cálculos Financieros
  const globalRevenue = useMemo(() => filteredData.loads.reduce((acc, l) => acc + (l.totalAmount || 0), 0), [filteredData]);
  const globalExpenses = useMemo(() => filteredData.expenses.reduce((acc, e) => acc + (e.amount || 0), 0), [filteredData]);
  const globalMargin = globalRevenue - globalExpenses;

  // Análisis de Eficiencia Operativa (KM Muertos y Consumo)
  const operationalStats = useMemo(() => {
    let totalRealKm = 0;
    let totalPlannedKm = 0;
    let totalLiters = 0;

    filteredData.loads.forEach(load => {
      totalRealKm += (load.tracking?.distanceTraveledKm || 0);
      
      // Cálculo de KM Planificados (Hoja de Ruta)
      if (load.origin.lat && load.origin.lng) {
        let planned = 0;
        let lastPos = { lat: load.origin.lat, lng: load.origin.lng };
        load.outboundStops.forEach(s => {
          if (s.lat && s.lng) {
            planned += calculateDistance(lastPos.lat, lastPos.lng, s.lat, s.lng);
            lastPos = { lat: s.lat, lng: s.lng };
          }
        });
        totalPlannedKm += planned;
      }
    });

    filteredData.expenses.filter(e => e.category === 'fuel' && e.status === 'approved').forEach(e => {
      totalLiters += (e.liters || 0);
    });

    const deadKm = Math.max(0, totalRealKm - totalPlannedKm);
    const deadKmPercent = totalRealKm > 0 ? (deadKm / totalRealKm) * 100 : 0;
    const avgConsumption = totalLiters > 0 ? totalRealKm / totalLiters : 0;

    return { totalRealKm, totalPlannedKm, deadKm, deadKmPercent, totalLiters, avgConsumption };
  }, [filteredData]);

  // Ranking de Choferes
  const driverRanking = useMemo(() => {
    if (!drivers || !filteredData.loads) return [];

    const ranking = drivers.map(driver => {
      const driverLoads = filteredData.loads.filter(l => l.assignedDriverId === driver.id);
      const driverExpenses = filteredData.expenses.filter(e => e.driverId === driver.id && e.status === 'approved');
      
      const revenue = driverLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      const costs = driverExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
      const km = driverLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0);
      const trips = driverLoads.filter(l => l.status === 'delivered').length;

      return {
        id: driver.id,
        name: `${driver.lastName}, ${driver.firstName}`,
        avatar: driver.avatarUrl,
        trips,
        km: Math.round(km),
        revenue,
        margin: revenue - costs,
        efficiency: km > 0 ? revenue / km : 0
      };
    }).filter(d => d.trips > 0 || d.km > 0).sort((a, b) => b.margin - a.margin);

    return ranking;
  }, [drivers, filteredData]);

  // Distribución de Gastos por Categoría
  const expenseDistribution = useMemo(() => {
    const categories: Record<string, number> = {};
    filteredData.expenses.filter(e => e.status === 'approved').forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + e.amount;
    });

    return Object.entries(categories).map(([name, value]) => ({ 
      name: name.toUpperCase(), 
      value 
    })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  if (!mounted || loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] border shadow-sm">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-blue-400 shadow-xl border border-blue-500/20">
              <BarChart3 size={32} />
           </div>
           <div>
             <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Inteligencia de Flota</h1>
             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Auditoría financiera y operativa v3.0</p>
           </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-12 px-6 rounded-2xl border-blue-100 bg-blue-50/30 text-blue-700 font-black text-[10px] uppercase">
              <Calendar size={14} className="mr-2" /> {selectedMonths.length} MESES EN AUDITORÍA
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 rounded-2xl shadow-2xl border-none">
             <div className="grid grid-cols-2 gap-1 p-2">
                {MONTHS.map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedMonths(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}>
                     <Checkbox checked={selectedMonths.includes(m.id)} />
                     <span className="text-[10px] font-bold uppercase text-slate-600">{m.name}</span>
                  </div>
                ))}
             </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* KPIs FINANCIEROS */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-slate-400 uppercase">Facturación Total</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
             <div className="text-2xl font-black text-slate-900 tracking-tighter">${globalRevenue.toLocaleString()}</div>
             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Ingresos brutos declarados</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-slate-400 uppercase">Gastos de Viaje</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
             <div className="text-2xl font-black text-red-600 tracking-tighter">-${globalExpenses.toLocaleString()}</div>
             <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Tickets auditados y aprobados</p>
          </CardContent>
        </Card>
        <Card className={cn("border-none shadow-xl", globalMargin >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black opacity-60 uppercase">Margen Operativo</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
             <div className="text-3xl font-black italic tracking-tighter">${globalMargin.toLocaleString()}</div>
             <div className="flex items-center gap-1 mt-1 opacity-70">
                <TrendingUp size={10} />
                <span className="text-[8px] font-bold uppercase">Eficiencia: {globalRevenue > 0 ? Math.round((globalMargin/globalRevenue)*100) : 0}%</span>
             </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-slate-900 text-white">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-white/50 uppercase">Flota en Servicio</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
             <div className="text-2xl font-black text-blue-400 italic tracking-tighter">{trucks?.length || 0} UNIDADES</div>
             <p className="text-[8px] font-bold text-white/20 uppercase mt-1">Activos registrados en tenant</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GRÁFICO DE BALANCE */}
        <Card className="lg:col-span-8 border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
           <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2"><BarChart3 size={16} className="text-blue-600" /> Balance de Operación</CardTitle>
                <CardDescription className="text-[8px] font-bold uppercase">Comparativa temporal de ingresos vs egresos directos</CardDescription>
              </div>
           </CardHeader>
           <CardContent className="h-[350px] pt-10">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={[{ name: 'Período Seleccionado', ingresos: globalRevenue, gastos: globalExpenses }]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <Bar name="Ingresos de Flete" dataKey="ingresos" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar name="Gastos Auditados" dataKey="gastos" fill="#ef4444" radius={[6, 6, 0, 0]} />
                 </BarChart>
              </ResponsiveContainer>
           </CardContent>
        </Card>

        {/* DISTRIBUCIÓN DE GASTOS */}
        <Card className="lg:col-span-4 border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
           <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2"><PieChartIcon size={16} className="text-blue-600" /> Desglose de Gastos</CardTitle>
           </CardHeader>
           <CardContent className="h-[350px] flex flex-col items-center justify-center p-6">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseDistribution} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {expenseDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-2 mt-6">
                 {expenseDistribution.slice(0, 4).map((item, index) => (
                   <div key={item.name} className="flex justify-between items-center text-[9px] font-black uppercase">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-500">{item.name}</span>
                      </div>
                      <span className="text-slate-900">${item.value.toLocaleString()}</span>
                   </div>
                 ))}
              </div>
           </CardContent>
        </Card>

        {/* ANÁLISIS DE EFICIENCIA (KM MUERTOS) */}
        <Card className="lg:col-span-6 border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
           <CardHeader className="p-8 border-b border-white/5">
              <CardTitle className="text-sm uppercase font-black tracking-widest text-blue-400 flex items-center gap-2"><Activity size={18} /> Auditoría de Kilómetros Muertos</CardTitle>
              <CardDescription className="text-[9px] font-bold uppercase text-white/30">Desvío real vs. Planificación logística</CardDescription>
           </CardHeader>
           <CardContent className="p-8 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">KM Totales Reales</p>
                    <p className="text-4xl font-black italic tracking-tighter text-blue-400">{Math.round(operationalStats.totalRealKm).toLocaleString()} <span className="text-xs font-normal opacity-50">km</span></p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">KM Planificados</p>
                    <p className="text-4xl font-black italic tracking-tighter">{Math.round(operationalStats.totalPlannedKm).toLocaleString()} <span className="text-xs font-normal opacity-50">km</span></p>
                 </div>
              </div>

              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6">
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[10px] font-black uppercase text-red-400 tracking-widest">KMS FUERA DE RUTA</p>
                       <p className="text-5xl font-black italic tracking-tighter text-red-400">+{Math.round(operationalStats.deadKm)} <span className="text-sm font-normal opacity-50">km</span></p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black uppercase text-white/30">Índice Desvío</p>
                       <p className="text-2xl font-black text-red-500 italic">{operationalStats.deadKmPercent.toFixed(1)}%</p>
                    </div>
                 </div>
                 <Progress value={operationalStats.deadKmPercent} className="h-2 bg-white/10" />
                 <p className="text-[10px] text-white/40 italic leading-relaxed">
                   * El "KM Muerto" representa la distancia recorrida que no estaba prevista en las hojas de ruta oficiales de LogísticaAr. Un desvío mayor al 15% requiere auditoría de supervisión.
                 </p>
              </div>
           </CardContent>
        </Card>

        {/* RANKING DE CHOFERES */}
        <Card className="lg:col-span-6 border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
           <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Ranking de Performance</CardTitle>
                <CardDescription className="text-[8px] font-bold uppercase text-slate-400">Líderes de eficiencia y rentabilidad</CardDescription>
              </div>
              <Badge className="bg-slate-900 text-white border-none font-black text-[10px]">TOP {driverRanking.length}</Badge>
           </CardHeader>
           <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                 {driverRanking.slice(0, 5).map((d, i) => (
                   <div key={d.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className={cn(
                           "w-10 h-10 rounded-full flex items-center justify-center font-black italic",
                           i === 0 ? "bg-amber-100 text-amber-600 border-2 border-amber-300" : "bg-slate-100 text-slate-400"
                         )}>
                            {i + 1}
                         </div>
                         <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border shadow-sm">
                               <AvatarImage src={d.avatar} />
                               <AvatarFallback className="bg-blue-50 text-blue-600 text-[10px] font-bold">{d.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                               <p className="text-xs font-black uppercase text-slate-900 italic tracking-tighter">{d.name}</p>
                               <p className="text-[8px] font-bold text-slate-400 uppercase">{d.trips} Viajes finalizados</p>
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-8">
                         <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase">KM Recorridos</p>
                            <p className="text-sm font-black text-slate-700 italic">{d.km.toLocaleString()}</p>
                         </div>
                         <div className="text-right min-w-[80px]">
                            <p className="text-[8px] font-black text-green-600 uppercase">Margen Real</p>
                            <p className="text-sm font-black text-green-600 italic">${Math.round(d.margin).toLocaleString()}</p>
                         </div>
                         <ChevronRight className="text-slate-200" size={16} />
                      </div>
                   </div>
                 ))}
                 {driverRanking.length === 0 && (
                   <div className="p-20 text-center text-slate-300 italic text-xs font-bold uppercase tracking-widest">Sin datos suficientes para generar ranking.</div>
                 )}
              </div>
           </CardContent>
        </Card>
      </div>

      {/* NOTA DE AUDITORÍA */}
      <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex items-start gap-4">
         <ShieldCheck size={24} className="text-blue-600 shrink-0 mt-1" />
         <div className="space-y-1">
            <p className="text-xs font-black text-blue-800 uppercase italic">Certificación de Inteligencia de Datos</p>
            <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
               Este panel consolida información de telemetría GPS, registros de carga y auditoría de gastos en tiempo real. Los "Kilómetros Muertos" se calculan mediante la diferencia entre la ruta lógica más corta entre puntos y el recorrido real transmitido por el dispositivo del conductor.
            </p>
         </div>
      </div>
    </div>
  );
}
