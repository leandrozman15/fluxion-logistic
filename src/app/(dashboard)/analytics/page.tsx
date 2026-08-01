
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  Loader2,
  BarChart3,
  Truck as TruckIcon,
  PieChart as PieChartIcon,
  DollarSign,
  Calendar,
  ChevronDown,
  FileSpreadsheet
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
  Cell
} from "recharts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toSafeDate } from "@/lib/utils/date-utils";

const COLORS = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

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

  const { data: allLoads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: allExpenses } = useCollection<Expense>(expensesQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);

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

  const globalRevenue = useMemo(() => filteredData.loads.reduce((acc, l) => acc + (l.totalAmount || 0), 0), [filteredData]);
  const globalExpenses = useMemo(() => filteredData.expenses.reduce((acc, e) => acc + (e.amount || 0), 0), [filteredData]);
  const globalMargin = globalRevenue - globalExpenses;

  if (!mounted || loadsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tight uppercase leading-none">Inteligencia de Flota</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Auditoría financiera y operativa multi-tenant.</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 rounded-2xl border-blue-100 bg-blue-50/30 text-blue-700 font-bold text-[10px] uppercase">
              <Calendar size={14} className="mr-2" /> {selectedMonths.length} Meses seleccionados
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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-slate-400 uppercase">Facturación</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black text-slate-900">${globalRevenue.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-slate-400 uppercase">Gastos</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black text-red-600">${globalExpenses.toLocaleString()}</div></CardContent>
        </Card>
        <Card className={cn("border-none shadow-md", globalMargin >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white")}>
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black opacity-60 uppercase">Margen Operativo</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black italic">${globalMargin.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-md bg-slate-900 text-white">
          <CardHeader className="p-4 pb-1"><CardTitle className="text-[9px] font-black text-white/50 uppercase">Flota Activa</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0"><div className="text-2xl font-black text-blue-400 italic">{trucks?.length || 0} UNI.</div></CardContent>
        </Card>
      </div>
      
      <Card className="border-none shadow-md rounded-3xl overflow-hidden h-[400px]">
         <CardHeader className="bg-slate-50 border-b py-3"><CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2"><BarChart3 size={14} className="text-blue-600" /> Comparativa Ingresos vs Gastos</CardTitle></CardHeader>
         <CardContent className="h-[320px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={[{ name: 'Período Seleccionado', ingresos: globalRevenue, gastos: globalExpenses }]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar name="Ingresos" dataKey="ingresos" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar name="Gastos" dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
               </BarChart>
            </ResponsiveContainer>
         </CardContent>
      </Card>
    </div>
  );
}
