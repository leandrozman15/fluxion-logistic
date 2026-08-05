
'use client';

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Truck, MapPin, Navigation, Clock, Gauge, 
  Fuel, ArrowLeft, Activity, ShieldCheck, 
  DollarSign, Zap, Timer, History, FileText, 
  CheckCircle2, AlertTriangle, Printer, Download,
  ExternalLink, BarChart3, TrendingUp, User,
  Loader2, Receipt, Search, XCircle, HandCoins
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from "recharts";
import { Load, Expense, Driver, Truck as TruckType } from "@/app/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatSafeDate, toSafeDate } from "@/lib/utils/date-utils";
import dynamic from "next/dynamic";
import { useToast } from "@/hooks/use-toast";
import { listExpenses, updateExpense } from "@/lib/expenses-api";
import { getLoad } from "@/lib/loads-api";

// Carga dinámica del mapa
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 flex items-center justify-center">Cargando Mapa...</div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

export default function TripReportPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [L, setL] = useState<any>(null);
  const [isUpdatingExpenseId, setIsUpdatingExpenseId] = useState<string | null>(null);
  const [load, setLoad] = useState<Load | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadLoading, setLoadLoading] = useState(true);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId || !id) {
        if (active) {
          setLoad(null);
          setExpenses([]);
          setLoadLoading(false);
        }
        return;
      }

      try {
        if (active) setLoadLoading(true);
        const [loadRow, expenseRows] = await Promise.all([
          getLoad(id as string),
          listExpenses(),
        ]);

        if (!active) return;
        setLoad(loadRow);
        setExpenses(expenseRows.filter((expense) => expense.loadId === (id as string)).sort((a, b) => {
          const aTime = toSafeDate(a.createdAt)?.getTime() || 0;
          const bTime = toSafeDate(b.createdAt)?.getTime() || 0;
          return aTime - bTime;
        }));
      } catch (error) {
        if (active) {
          setLoad(null);
          setExpenses([]);
          toast({ variant: "destructive", title: "Error al cargar reporte", description: (error as Error).message });
        }
      } finally {
        if (active) setLoadLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, id, toast]);

  const stats = useMemo(() => {
    if (!load?.tracking) return { avgSpeed: 0, maxSpeed: 0, totalKm: 0, outboundKm: 0, returnKm: 0, hasReturn: false, totalFuel: 0, fuelCost: 0, otherCost: 0, totalCost: 0, durationMinutes: 0, drivingMinutes: 0, idleMinutes: 0 };
    
    const history = load.tracking.history || [];
    const totalKm = load.tracking.distanceTraveledKm || 0;
    const maxSpeed = load.tracking.maxSpeed || 0;
    
    let sumSpeed = 0;
    let countSpeed = 0;
    history.forEach(p => {
      if (p.speed > 0) {
        sumSpeed += p.speed;
        countSpeed++;
      }
    });

    const avgSpeed = countSpeed > 0 ? sumSpeed / countSpeed : 0;
    
    const start = toSafeDate(load.tracking?.tripStartedAt);
    const end = load.status === 'delivered' 
      ? (toSafeDate(load.proofOfDelivery?.confirmedAt) || toSafeDate(load.updatedAt) || new Date()) 
      : new Date();
    
    let totalMinutes = 0;
    if (start && end) {
      totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    } else if (history.length > 1) {
      const first = toSafeDate(history[0].timestamp);
      const last = toSafeDate(history[history.length - 1].timestamp);
      if (first && last) totalMinutes = (last.getTime() - first.getTime()) / (1000 * 60);
    }

    const drivingMinutes = Math.round(load.tracking.timeOnRouteMinutes || 0);
    const idleMinutes = Math.max(0, Math.round(totalMinutes - drivingMinutes));

    const approvedExpenses = expenses?.filter(e => e.status === 'approved') || [];
    const fuelCost = approvedExpenses.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalFuel = approvedExpenses.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.liters || 0), 0);
    const otherCost = approvedExpenses.filter(e => e.category !== 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);

    const hasReturn = !!load.tracking.returnStartedAt;
    const outboundKm = hasReturn ? (load.tracking.outboundDistanceKm || 0) : totalKm;
    const returnKm = hasReturn ? Math.max(0, totalKm - outboundKm) : 0;

    return {
      avgSpeed: Math.round(avgSpeed),
      maxSpeed: Math.round(maxSpeed),
      totalKm: totalKm.toFixed(1),
      outboundKm: outboundKm.toFixed(1),
      returnKm: returnKm.toFixed(1),
      hasReturn,
      totalFuel: totalFuel.toFixed(1),
      fuelCost,
      otherCost,
      totalCost: fuelCost + otherCost,
      durationMinutes: Math.max(0, Math.round(totalMinutes)),
      drivingMinutes: Math.min(Math.round(totalMinutes), drivingMinutes),
      idleMinutes
    };
  }, [load, expenses]);

  const chartData = useMemo(() => {
    if (!load?.tracking?.history) return [];
    return load.tracking.history.map((p, i) => ({
      index: i,
      time: format(new Date(p.timestamp), "HH:mm"),
      speed: p.speed
    }));
  }, [load]);

  const breadcrumbs = useMemo(() => {
    if (!load?.tracking?.history) return [];
    return load.tracking.history.map(p => [p.lat, p.lng] as [number, number]);
  }, [load?.tracking?.history]);

  const handleUpdateExpenseStatus = async (expId: string, status: 'approved' | 'rejected') => {
    if (!id || !tenantId) return;
    setIsUpdatingExpenseId(expId);
    try {
      await updateExpense(expId, { status });
      setExpenses((prev) => prev.map((expense) => (expense.id === expId ? { ...expense, status } : expense)));
      toast({ title: `Gasto ${status === 'approved' ? 'Aprobado' : 'Rechazado'}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar", description: (e as Error).message });
    } finally {
      setIsUpdatingExpenseId(null);
    }
  };

  const handleUpdateReceiptNumber = async (expId: string, receiptNumber: string) => {
    if (!id || !tenantId) return;
    try {
      await updateExpense(expId, { receiptNumber });
      setExpenses((prev) => prev.map((expense) => (expense.id === expId ? { ...expense, receiptNumber } : expense)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleDocsPresented = async (expId: string, docsPresented: boolean) => {
    if (!id || !tenantId) return;
    try {
      await updateExpense(expId, { docsPresented });
      setExpenses((prev) => prev.map((expense) => (expense.id === expId ? { ...expense, docsPresented } : expense)));
    } catch (e) {
      console.error(e);
    }
  };

  if (loadLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-20 text-center">Flete no encontrado.</div>;

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-1 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  }) : null;

  const initialAdvance = load.budget?.initialAdvance || 0;
  const auditBalance = initialAdvance - stats.totalCost;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Auditoría de Telemetría</h1>
              <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-100">#{load.orderNumber}</Badge>
              <Badge className={cn(
                "border-none uppercase font-black text-[10px]",
                load.status === 'delivered' ? "bg-green-600 text-white" : "bg-orange-50 text-white"
              )}>
                {load.status === 'delivered' ? 'Finalizada' : 'En Curso'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 font-medium">Análisis detallado de la operación logística y desempeño del conductor.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Imprimir Reporte</Button>
           <Button className="bg-blue-600" size="sm"><Download className="mr-2 h-4 w-4" /> Exportar Datos</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white border-none shadow-lg">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Navigation size={20} className="text-blue-400" />
            <p className="text-[10px] uppercase font-bold text-white/50">Kilómetros Totales</p>
            <p className="text-3xl font-black italic">{stats.totalKm} <span className="text-xs font-normal opacity-50 uppercase">km</span></p>
            {stats.hasReturn && (
              <p className="text-[10px] font-bold text-white/60">Ida: {stats.outboundKm} km · Regreso: {stats.returnKm} km</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Timer size={20} className="text-blue-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Duración Jornada</p>
            <p className="text-3xl font-black italic text-slate-800">{stats.durationMinutes} <span className="text-xs font-normal text-slate-400 uppercase">min</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <TrendingUp size={20} className="text-green-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Velocidad Media</p>
            <p className="text-3xl font-black italic text-slate-800">{stats.avgSpeed} <span className="text-xs font-normal text-slate-400 uppercase">km/h</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <HandCoins size={20} className="text-blue-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Anticipo Otorgado</p>
            <p className="text-3xl font-black italic text-slate-800">${initialAdvance.toLocaleString()} <span className="text-xs font-normal text-slate-400 uppercase">ars</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={16} /> Perfil de Velocidad en Tiempo Real
              </CardTitle>
              <CardDescription className="text-xs">Monoreo de estabilidad y cumplimiento de límites legales.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="time" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} unit="km/h" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <ReferenceLine y={90} label={{ position: 'right', value: 'LÍMITE', fontSize: 10, fill: '#ef4444', fontWeight: 'bold' }} stroke="#ef4444" strokeDasharray="3 3" />
                  <Area 
                    type="monotone" 
                    dataKey="speed" 
                    stroke="#2563eb" 
                    fillOpacity={1} 
                    fill="url(#colorSpeed)" 
                    strokeWidth={3} 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
             <CardHeader className="bg-slate-900 text-white">
                <CardTitle className="text-sm flex items-center gap-2"><DollarSign size={16} className="text-green-400" /> Rendición y Auditoría de Gastos</CardTitle>
                <CardDescription className="text-white/40 text-[10px] uppercase font-bold">Verificación de comprobantes físicos y aprobación contable</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b">
                         <tr>
                            <th className="p-4 text-[10px] uppercase font-black text-slate-500">Categoría / Fecha</th>
                            <th className="p-4 text-[10px] uppercase font-black text-slate-500">Lugar / Descrip.</th>
                            <th className="p-4 text-[10px] uppercase font-black text-slate-500">Monto</th>
                            <th className="p-4 text-[10px] uppercase font-black text-slate-500">N° Factura</th>
                            <th className="p-4 text-[10px] uppercase font-black text-slate-500 text-center">Papel OK</th>
                            <th className="p-4 text-[10px] uppercase font-black text-slate-500 text-right">Acción</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {expenses?.map(exp => (
                            <tr key={exp.id} className={cn("hover:bg-slate-50/50", exp.status === 'rejected' && "bg-red-50/30")}>
                               <td className="p-4">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-black text-slate-700 capitalize">{exp.category}</span>
                                     <span className="text-[9px] text-slate-400 font-bold">{formatSafeDate(exp.createdAt, "dd/MM HH:mm")}</span>
                                  </div>
                               </td>
                               <td className="p-4">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-bold text-slate-600 uppercase">{exp.location}</span>
                                     <span className="text-[9px] text-slate-400 truncate max-w-[150px]">{exp.description}</span>
                                  </div>
                               </td>
                               <td className="p-4">
                                  <span className="text-sm font-black text-slate-900">${exp.amount?.toLocaleString()}</span>
                               </td>
                               <td className="p-4">
                                  <Input 
                                    className="h-8 w-24 text-[10px] font-mono font-bold bg-white" 
                                    placeholder="N° Ticket" 
                                    defaultValue={exp.receiptNumber || ''} 
                                    onBlur={(e) => handleUpdateReceiptNumber(exp.id, e.target.value)}
                                  />
                               </td>
                               <td className="p-4 text-center">
                                  <Switch 
                                    checked={!!exp.docsPresented} 
                                    onCheckedChange={(v) => handleToggleDocsPresented(exp.id, v)} 
                                  />
                               </td>
                               <td className="p-4 text-right">
                                  {exp.status === 'registered' ? (
                                     <div className="flex gap-1 justify-end">
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8 text-green-600 hover:bg-green-50" 
                                          onClick={() => handleUpdateExpenseStatus(exp.id, 'approved')}
                                          disabled={isUpdatingExpenseId === exp.id}
                                        >
                                           {isUpdatingExpenseId === exp.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8 text-red-500 hover:bg-red-50" 
                                          onClick={() => handleUpdateExpenseStatus(exp.id, 'rejected')}
                                          disabled={isUpdatingExpenseId === exp.id}
                                        >
                                           <XCircle size={16} />
                                        </Button>
                                     </div>
                                  ) : (
                                     <Badge className={cn(
                                       "text-[8px] font-black uppercase",
                                       exp.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                     )}>
                                        {exp.status === 'approved' ? 'Auditado' : 'Rechazado'}
                                     </Badge>
                                  )}
                               </td>
                            </tr>
                         ))}
                         {(!expenses || expenses.length === 0) && (
                            <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic text-xs">Sin gastos registrados para auditar.</td></tr>
                         )}
                      </tbody>
                   </table>
                </div>

                <div className="p-6 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-6">
                   <div className="flex gap-8">
                      <div className="text-center md:text-left">
                         <p className="text-[10px] font-black text-slate-400 uppercase">Anticipo Original</p>
                         <p className="text-xl font-black italic text-slate-900">${initialAdvance.toLocaleString()}</p>
                      </div>
                      <div className="text-center md:text-left">
                         <p className="text-[10px] font-black text-slate-400 uppercase">Gastos Auditados</p>
                         <p className="text-xl font-black italic text-red-600">-${stats.totalCost.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className={cn(
                      "p-4 rounded-2xl border-2 px-8 text-center",
                      auditBalance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                   )}>
                      <p className="text-[10px] font-black uppercase text-slate-400">Balance Final</p>
                      <p className={cn(
                        "text-3xl font-black italic",
                        auditBalance >= 0 ? "text-green-700" : "text-red-700"
                      )}>
                        ${Math.abs(auditBalance).toLocaleString()}
                      </p>
                      <p className="text-[8px] font-bold uppercase opacity-60">
                        {auditBalance >= 0 ? 'A favor Empresa' : 'Reintegro Chofer'}
                      </p>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-sm">
             <CardHeader className="pb-3 border-b bg-slate-50"><CardTitle className="text-sm">Pruebas de Entrega (POD)</CardTitle></CardHeader>
             <CardContent className="pt-6 space-y-8">
                {load.outboundStops?.map((stop, i) => (
                   <div key={stop.id} className="space-y-4 border-b pb-6 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">{i+1}</div>
                            <div>
                               <p className="text-xs font-black uppercase text-slate-800">{stop.name}</p>
                               <p className="text-[9px] font-bold text-slate-400">{stop.address}</p>
                            </div>
                         </div>
                         {stop.deliveredAt ? (
                            <Badge className="bg-green-600 text-white border-none text-[8px] font-black uppercase">Entregado</Badge>
                         ) : (
                            <Badge variant="outline" className="text-[8px] font-black uppercase">Pendiente</Badge>
                         )}
                      </div>

                      {stop.proofOfDelivery ? (
                         <div className="space-y-4 animate-in fade-in">
                            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border">
                               <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><User size={20}/></div>
                               <div>
                                  <p className="text-[10px] uppercase font-bold text-slate-400">Recibido por</p>
                                  <p className="text-sm font-black uppercase text-slate-900">{stop.proofOfDelivery.receiverName}</p>
                                  <p className="text-[8px] font-bold text-blue-600 uppercase">VALIDADO: {formatSafeDate(stop.proofOfDelivery.confirmedAt)}</p>
                               </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                               <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-400 uppercase text-center">Firma Receptor</p>
                                  <div className="h-20 bg-white border rounded-xl overflow-hidden flex items-center justify-center p-1 shadow-sm">
                                     {stop.proofOfDelivery.receiverSignatureUrl ? (
                                       <img src={stop.proofOfDelivery.receiverSignatureUrl} alt="Firma Receptor" className="max-h-full object-contain" />
                                     ) : <span className="text-[8px] text-slate-300 italic">No disponible</span>}
                                  </div>
                               </div>
                               <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-400 uppercase text-center">Firma Chofer</p>
                                  <div className="h-20 bg-white border rounded-xl overflow-hidden flex items-center justify-center p-1 shadow-sm">
                                     {stop.proofOfDelivery.driverSignatureUrl ? (
                                       <img src={stop.proofOfDelivery.driverSignatureUrl} alt="Firma Chofer" className="max-h-full object-contain" />
                                     ) : <span className="text-[8px] text-slate-300 italic">No disponible</span>}
                                  </div>
                               </div>
                            </div>

                            {stop.proofOfDelivery.photoUrl && (
                               <div className="space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-400 uppercase">Evidencia Fotográfica</p>
                                  <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border shadow-inner">
                                     <img src={stop.proofOfDelivery.photoUrl} alt="POD Evidencia" className="w-full h-full object-cover" />
                                  </div>
                               </div>
                            )}
                         </div>
                      ) : (
                         <div className="py-8 text-center bg-slate-50/50 border-2 border-dashed rounded-2xl">
                            <Clock size={24} className="mx-auto text-slate-200 mb-2" />
                            <p className="text-[10px] font-black text-slate-300 uppercase italic">Esperando confirmación de descarga</p>
                         </div>
                      )}
                   </div>
                ))}
             </CardContent>
           </Card>

           <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="text-blue-600 shrink-0 mt-1" size={20} />
              <p className="text-[10px] text-blue-700 leading-relaxed italic">
                 Este reporte de auditoría centraliza la telemetría GPS, la validación biométrica de entrega y la fiscalización de gastos operativos. Los datos aquí vertidos tienen carácter de declaración oficial para liquidación de fletes.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
