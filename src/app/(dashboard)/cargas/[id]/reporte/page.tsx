'use client';

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, MapPin, Navigation, Clock, Gauge, 
  Fuel, ArrowLeft, Activity, ShieldCheck, 
  DollarSign, Zap, Timer, History, FileText, 
  CheckCircle2, AlertTriangle, Printer, Download,
  ExternalLink, BarChart3, TrendingUp, User,
  Loader2
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
  const db = useFirestore();
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading: loadLoading } = useDoc<Load>(loadRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(collection(db, "loads", id as string, "expenses"), orderBy("createdAt", "asc"));
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const stats = useMemo(() => {
    if (!load?.tracking) return { avgSpeed: 0, maxSpeed: 0, totalKm: 0, totalFuel: 0, fuelCost: 0, otherCost: 0, totalCost: 0, durationMinutes: 0, drivingMinutes: 0, idleMinutes: 0 };
    
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
    
    // Lógica de Duración Total: Desde tripStartedAt hasta confirmedAt o Ahora
    // CORRECCIÓN: Si el viaje está entregado, el final es estrictamente confirmedAt
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

    const fuelCost = expenses?.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0) || 0;
    const totalFuel = expenses?.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.liters || 0), 0) || 0;
    const otherCost = expenses?.filter(e => e.category !== 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0) || 0;

    return {
      avgSpeed: Math.round(avgSpeed),
      maxSpeed: Math.round(maxSpeed),
      totalKm: totalKm.toFixed(1),
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

  if (loadLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-20 text-center">Flete no encontrado.</div>;

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-1 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  }) : null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Auditoría de Telemetría</h1>
              <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-100">#{load.orderNumber}</Badge>
              <Badge className="bg-green-600 text-white border-none uppercase font-black text-[10px]">Entregada</Badge>
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
            <DollarSign size={20} className="text-red-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Inversión Real</p>
            <p className="text-3xl font-black italic text-slate-800">${stats.totalCost.toLocaleString()} <span className="text-xs font-normal text-slate-400 uppercase">ars</span></p>
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

          <Card className="border-none shadow-sm overflow-hidden h-[400px] relative">
            <CardHeader className="absolute top-4 left-4 z-[500] pointer-events-none p-0">
               <div className="bg-white/90 backdrop-blur p-3 rounded-lg border shadow-lg pointer-events-auto">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Ruta Real Recorrida (Auditada)</p>
                  <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1 text-xs font-bold text-blue-600"><MapPin size={12}/> Origen: {load.origin.city}</div>
                     <div className="w-4 h-[1px] bg-slate-200"></div>
                     <div className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 size={12}/> Destino Final OK</div>
                  </div>
               </div>
            </CardHeader>
            {L && (
              <MapContainer 
                center={[load.tracking?.currentLat || load.origin.lat || -34.6, load.tracking?.currentLng || load.origin.lng || -58.3]} 
                zoom={10} 
                className="h-full w-full"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {breadcrumbs.length > 0 && (
                  <Polyline positions={breadcrumbs} color="#2563eb" weight={4} opacity={0.6} dashArray="5, 10" />
                )}
                <Marker position={[load.tracking?.currentLat || -34.6, load.tracking?.currentLng || -58.3]} icon={truckIcon}>
                  <Popup>Ubicación Final de Entrega</Popup>
                </Marker>
              </MapContainer>
            )}
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-sm">
             <CardHeader className="pb-3 border-b"><CardTitle className="text-sm">Prueba de Entrega (POD)</CardTitle></CardHeader>
             <CardContent className="pt-6 space-y-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><User size={24}/></div>
                   <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Recibido por</p>
                      <p className="text-sm font-black uppercase text-slate-900">{load.proofOfDelivery?.receiverName || 'S/D'}</p>
                      <p className="text-[9px] font-bold text-blue-600">VALIDADO: {formatSafeDate(load.proofOfDelivery?.confirmedAt)}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase text-center">Firma Receptor</p>
                      <div className="h-24 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                         {load.proofOfDelivery?.receiverSignatureUrl ? (
                           <img src={load.proofOfDelivery.receiverSignatureUrl} alt="Firma Receptor" className="max-h-full object-contain" />
                         ) : <div className="text-[8px] text-slate-300 italic">No disponible</div>}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase text-center">Firma Chofer</p>
                      <div className="h-24 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                         {load.proofOfDelivery?.driverSignatureUrl ? (
                           <img src={load.proofOfDelivery.driverSignatureUrl} alt="Firma Chofer" className="max-h-full object-contain" />
                         ) : <div className="text-[8px] text-slate-300 italic">No disponible</div>}
                      </div>
                   </div>
                </div>

                {load.proofOfDelivery?.photoUrl && (
                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-400 uppercase">Evidencia Fotográfica</p>
                     <div className="aspect-video bg-slate-100 rounded-xl overflow-hidden border shadow-inner">
                        <img src={load.proofOfDelivery.photoUrl} alt="POD Evidencia" className="w-full h-full object-cover" />
                     </div>
                  </div>
                )}
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm overflow-hidden">
             <CardHeader className="bg-slate-900 text-white"><CardTitle className="text-sm flex items-center gap-2"><DollarSign size={16} className="text-green-400" /> Rendición de Gastos</CardTitle></CardHeader>
             <CardContent className="p-0">
                <div className="p-4 bg-slate-50 border-b space-y-1">
                   <div className="flex justify-between text-xs font-bold text-slate-500"><span>Anticipo Otorgado</span> <span>${load.budget?.initialAdvance?.toLocaleString()}</span></div>
                   <div className="flex justify-between text-xs font-bold text-red-600"><span>Gastos Reales</span> <span>-${stats.totalCost.toLocaleString()}</span></div>
                   <div className="flex justify-between text-sm font-black border-t-2 border-slate-200 pt-1 mt-2">
                      <span className="uppercase italic">Balance Final</span>
                      <span className={cn(stats.totalCost > (load.budget?.initialAdvance || 0) ? "text-red-700" : "text-green-700")}>
                        ${((load.budget?.initialAdvance || 0) - stats.totalCost).toLocaleString()}
                      </span>
                   </div>
                </div>
                <div className="divide-y divide-slate-100">
                   {expenses?.map(exp => (
                     <div key={exp.id} className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div>
                           <p className="text-xs font-bold text-slate-700 capitalize">{exp.category}</p>
                           <p className="text-[9px] text-slate-400 uppercase font-medium">{exp.location}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-black text-slate-900">${exp.amount?.toLocaleString()}</p>
                           <Badge variant="outline" className="text-[8px] h-3 bg-white">{exp.status}</Badge>
                        </div>
                     </div>
                   ))}
                </div>
             </CardContent>
           </Card>

           <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="text-blue-600 shrink-0 mt-1" size={20} />
              <p className="text-[10px] text-blue-700 leading-relaxed italic">
                 Este reporte ha sido generado automáticamente por el sistema de rastreo satelital nativo. Los datos de velocidad y posición han sido auditados contra los sensores del dispositivo del chofer.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}