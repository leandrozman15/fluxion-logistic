
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
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
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  X
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
  LabelList
} from "recharts";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toSafeDate } from "@/lib/utils/date-utils";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

const MONTHS = [
  { id: 0, name: "Enero" }, { id: 1, name: "Febrero" }, { id: 2, name: "Marzo" }, { id: 3, name: "Abril" },
  { id: 4, name: "Mayo" }, { id: 5, name: "Junio" }, { id: 6, name: "Julio" }, { id: 7, name: "Agosto" },
  { id: 8, name: "Septiembre" }, { id: 9, name: "Octubre" }, { id: 10, name: "Noviembre" }, { id: 11, name: "Diciembre" },
];

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
  const { tenantId } = useTenant();
  const [mounted, setMounted] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [isInterannualOpen, setIsInterannualOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSelectedMonths([new Date().getMonth()]);
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
      return date && selectedMonths.includes(date.getMonth()) && (date.getFullYear() === 2026);
    });

    const expenses = allExpenses?.filter(e => {
      const date = toSafeDate(e.createdAt);
      return date && selectedMonths.includes(date.getMonth()) && (date.getFullYear() === 2026);
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
      
      const monthlyFixed = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      const fixedCosts = monthlyFixed * Math.max(1, selectedMonths.length);
      
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
      .sort((a, b) => b.km - a.km).slice(0, 10);
  }, [drivers, filteredData]);

  const globalRevenue = fleetProfitability.reduce((acc, d) => acc + d.revenue, 0);
  const globalFixedCosts = fleetProfitability.reduce((acc, d) => acc + d.fixedCosts, 0);
  const globalVariableCosts = fleetProfitability.reduce((acc, d) => acc + d.variableCosts, 0);
  const globalMargin = globalRevenue - (globalFixedCosts + globalVariableCosts);
  const globalMarginPercent = (globalFixedCosts + globalVariableCosts) > 0 ? (globalMargin / (globalFixedCosts + globalVariableCosts)) * 100 : 0;

  const comparisonData = [
    { year: '2025', revenue: 48500000, investment: 41200000, km: 115000, margin: 17.7 },
    { year: '2026', revenue: globalRevenue * (12/Math.max(1, selectedMonths.length)), investment: (globalFixedCosts + globalVariableCosts) * (12/Math.max(1, selectedMonths.length)), km: fleetStats.totalKm * (12/Math.max(1, selectedMonths.length)), margin: globalMarginPercent }
  ];

  if (!mounted || loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase leading-none">Inteligencia de Flota y Costos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Auditoría en tiempo real de rentabilidad y eficiencia 2026</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 rounded-2xl border-amber-200 bg-amber-50 text-amber-700 font-black text-[10px] uppercase tracking-widest gap-2" onClick={() => setIsInterannualOpen(true)}>
            <FileSpreadsheet size={14} /> Informe Interanual
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[240px] justify-between font-black text-[10px] uppercase tracking-widest h-10 rounded-2xl border-blue-100 bg-blue-50/30 text-blue-700">
                <div className="flex items-center gap-2"><Calendar size={14} className="text-blue-600" /> {selectedMonths.length === 12 ? 'Acumulado Anual 2026' : `${selectedMonths.length} Meses seleccionados`}</div>
                <ChevronDown size={14} className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 rounded-2xl shadow-2xl border-none" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 border-b pb-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Seleccionar Período 2026</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-blue-600" onClick={() => setSelectedMonths(selectedMonths.length === 12 ? [] : MONTHS.map(m => m.id))}>
                    {selectedMonths.length === 12 ? 'Limpiar' : 'Todo el año'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1 max-h-[300px] overflow-y-auto pr-1">
                  {MONTHS.map(month => (
                    <div key={month.id} className={cn("flex items-center space-x-2 p-2 rounded-xl transition-all cursor-pointer", selectedMonths.includes(month.id) ? "bg-blue-50" : "hover:bg-slate-50")} onClick={() => setSelectedMonths(prev => prev.includes(month.id) ? prev.filter(m => m !== month.id) : [...prev, month.id])}>
                      <Checkbox id={`month-${month.id}`} checked={selectedMonths.includes(month.id)} onCheckedChange={() => {}} />
                      <label className="text-[10px] font-bold uppercase text-slate-600 cursor-pointer flex-1">{month.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facturación Bruta</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black text-slate-900 italic">{globalRevenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</div></CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos Estructurales</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black text-slate-900 italic">{globalFixedCosts.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</div></CardContent>
        </Card>
        <Card className={cn("border-none shadow-md overflow-hidden", globalMargin >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black opacity-60 uppercase tracking-widest">Margen Operativo (%)</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black italic">{globalMarginPercent.toFixed(1)}%</div></CardContent>
        </Card>
        <Card className="border-none shadow-md bg-slate-900 text-white overflow-hidden">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-white/50 uppercase tracking-widest">KM Totales (F) </CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black text-blue-400 italic">{fleetStats.totalKm.toLocaleString()} KM</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md lg:col-span-3 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b py-3"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 size={14} className="text-blue-600" /> Facturación vs. Costos Totales</CardTitle></CardHeader>
          <CardContent className="h-[520px] pt-10 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetProfitability} barGap={12} margin={{ bottom: 120, top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="plate" interval={0} height={120} tick={<CustomXAxisTick data={fleetProfitability} />} axisLine={false} tickLine={false} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={(val) => `$${(val/1000)}k`} />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: '900', paddingBottom: 30 }} />
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="Costos Totales" dataKey="totalInvestment" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-1">
          <Card className="border-none shadow-md rounded-3xl overflow-hidden h-[240px]">
            <CardHeader className="bg-slate-50/50 border-b py-3"><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><PieChartIcon size={14} className="text-blue-600" /> Eficiencia de Ruta</CardTitle></CardHeader>
            <CardContent className="h-[180px] flex items-center justify-center p-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={efficiencyData} cx="50%" cy="55%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                    {efficiencyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => [`${val.toLocaleString()} KM`, "Total"]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Dialog open={isInterannualOpen} onOpenChange={setIsInterannualOpen}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl">
           <div className="bg-slate-900 text-white p-8 pb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp size={160} /></div>
              <div className="relative z-10"><DialogHeader><DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3"><TrendingUp className="text-blue-400" size={28} /> Auditoría Interanual Consolidada</DialogTitle></DialogHeader></div>
           </div>
           <div className="p-8 bg-slate-50 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="h-[250px] bg-white p-4 rounded-3xl border shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis dataKey="year" axisLine={false} tickLine={false} fontSize={10} fontStyle="italic" />
                          <YAxis hide />
                          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#2563eb" barSize={40} />
                          <Bar dataKey="investment" radius={[6, 6, 0, 0]} fill="#ef4444" barSize={40} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
