
'use client';

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Truck as TruckIcon, 
  Package, 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Plus, 
  Activity, 
  Building2, 
  Loader2, 
  Globe, 
  Clock, 
  ArrowRight, 
  Navigation, 
  User, 
  Scale, 
  Timer, 
  Route as RouteIcon,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  Repeat,
  AlertTriangle,
  Zap,
  Gauge,
  History,
  Phone,
  Radio,
  TrendingUp,
  ArrowRightLeft,
  CalendarDays,
  Anchor,
  CirclePlay,
  XCircle,
  CircleCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Truck, Driver, Load, Hub, Client } from "@/app/lib/types";
import { isToday, startOfMonth, format, formatDistanceToNow, addMinutes, addDays, isAfter, isBefore, startOfDay, endOfDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { estimateFuelLiters } from "@/lib/utils/tracking-math";
import { toSafeDate, formatSafeDate } from "@/lib/utils/date-utils";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin" /></div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });

export default function MonitorOperativoPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [L, setL] = useState<any>(null);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [agendaTab, setAgendaTab] = useState<string>("today");

  const [isDockDialogOpen, setIsDockDialogOpen] = useState(false);
  const [selectedLoadForDock, setSelectedLoadForDock] = useState<Load | null>(null);
  const [selectedDock, setSelectedDock] = useState<string>("");
  const [isUpdatingDock, setIsUpdatingDock] = useState(false);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "trucks");
  }, [db]);

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const hubsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "hubs");
  }, [db]);

  const clientsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "clients");
  }, [db]);

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "drivers");
  }, [db]);

  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const nextWeekStr = format(addDays(today, 7), "yyyy-MM-dd");

  const stats = useMemo(() => {
    const monthStart = startOfMonth(today);

    const deliveredToday = loads?.filter(l => 
      l.status === 'delivered' && 
      (l.updatedAt?.seconds ? isToday(new Date(l.updatedAt.seconds * 1000)) : isToday(new Date(l.updatedAt)))
    ).length || 0;

    const scheduledToday = loads?.filter(l => l.pickupDate === todayStr).length || 0;
    const onRouteCount = loads?.filter(l => l.status === 'on_route' || l.status === 'on_pause').length || 0;
    const activeTrucks = trucks?.filter(t => t.status === 'in_trip').length || 0;
    
    const billingMonth = loads?.filter(l => 
      l.status === 'delivered' && 
      (l.updatedAt?.seconds ? new Date(l.updatedAt.seconds * 1000) >= monthStart : new Date(l.updatedAt) >= monthStart)
    ).reduce((acc, l) => acc + (l.totalAmount || 0), 0) || 0;

    const incidents = loads?.filter(l => l.status === 'incident').length || 0;

    return { 
      deliveredToday, 
      scheduledToday,
      onRouteCount,
      activeTrucks: Math.max(activeTrucks, onRouteCount), 
      billingMonth, 
      incidents
    };
  }, [trucks, loads, todayStr, today]);

  const filteredAgenda = useMemo(() => {
    if (!loads) return [];
    
    return loads.filter(l => {
      const updateDate = l.updatedAt?.seconds ? new Date(l.updatedAt.seconds * 1000) : new Date(l.updatedAt);
      const isUpdatedToday = isToday(updateDate);
      const isActive = l.status === 'on_route' || l.status === 'on_pause' || l.status === 'incident';

      if (agendaTab === 'today') {
        const isScheduledToday = l.pickupDate === todayStr;
        const isFinishedToday = l.status === 'delivered' && isUpdatedToday;
        return (isScheduledToday || isActive || isFinishedToday) && l.status !== 'cancelled';
      }
      
      if (agendaTab === 'tomorrow') {
        return l.pickupDate === tomorrowStr && l.status !== 'cancelled';
      }
      
      if (agendaTab === 'week') {
        return l.pickupDate >= todayStr && l.pickupDate <= nextWeekStr && l.status !== 'cancelled';
      }
      
      return false;
    }).sort((a, b) => {
      const isAActive = a.status === 'on_route' || a.status === 'on_pause';
      const isBActive = b.status === 'on_route' || b.status === 'on_pause';
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;
      
      const dateA = `${a.pickupDate} ${a.pickupTime}`;
      const dateB = `${b.pickupDate} ${b.pickupTime}`;
      return dateA.localeCompare(dateB);
    });
  }, [loads, agendaTab, todayStr, tomorrowStr, nextWeekStr]);

  const handleDockAssignment = async () => {
    if (!db || !selectedLoadForDock || !selectedDock) return;
    setIsUpdatingDock(true);
    try {
      await updateDoc(doc(db, "loads", selectedLoadForDock.id), {
        "origin.dockName": selectedDock,
        "dockEntryAuthorized": true,
        "dockEntryMessage": `AUTORIZADO: Diríjase a ${selectedDock}`,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Vía Libre Enviada", description: `El chofer ha sido notificado para ingresar a ${selectedDock}.` });
      setIsDockDialogOpen(false);
      setSelectedDock("");
    } catch (e) {
      toast({ variant: "destructive", title: "Error al asignar boca" });
    } finally {
      setIsUpdatingDock(false);
    }
  };

  const handleRevokeDock = async (load: Load) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "loads", load.id), {
        "dockEntryAuthorized": false,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Vía Libre Revocada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const calculateETA = (distanceRemaining: number | undefined, currentSpeed: number | undefined) => {
    if (distanceRemaining && (currentSpeed === undefined || currentSpeed < 1)) return "DETENIDO";
    if (!distanceRemaining && currentSpeed && currentSpeed >= 1) return "EN MOVIMIENTO";
    if (!distanceRemaining || !currentSpeed || currentSpeed < 1) return "CALCULANDO...";
    const hours = distanceRemaining / currentSpeed;
    const etaDate = addMinutes(new Date(), Math.round(hours * 60));
    return format(etaDate, "HH:mm") + " hs";
  };

  const calculateEfficiency = (load: Load) => {
    if (load.status === 'delivered') return 100;
    const alerts = load.tracking?.alerts?.length || 0;
    const base = 100;
    const speedPenalty = (load.tracking?.maxSpeed || 0) > 90 ? 15 : 0;
    return Math.max(0, base - (alerts * 10) - speedPenalty);
  };

  const getReconstructedStats = (load: Load) => {
    const tracking = load.tracking;
    const start = toSafeDate(tracking?.tripStartedAt);
    const end = load.status === 'delivered' 
      ? (toSafeDate(load.proofOfDelivery?.confirmedAt) || toSafeDate(load.updatedAt) || new Date()) 
      : new Date();
    
    let totalMin = 0;
    if (start && end) {
      totalMin = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    } else if (tracking?.history && tracking.history.length > 1) {
      const first = toSafeDate(tracking.history[0].timestamp);
      const last = toSafeDate(tracking.history[tracking.history.length - 1].timestamp);
      if (first && last) {
        totalMin = Math.round((last.getTime() - first.getTime()) / (1000 * 60));
      }
    }

    const driving = Math.round(tracking?.timeOnRouteMinutes || 0);
    const stopped = Math.max(0, totalMin - driving);
    
    let maxV = Math.round(tracking?.maxSpeed || 0);
    let fuel = tracking?.estimatedFuelLiters || 0;
    
    if (maxV === 0 && tracking?.history && tracking.history.length > 0) {
      maxV = Math.max(...tracking.history.map(p => p.speed || 0));
    }
    
    if (fuel === 0 && tracking?.distanceTraveledKm) {
      fuel = (tracking.distanceTraveledKm * 32) / 100;
    }

    return { 
      total: Math.max(0, totalMin),
      driving: Math.min(totalMin, driving),
      stopped: Math.max(0, totalMin - driving), 
      maxV, 
      fuel: fuel.toFixed(1) 
    };
  };

  /**
   * Componente interno para mostrar la línea de estado visual de la ruta
   */
  const RouteStatusLine = ({ load }: { load: Load }) => {
    const isStarted = load.status !== 'pending' && load.status !== 'assigned';
    const isFinished = load.status === 'delivered';
    const stops = load.outboundStops || [];
    
    // Encontrar la última parada entregada
    const lastDeliveredIdx = stops.reduce((acc, s, idx) => s.deliveredAt ? idx : acc, -1);
    const nextStopIdx = lastDeliveredIdx + 1;
    const isReturnPhase = isStarted && !isFinished && lastDeliveredIdx === stops.length - 1;

    return (
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {/* Origen (Base) */}
          <div className={cn(
            "w-3 h-3 rounded-full shrink-0 flex items-center justify-center transition-all",
            !isStarted ? "bg-red-500" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
          )}>
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
          
          {/* Flecha a P1 */}
          <ArrowRight 
            size={12} 
            className={cn(
              "shrink-0",
              !isStarted ? "text-slate-200" : 
              (lastDeliveredIdx >= 0 || isFinished) ? "text-green-500" : "text-blue-500 animate-pulse"
            )} 
          />

          {/* Destino (Si hay paradas) */}
          {stops.length > 0 && (
            <>
              <div className={cn(
                "w-3 h-3 rounded-full shrink-0 transition-all",
                lastDeliveredIdx >= 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-200"
              )} />
              
              <ArrowRight 
                size={12} 
                className={cn(
                  "shrink-0",
                  !isStarted ? "text-slate-200" :
                  isFinished ? "text-green-500" : 
                  isReturnPhase ? "text-blue-500 animate-pulse" : 
                  lastDeliveredIdx >= 0 ? "text-blue-400" : "text-slate-300"
                )} 
              />
            </>
          )}

          {/* Destino Final (Cierre) */}
          <div className={cn(
            "w-3 h-3 rounded-full shrink-0 transition-all",
            isFinished ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-200"
          )} />

          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate ml-1">
            {isFinished ? `Finalizado en ${load.returnDestination?.name || 'Base'}` : 
             !isStarted ? `Sede: ${load.origin.name}` :
             isReturnPhase ? `Retorno a Base` :
             `A: ${stops[nextStopIdx]?.name || 'Destino'}`}
          </span>
        </div>

        {/* ETA GPS Dinámico */}
        {(load.status === 'on_route' || load.status === 'on_pause') && load.tracking && (
          <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 w-fit px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
             <Zap size={10} className="animate-pulse fill-current" /> 
             ETA GPS: {calculateETA(load.tracking.distanceRemainingKm, load.tracking.currentSpeed)}
          </div>
        )}
      </div>
    );
  };

  const hubIcon = (isMain: boolean) => L ? L.divIcon({
    className: 'custom-hub-icon',
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900 dark:bg-slate-800'} text-white p-2 rounded-lg shadow-xl border-2 border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>'}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  }) : null;

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }) : null;

  const clientIcon = L ? L.divIcon({
    className: 'custom-client-icon',
    html: `<div class="bg-green-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h10a2 2 0 0 1 1.79 1.1L21 9"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  }) : null;

  if (!mounted) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Globe size={16} /> Red Regional: {trucks?.length || 0} Unidades</span>
            <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold"><Activity size={16} /> {stats.onRouteCount} Operativos</span>
            <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><Building2 size={16} /> {clients?.length || 0} Clientes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-md" asChild>
              <Link href="/cargas/nuevo"><Plus size={16} className="mr-1" /> Nuevo Flete</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Entregas Hoy" value={stats.deliveredToday} icon={CheckCircle2} description="Finalizadas" />
        <KPICard title="Salidas Hoy" value={stats.scheduledToday} icon={Calendar} description="Programadas" />
        <KPICard title="Operativos" value={stats.onRouteCount} icon={TruckIcon} description="En tránsito o pausa" />
        <KPICard title="Facturación" value={stats.billingMonth.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={DollarSign} description="Mes actual" />
        <KPICard title="Incidencias" value={stats.incidents} icon={AlertTriangle} description="Atención req." />
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="pb-3 border-b bg-slate-50 dark:bg-slate-900/50">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div>
               <CardTitle className="text-lg flex items-center gap-2">
                 <CalendarDays className="w-5 h-5 text-blue-600" /> Agenda Operativa
               </CardTitle>
               <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Control de despacho y planificación semanal</CardDescription>
             </div>
             
             <Tabs value={agendaTab} onValueChange={setAgendaTab} className="w-full md:w-auto">
               <TabsList className="bg-white dark:bg-slate-800 border h-9">
                 <TabsTrigger value="today" className="text-[10px] font-bold uppercase">Hoy (Todo)</TabsTrigger>
                 <TabsTrigger value="tomorrow" className="text-[10px] font-bold uppercase">Mañana</TabsTrigger>
                 <TabsTrigger value="week" className="text-[10px] font-bold uppercase">Semana</TabsTrigger>
               </TabsList>
             </Tabs>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="divide-y divide-slate-100 dark:divide-slate-800">
             {filteredAgenda.map(load => {
               const driver = drivers?.find(d => d.id === load.assignedDriverId);
               const truck = trucks?.find(t => t.id === load.assignedTruckId);
               const isExpanded = expandedLoadId === load.id;
               const tracking = load.tracking;
               const efficiency = calculateEfficiency(load);
               const progress = tracking ? (tracking.distanceTraveledKm / (tracking.distanceTraveledKm + (tracking.distanceRemainingKm || 1))) * 100 : (load.status === 'delivered' ? 100 : 0);
               const times = getReconstructedStats(load);

               return (
                 <Collapsible 
                   key={load.id} 
                   open={isExpanded} 
                   onOpenChange={() => setExpandedLoadId(isExpanded ? null : load.id)}
                   className="group transition-all"
                 >
                   <div className={cn(
                     "px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between transition-colors cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-800/30",
                     isExpanded && "bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-600"
                   )}>
                      <div className="flex items-center gap-5 flex-1 min-w-0" onClick={() => setExpandedLoadId(isExpanded ? null : load.id)}>
                         <div className={cn(
                           "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all shadow-sm",
                           load.status === 'on_route' ? "bg-blue-600 text-white border-blue-400" : 
                           load.status === 'on_pause' ? "bg-orange-50 text-white border-orange-300" :
                           load.status === 'delivered' ? "bg-green-100 text-green-600 border-green-200" :
                           "bg-white dark:bg-slate-800 text-slate-400 border-slate-200"
                         )}>
                           {load.status === 'on_route' ? <Navigation size={24} className="animate-pulse" /> : 
                            load.status === 'on_pause' ? <History size={24} /> : 
                            load.status === 'delivered' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                         </div>
                         
                         <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tighter">{load.orderNumber}</p>
                              
                              {load.status === 'on_route' ? (
                                <div className="flex items-center gap-1.5">
                                   <span className="relative flex h-2 w-2">
                                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                     <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                   </span>
                                   <Badge className="text-[8px] bg-green-600 text-white border-none px-2 h-4 uppercase font-bold">LIVE GPS</Badge>
                                </div>
                              ) : load.status === 'on_pause' ? (
                                <div className="flex items-center gap-1.5">
                                   <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                   <Badge className="text-[8px] bg-orange-500 text-white border-none px-2 h-4 uppercase font-bold">PAUSA: {tracking?.lastPauseType || 'Descanso'}</Badge>
                                </div>
                              ) : load.status === 'delivered' ? (
                                <Badge className="text-[8px] bg-green-600 text-white border-none px-2 h-4 uppercase font-bold">Entregada</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[8px] uppercase font-black text-slate-400 h-4 border-slate-300">{load.status.replace('_', ' ')}</Badge>
                              )}
                              
                              {load.pickupDate !== todayStr && (
                                <Badge variant="secondary" className="text-[8px] uppercase font-bold h-4">
                                  {format(parseISO(load.pickupDate), "dd MMM", { locale: es })}
                                </Badge>
                              )}
                            </div>
                            
                            {/* NUEVA LÍNEA DE ESTADO VISUAL DE RUTA */}
                            <RouteStatusLine load={load} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 flex-[2] w-full lg:w-auto mt-4 lg:mt-0 border-t lg:border-t-0 pt-4 lg:pt-0">
                         <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Personal y Unidad</p>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                                <User size={10} className="text-blue-500" /> {driver ? `${driver.lastName}, ${driver.firstName[0]}.` : 'Sin Chofer'}
                              </p>
                              <p className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                <ShieldCheck size={10} className="inline mr-1" /> {truck?.plate || 'Sin Camión'}
                              </p>
                            </div>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Salida Programada</p>
                            <div className="space-y-0.5">
                               <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{load.pickupTime} hs</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{load.serviceType}</p>
                            </div>
                         </div>
                         
                         <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Eficiencia / Avance</p>
                            <div className="space-y-1">
                               <div className="flex items-center gap-1.5">
                                  <TrendingUp size={10} className={cn(efficiency > 80 ? "text-green-500" : "text-orange-500")} />
                                  <span className={cn("text-xs font-black", efficiency > 80 ? "text-green-600" : "text-orange-600")}>{efficiency}%</span>
                               </div>
                               <Progress value={progress} className="h-1 w-20 bg-slate-100" />
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 lg:mt-0 w-full lg:w-auto">
                        {load.status !== 'delivered' && load.status !== 'cancelled' && (
                          <div className="flex items-center gap-1">
                            {load.dockEntryAuthorized ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-[10px] font-bold text-green-600 bg-green-50 border-green-200"
                                onClick={(e) => { e.stopPropagation(); handleRevokeDock(load); }}
                              >
                                <CirclePlay className="w-3 h-3 mr-1" /> VÍA LIBRE OK
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-[10px] font-bold text-blue-600"
                                onClick={(e) => { e.stopPropagation(); setSelectedLoadForDock(load); setIsDockDialogOpen(true); }}
                              >
                                <Anchor className="w-3 h-3 mr-1" /> POSICIONAR
                              </Button>
                            )}
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 lg:flex-none text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200"
                          asChild
                        >
                          <Link href={`/rutas/${load.id}`}>
                            <Zap size={12} className="mr-1" /> APP CHOFER
                          </Link>
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                             {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                   </div>

                   <CollapsibleContent className="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 p-6 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         {(load.status === 'on_route' || load.status === 'on_pause' || load.status === 'delivered') && (
                           <div className="space-y-4 lg:border-r pr-6">
                              <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-widest">
                                 <Zap size={14} /> Telemetría GPS Nativa
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <Card className="bg-white dark:bg-slate-800 shadow-none border-slate-200">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Velocidad Máx.</p>
                                    <p className="text-xl font-black text-blue-600">{times.maxV} <span className="text-[10px] font-normal opacity-50">km/h</span></p>
                                  </CardContent>
                                </Card>
                                <Card className="bg-white dark:bg-slate-800 shadow-none border-slate-200">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Combustible Est.</p>
                                    <p className="text-xl font-black text-green-600">{times.fuel} <span className="text-[10px] font-normal opacity-50">L</span></p>
                                  </CardContent>
                                </Card>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 space-y-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-between">
                                  Estado Final GPS 
                                  <span>{tracking?.lastUpdateAt ? formatDistanceToNow(tracking.lastUpdateAt.toDate ? tracking.lastUpdateAt.toDate() : new Date(tracking.lastUpdateAt), { addSuffix: true, locale: es }) : 'Finalizado'}</span>
                                </p>
                                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
                                </div>
                                <Button variant="outline" size="sm" className="w-full text-[10px] font-bold" asChild>
                                   <Link href={load.status === 'delivered' ? `/cargas/${load.id}/reporte` : `/tracking/${load.id}`}>
                                      <Globe size={12} className="mr-1" /> {load.status === 'delivered' ? 'VER REPORTE FINAL' : 'VER MAPA EN VIVO'}
                                   </Link>
                                </Button>
                              </div>
                           </div>
                         )}

                         <div className={cn("space-y-4", (load.status !== 'on_route' && load.status !== 'on_pause' && load.status !== 'delivered') && "lg:col-span-2")}>
                            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-widest">
                               <Navigation size={14} /> Tramo 1: Hoja de Ruta (Ida)
                            </h4>
                            <div className="space-y-3 relative pl-4 border-l-2 border-dashed border-blue-200 dark:border-blue-800">
                               <div className="relative">
                                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-sm"></div>
                                  <div className={cn(
                                    "space-y-0.5 p-3 rounded-lg border transition-colors",
                                    load.status === 'delivered' ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800" : "bg-transparent border-transparent"
                                  )}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Carga Inicial</p>
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-2">
                                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{load.origin.name}</p>
                                          {load.origin.dockName && <Badge variant="outline" className="text-[7px] h-3 border-blue-200 text-blue-600 uppercase font-black px-1"><Anchor size={8} className="mr-0.5" /> {load.origin.dockName}</Badge>}
                                       </div>
                                       {load.status === 'delivered' && (
                                          <span className="text-[9px] font-bold text-green-600 uppercase italic">Despachado</span>
                                       )}
                                    </div>
                                    {load.status !== 'delivered' && load.dockEntryAuthorized && (
                                       <p className="text-[9px] font-black text-green-600 uppercase flex items-center gap-1 mt-1 bg-green-50 px-2 py-0.5 rounded-full w-fit border border-green-100"><CirclePlay size={10}/> Vía libre para ingresar</p>
                                    )}
                                  </div>
                               </div>
                               {load.outboundStops?.map((stop, idx) => (
                                 <div key={stop.id} className="relative pt-2">
                                    <div className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-400 shadow-sm"></div>
                                    <div className={cn(
                                       "p-3 rounded-lg border shadow-sm space-y-2 transition-colors",
                                       load.status === 'delivered' ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30" : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                                    )}>
                                       <div className="flex justify-between items-start">
                                          <div>
                                             <div className="flex items-center gap-2">
                                                <p className="text-[10px] font-black text-blue-600 uppercase">Destino {idx + 1}</p>
                                                {load.status === 'delivered' && (
                                                   <Badge className="bg-green-600 text-white text-[7px] h-3 border-none px-1 uppercase font-black">Entregado</Badge>
                                                )}
                                             </div>
                                             <div className="flex items-center gap-2">
                                                <p className="text-xs font-bold">{stop.name}</p>
                                                {stop.dockName && <Badge variant="outline" className="text-[7px] h-3 border-blue-200 text-blue-600 uppercase font-black"><Anchor size={8} className="mr-0.5" /> {stop.dockName}</Badge>}
                                             </div>
                                          </div>
                                          <div className="text-right">
                                             <Badge className="bg-blue-50 text-blue-600 text-[8px] border-blue-100">{stop.weightKg} Kg</Badge>
                                             {load.status === 'delivered' && load.proofOfDelivery?.confirmedAt && (
                                                <p className="text-[8px] font-black text-green-600 mt-1 uppercase italic">
                                                   Hora: {formatSafeDate(load.proofOfDelivery.confirmedAt, "HH:mm")} hs
                                                </p>
                                             )}
                                          </div>
                                       </div>
                                       <div className="flex flex-wrap gap-1.5 pt-1">
                                          {stop.documents?.map(doc => (
                                            <div key={doc.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-[9px] font-bold">
                                               <FileText size={10} className="text-slate-500" /> 
                                               {doc.number} {doc.sealNumber && <span className="text-blue-600 ml-1">P:{doc.sealNumber}</span>}
                                            </div>
                                          ))}
                                       </div>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>

                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2 tracking-widest">
                               <Repeat size={14} /> Tramo 2: Logística de Retorno
                            </h4>
                            {load.isRoundTrip ? (
                               <div className="space-y-3 relative pl-4 border-l-2 border-dashed border-orange-200 dark:border-orange-800">
                                  {load.returnStops?.map((stop) => (
                                    <div key={stop.id} className="relative pt-2">
                                       <div className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>
                                       <div className="bg-orange-50/50 dark:bg-orange-950/10 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30 shadow-sm space-y-2">
                                          <div className="flex justify-between items-start">
                                             <div className="space-y-1">
                                                <p className="text-xs font-bold text-orange-700 dark:text-orange-400">Recolección: {stop.name}</p>
                                                {stop.dockName && <Badge variant="outline" className="text-[7px] h-3 border-orange-200 text-orange-700 uppercase font-black"><Anchor size={8} className="mr-0.5" /> {stop.dockName}</Badge>}
                                             </div>
                                             <Badge className="bg-orange-100 text-orange-700 text-[8px] border-orange-200">{stop.weightKg} Kg</Badge>
                                          </div>
                                          <div className="flex flex-wrap gap-1.5">
                                            {stop.documents?.map(doc => (
                                              <Badge key={doc.id} variant="outline" className="text-[9px] border-orange-200 text-orange-600">R:{doc.number}</Badge>
                                            ))}
                                          </div>
                                       </div>
                                    </div>
                                  ))}
                                  {load.returnDestination?.name && (
                                    <div className="relative pt-2">
                                       <div className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full bg-slate-900 border-2 border-white shadow-sm"></div>
                                       <div className="bg-slate-900 text-white p-3 rounded-lg space-y-1">
                                          <p className="text-[8px] font-black text-white/50 uppercase">Descarga Final Retorno</p>
                                          <div className="flex items-center gap-2">
                                             <p className="text-xs font-bold uppercase">{load.returnDestination.name}</p>
                                             {load.returnDestination.dockName && <Badge variant="outline" className="text-[7px] h-3 border-slate-700 text-white uppercase font-black"><Anchor size={8} className="mr-0.5" /> {load.returnDestination.dockName}</Badge>}
                                          </div>
                                       </div>
                                    </div>
                                  )}
                               </div>
                            ) : (
                               <div className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/30 dark:bg-slate-900/30 text-slate-300">
                                  <Repeat size={24} className="opacity-20 mb-2" />
                                  <p className="text-[10px] font-bold uppercase italic">Flete de solo ida</p>
                               </div>
                            )}
                         </div>
                      </div>
                   </CollapsibleContent>
                 </Collapsible>
               );
             })}
             {filteredAgenda.length === 0 && (
                <div className="py-24 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-800">
                    <Package size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">Sin movimientos para esta vista</p>
                    <p className="text-xs text-slate-300">No hay fletes programados para el periodo seleccionado.</p>
                  </div>
                </div>
             )}
           </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden h-[500px] relative">
        {mounted && (
          <MapContainer 
            center={[-28.0, -58.0]} 
            zoom={5} 
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            
            {L && hubIcon && hubs?.map((hub) => {
              const icon = hubIcon(!!hub.isMainBase);
              if (!icon) return null;
              return (
                <Marker key={hub.id} position={[hub.lat || -34.6, hub.lng || -58.3]} icon={icon}>
                  <Popup>
                    <div className="p-1">
                      <div className="font-bold text-sm">{hub.name}</div>
                      <div className="text-xs text-slate-500">{hub.country} - {hub.city}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {L && clientIcon && clients?.filter(c => typeof c.address?.lat === 'number' && typeof c.address?.lng === 'number').map((client) => {
              const icon = clientIcon;
              return (
                <Marker key={client.id} position={[client.address.lat!, client.address.lng!]} icon={icon}>
                  <Popup>
                    <div className="p-1">
                      <div className="font-bold text-sm text-green-700">{client.name}</div>
                      <div className="text-xs text-slate-500">{client.address.city}, {client.address.country}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {L && truckIcon && filteredAgenda.filter(l => (l.status === 'on_route' || l.status === 'on_pause' || l.status === 'incident') && l.tracking?.currentLat).map((load) => (
              <Marker key={load.id} position={[load.tracking!.currentLat, load.tracking!.currentLng]} icon={truckIcon}>
                <Popup>
                  <div className="p-1 font-bold text-sm">
                    Orden: {load.orderNumber}
                    <div className="text-[10px] text-blue-600 uppercase font-bold">{load.status.replace('_', ' ')}</div>
                    <div className="text-[9px] text-slate-400 mt-1">Velocidad: {load.tracking?.currentSpeed} km/h</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
        
        <div className="absolute top-4 left-4 z-[500] space-y-2 pointer-events-none">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur p-3 rounded-lg border shadow-sm text-[10px] font-bold uppercase space-y-2 pointer-events-auto">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Camiones en Tránsito</div>
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold"><Building2 className="w-3 h-3" /> Sedes Regionales</div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400"><div className="w-2 h-2 rounded-full bg-green-600"></div> Clientes / Dadores</div>
          </div>
        </div>
      </Card>

      <Dialog open={isDockDialogOpen} onOpenChange={setIsDockDialogOpen}>
         <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2"><Anchor className="text-blue-600" /> Autorizar Vía Libre</DialogTitle>
               <DialogDescription>Indique al chofer en qué boca posicionar el camión para operar.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">1. Confirmar Boca de Carga / Descarga</Label>
                  <Select value={selectedDock} onValueChange={setSelectedDock}>
                     <SelectTrigger className="bg-slate-50 h-12">
                        <SelectValue placeholder="Seleccionar Portón" />
                     </SelectTrigger>
                     <SelectContent>
                        {hubs?.find(h => h.id === selectedLoadForDock?.origin.id)?.loadingBays?.map(bay => (
                          <SelectItem key={bay.id} value={bay.name}>{bay.name}</SelectItem>
                        ))}
                        {(!hubs?.find(h => h.id === selectedLoadForDock?.origin.id)?.loadingBays || hubs.find(h => h.id === selectedLoadForDock?.origin.id)?.loadingBays?.length === 0) && (
                           <SelectItem value="Mesa de Entradas" disabled>Sin bocas definidas</SelectItem>
                        )}
                     </SelectContent>
                  </Select>
               </div>

               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-widest"><Radio className="w-3 h-3 animate-pulse" /> Notificación Chofer</div>
                  <p className="text-[10px] text-blue-600 leading-relaxed italic">"El chofer recibirá una señal de VÍA LIBRE en su teléfono indicando que puede ingresar inmediatamente a la boca asignada."</p>
               </div>
            </div>
            <DialogFooter>
               <Button variant="ghost" onClick={() => setIsDockDialogOpen(false)} className="text-slate-500 font-bold">CANCELAR</Button>
               <Button 
                onClick={handleDockAssignment} 
                disabled={isUpdatingDock || !selectedDock} 
                className="bg-green-600 hover:bg-green-700 font-bold min-w-[150px]"
               >
                 {isUpdatingDock ? <Loader2 size={16} className="animate-spin mr-2" /> : <CirclePlay size={16} className="mr-2" />}
                 HABILITAR ENTRADA
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}

