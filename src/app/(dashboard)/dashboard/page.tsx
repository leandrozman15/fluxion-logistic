
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
  Plus, 
  Activity, 
  Building2, 
  Loader2, 
  Globe, 
  Clock, 
  ArrowRight, 
  Navigation, 
  User, 
  ShieldCheck, 
  Repeat, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  CalendarDays, 
  Anchor, 
  CirclePlay, 
  CircleCheck, 
  ListOrdered, 
  Ship, 
  ScanBarcode, 
  Coffee, 
  Home,
  Siren,
  ChevronDown,
  ChevronUp,
  Radio
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { calculateDistance } from "@/lib/utils/tracking-math";
import { Truck, Driver, Load, Hub, Client } from "@/app/lib/types";
import { isToday, format, addDays, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin" /></div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });

const ALERT_LABELS: Record<string, string> = {
  security: 'SEGURIDAD',
  mechanical: 'MECÁNICA',
  accident: 'ACCIDENTE'
};

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
    if (!db || !tenantId) return null;
    return collection(db, "tenants", tenantId, "trucks");
  }, [db, tenantId]);

  const loadsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "loads"), orderBy("createdAt", "desc"));
  }, [db, tenantId]);

  const hubsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return collection(db, "tenants", tenantId, "hubs");
  }, [db, tenantId]);

  const clientsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return collection(db, "tenants", tenantId, "clients");
  }, [db, tenantId]);

  const driversQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return collection(db, "tenants", tenantId, "drivers");
  }, [db, tenantId]);

  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const nextWeekStr = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const stats = useMemo(() => {
    const todayDelivered = loads?.filter(l => 
      l.status === 'delivered' && 
      (l.updatedAt?.seconds ? isToday(new Date(l.updatedAt.seconds * 1000)) : isToday(new Date(l.updatedAt)))
    ).length || 0;

    const scheduledToday = loads?.filter(l => l.pickupDate === todayStr).length || 0;
    const onRouteCount = loads?.filter(l => l.status === 'on_route' || l.status === 'on_pause').length || 0;
    const incidents = loads?.filter(l => l.status === 'incident').length || 0;

    return { 
      deliveredToday: todayDelivered, 
      scheduledToday,
      onRouteCount,
      incidents
    };
  }, [loads, todayStr]);

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
      if (!isAActive && b.status !== 'on_route') return 1;
      return `${a.pickupDate} ${a.pickupTime}`.localeCompare(`${b.pickupDate} ${b.pickupTime}`);
    });
  }, [loads, agendaTab, todayStr, tomorrowStr, nextWeekStr]);

  const handleDockAssignment = async () => {
    if (!db || !selectedLoadForDock || !selectedDock || !tenantId) return;
    setIsUpdatingDock(true);
    try {
      await updateDoc(doc(db, "tenants", tenantId, "loads", selectedLoadForDock.id), {
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

  const handleDeactivateAlert = async (truckId: string) => {
    if (!db || !tenantId) return;
    try {
      await updateDoc(doc(db, "tenants", tenantId, "trucks", truckId), {
        hasActiveAlert: false,
        alertType: null,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Alerta Desactivada", description: "La unidad ha vuelto a estado normal." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al desactivar alerta" });
    }
  };

  const calculateETA = (distanceRemaining: number | undefined, currentSpeed: number | undefined) => {
    if (distanceRemaining && (currentSpeed === undefined || currentSpeed < 1)) return "DETENIDO";
    if (!distanceRemaining || !currentSpeed || currentSpeed < 1) return "CALCULANDO...";
    const hours = distanceRemaining / currentSpeed;
    const etaDate = addMinutes(new Date(), Math.round(hours * 60));
    return format(etaDate, "HH:mm") + " hs";
  };

  const getPlannedTotalKm = (load: Load) => {
    if (!load.origin.lat || !load.origin.lng) return 0;
    let total = 0;
    let cursor = { lat: load.origin.lat, lng: load.origin.lng };

    (load.outboundStops || []).forEach(s => {
      if (s.lat && s.lng) {
        total += calculateDistance(cursor.lat, cursor.lng, s.lat || 0, s.lng || 0);
        cursor = { lat: s.lat, lng: s.lng };
      }
    });

    const finalDestLat = load.returnDestination?.lat || (load.isRoundTrip ? load.origin.lat : null);
    const finalDestLng = load.returnDestination?.lng || (load.isRoundTrip ? load.origin.lng : null);

    if (finalDestLat && finalDestLng) {
      (load.returnStops || []).forEach(s => {
        if (s.lat && s.lng) {
          total += calculateDistance(cursor.lat, cursor.lng, s.lat || 0, s.lng || 0);
          cursor = { lat: s.lat, lng: s.lng };
        }
      });
      total += calculateDistance(cursor.lat, cursor.lng, finalDestLat, finalDestLng);
    }

    return Math.round(total);
  };

  const hubIcon = (isMain: boolean) => L ? L.divIcon({
    className: 'custom-hub-icon',
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900'} text-white p-2 rounded-lg shadow-xl border-2 border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>'}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18]
  }) : null;

  const clientMarkerIcon = () => L ? L.divIcon({
    className: 'custom-client-marker-icon',
    html: `<div class="bg-green-600 text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7"/><path d="M4 21V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17"/></svg>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  }) : null;

  const getTruckIcon = (hasAlert: boolean = false) => {
    if (!L) return null;
    return L.divIcon({
      className: 'custom-truck-icon',
      html: `
        <div class="relative">
          ${hasAlert ? '<div class="absolute -inset-2 bg-red-500 rounded-full animate-ping opacity-20"></div>' : ''}
          <div class="${hasAlert ? 'bg-red-600 animate-pulse' : 'bg-blue-600'} text-white p-2 rounded-full shadow-lg border-2 border-white transition-colors duration-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9V4"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/>
              <circle cx="7" cy="18" r="2"/>
              <circle cx="17" cy="18" r="2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  if (!mounted || !tenantId) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><Globe size={16} /> Red Regional: {trucks?.length || 0} Unidades</span>
            <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-blue-600 font-bold"><Activity size={16} /> {stats.onRouteCount} Operativos</span>
            <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-green-600"><Building2 size={16} /> {clients?.length || 0} Clientes</span>
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-md" asChild><Link href="/cargas/nuevo"><Plus size={16} className="mr-1" /> Nuevo Flete</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Entregas Hoy" value={stats.deliveredToday} icon={CheckCircle2} description="Finalizadas" />
        <KPICard title="Salidas Hoy" value={stats.scheduledToday} icon={Calendar} description="Programadas" />
        <KPICard title="Operativos" value={stats.onRouteCount} icon={TruckIcon} description="En tránsito o pausa" />
        <KPICard title="Incidencias" value={stats.incidents} icon={AlertTriangle} description="Atención req." />
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="pb-3 border-b bg-slate-50">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div><CardTitle className="text-lg flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-600" /> Agenda Operativa</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Control de despacho y planificación semanal</CardDescription></div>
             <Tabs value={agendaTab} onValueChange={setAgendaTab} className="w-full md:w-auto"><TabsList className="bg-white border h-9"><TabsTrigger value="today" className="text-[10px] font-bold uppercase">Hoy (Todo)</TabsTrigger><TabsTrigger value="tomorrow" className="text-[10px] font-bold uppercase">Mañana</TabsTrigger><TabsTrigger value="week" className="text-[10px] font-bold uppercase">Semana</TabsTrigger></TabsList></Tabs>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="divide-y divide-slate-100">
             {filteredAgenda.map(load => {
               const driver = drivers?.find(d => d.id === load.assignedDriverId);
               const truck = trucks?.find(t => t.id === load.assignedTruckId);
               const isExpanded = expandedLoadId === load.id;
               const tracking = load.tracking;
               const totalPlannedKm = getPlannedTotalKm(load);
               const isStarted = load.status !== 'pending' && load.status !== 'assigned';
               const isFinished = load.status === 'delivered';
               const stops = load.outboundStops || [];
               const lastDeliveredIdx = stops.reduce((acc, s, idx) => (s.deliveredAt ? idx : acc), -1);
               const isReturnPhase = isStarted && !isFinished && lastDeliveredIdx === stops.length - 1;

               return (
                 <Collapsible key={load.id} open={isExpanded} onOpenChange={() => setExpandedLoadId(isExpanded ? null : load.id)} className="group transition-all">
                   <div className={cn("px-6 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between transition-colors cursor-pointer group hover:bg-slate-50", isExpanded && "bg-blue-50/50 border-l-4 border-l-blue-600")}>
                      <div className="flex items-center gap-5 flex-1 min-w-0" onClick={() => setExpandedLoadId(isExpanded ? null : load.id)}>
                         <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm", 
                           truck?.hasActiveAlert ? "bg-red-600 text-white animate-pulse border-red-400" :
                           load.status === 'on_route' ? "bg-blue-600 text-white border-blue-400" : 
                           load.status === 'on_pause' ? "bg-amber-500 text-white border-amber-400" :
                           load.status === 'delivered' ? "bg-green-600 text-white border-green-400" :
                           "bg-white text-slate-400 border-slate-200")}>
                           {truck?.hasActiveAlert ? <Siren size={24} className="animate-bounce" /> : load.serviceType === 'customs' ? <Ship size={24}/> : (load.status === 'on_route' ? <Navigation size={24} className="animate-pulse" /> : load.status === 'on_pause' ? <Coffee size={24} /> : <Clock size={24} />)}
                         </div>
                         <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                               <p className="text-base font-black text-slate-900 tracking-tighter">{load.orderNumber}</p>
                               {load.international?.containerNumber && <Badge variant="secondary" className="bg-blue-900 text-white border-none text-[8px] h-4 font-mono px-2"><ScanBarcode size={10} className="mr-1" /> {load.international.containerNumber}</Badge>}
                               {truck?.hasActiveAlert && <Badge className="bg-red-600 text-white animate-pulse border-none text-[8px] h-4 uppercase">{ALERT_LABELS[truck.alertType || ''] || 'S.O.S'}</Badge>}
                            </div>
                            <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center shadow-sm", !isStarted ? "bg-red-500" : "bg-green-500")}>
                                    <div className="w-1 h-1 bg-white rounded-full"></div>
                                  </div>
                                  <ArrowRight size={12} className={cn("shrink-0", !isStarted ? "text-slate-200" : "text-green-500")} />
                                  {stops.length > 0 && (
                                    <>
                                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 shadow-sm", lastDeliveredIdx >= 0 ? "bg-green-50" : "bg-slate-200")} />
                                      <ArrowRight size={12} className={cn("shrink-0", isFinished || isReturnPhase ? "text-orange-500" : "text-slate-200")} />
                                    </>
                                  )}
                                  <div className={cn(
                                    "w-2.5 h-2.5 rounded-full shrink-0 shadow-sm", 
                                    isFinished ? "bg-green-500" : (isReturnPhase ? "bg-orange-500 animate-pulse" : "bg-slate-300")
                                  )} />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate ml-1">
                                    {isFinished ? `Finalizado` : !isStarted ? `Base: ${load.origin.name}` : isReturnPhase ? `Retorno a Base` : `A: ${stops[lastDeliveredIdx + 1]?.name || 'Destino'}`}
                                  </span>
                                </div>
                                {load.status === 'on_route' && load.tracking && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 w-fit">
                                     <Zap size={10} className="animate-pulse fill-current" /> ETA GPS: {calculateETA(load.tracking.distanceRemainingKm, load.tracking.currentSpeed)}
                                  </div>
                                )}
                            </div>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 flex-[2] w-full lg:w-auto mt-4 lg:mt-0 border-t lg:border-t-0 pt-4 lg:pt-0">
                         <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Personal y Unidad</p><div className="space-y-0.5"><p className="text-xs font-bold text-slate-700 flex items-center gap-1.5 truncate"><User size={10} className="text-blue-500" /> {driver ? `${driver.lastName}, ${driver.firstName[0]}.` : 'Sin Chofer'}</p><p className="text-[10px] font-mono font-bold text-blue-600"><ShieldCheck size={10} className="inline mr-1" /> {truck?.plate || 'Sin Camión'}</p></div></div>
                         <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Salida Programada</p><div className="space-y-0.5"><p className="text-xs font-bold text-slate-800">{load.pickupTime} hs</p><p className="text-[9px] font-bold text-slate-400 uppercase">{load.serviceType}</p></div></div>
                         <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avance Ruta</p><div className="space-y-1"><div className="flex items-center gap-1.5"><TrendingUp size={10} className="text-blue-500" /><span className="text-xs font-black text-slate-700">{Math.round(tracking?.distanceTraveledKm || 0)} KM</span></div><Progress value={load.status === 'delivered' ? 100 : (tracking?.distanceTraveledKm || 0)} className="h-1 w-20 bg-slate-100" /></div></div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 lg:mt-0 w-full lg:w-auto">
                        {truck?.hasActiveAlert && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="flex-1 lg:flex-none text-[10px] font-black h-8 px-4"
                            onClick={(e) => { e.stopPropagation(); handleDeactivateAlert(truck.id); }}
                          >
                            RESOLVER
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="flex-1 lg:flex-none text-[10px] font-bold text-blue-600 bg-blue-100 hover:bg-blue-200" asChild><Link href={`/tracking/${load.id}`}><Zap size={12} className="mr-1" /> VIVO</Link></Button>
                        <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</Button></CollapsibleTrigger>
                      </div>
                   </div>
                   <CollapsibleContent className="bg-slate-50 border-t border-slate-200 p-6 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <div className="space-y-4 lg:border-r pr-6">
                            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-widest"><Ship size={14} /> Información de Contenedor</h4>
                            {load.international?.containerNumber ? (
                               <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                     <Card className="bg-white shadow-none border-slate-200"><CardContent className="p-3"><p className="text-[8px] font-black text-slate-400 uppercase">N° Contenedor</p><p className="text-sm font-black text-blue-600 font-mono uppercase">{load.international.containerNumber}</p></CardContent></Card>
                                     <Card className="bg-white shadow-none border-slate-200"><CardContent className="p-3"><p className="text-[8px] font-black text-slate-400 uppercase">Precinto</p><p className="text-sm font-black text-slate-700 font-mono">{load.international.sealNumber || 'N/A'}</p></CardContent></Card>
                                  </div>
                               </div>
                            ) : <div className="p-8 text-center border-2 border-dashed rounded-2xl"><ScanBarcode size={24} className="mx-auto text-slate-200 mb-2" /><p className="text-[10px] text-slate-400 uppercase font-black">Carga General</p></div>}
                            <div className="pt-4"><Card className="bg-white shadow-none border-slate-200"><CardContent className="p-3 flex justify-between items-center"><div><p className="text-[8px] font-black text-slate-400 uppercase">Recorrido Total Previsto</p><p className="text-xl font-black text-slate-900 italic">{totalPlannedKm} <span className="text-[10px] font-normal opacity-50 uppercase">km</span></p></div><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><Navigation size={20} /></div></CardContent></Card></div>
                         </div>
                         <div className="lg:col-span-2 space-y-8">
                            <div className="space-y-4">
                               <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-widest"><Navigation size={14} /> Tramo 1: Hoja de Ruta (Ida)</h4>
                               <div className="space-y-3 relative pl-4 border-l-2 border-dashed border-blue-200">
                                  {load.outboundStops?.map((stop, idx) => (
                                     <div key={stop.id} className="relative pt-2">
                                        <div className={cn("absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm", stop.deliveredAt ? "bg-green-600" : "bg-white border-blue-400")}></div>
                                        <div className={cn("p-4 rounded-xl border shadow-sm space-y-3 transition-all", stop.deliveredAt ? "bg-green-50 border-green-200" : "bg-white border-slate-200")}>
                                           <div className="flex justify-between items-start">
                                              <div className="min-w-0 flex-1">
                                                 <div className="flex items-center gap-2"><p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Parada {idx + 1}</p>{stop.deliveredAt && <Badge className="bg-green-600 text-white text-[7px] h-3 border-none px-1 uppercase font-black">Confirmada</Badge>}</div>
                                                 <p className="text-xs font-black text-slate-800 truncate uppercase mt-0.5">{stop.name}</p>
                                              </div>
                                              <div className="text-right shrink-0"><Badge className="bg-slate-100 text-slate-600 text-[8px] border-none font-black">{stop.weightKg} KG</Badge></div>
                                           </div>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            </div>
                            
                            <div className="space-y-4">
                               <h4 className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2 tracking-widest"><Repeat size={14} /> Tramo 2: Logística de Retorno</h4>
                               {(load.isRoundTrip || (load.returnStops?.length || 0) > 0) ? (
                                  <div className="space-y-3 relative pl-4 border-l-2 border-dashed border-orange-200">
                                     {load.returnStops?.map((stop) => (
                                        <div key={stop.id} className="relative pt-2">
                                           <div className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm bg-orange-500"></div>
                                           <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 shadow-sm space-y-2">
                                              <div className="flex justify-between items-start">
                                                 <div><p className="text-[9px] font-black text-orange-600 uppercase">Recolección Retorno</p><p className="text-xs font-bold text-orange-700 uppercase">{stop.name}</p></div>
                                                 <Badge className="bg-orange-100 text-orange-700 text-[8px] border-none font-black">{stop.weightKg} KG</Badge>
                                              </div>
                                           </div>
                                        </div>
                                     ))}
                                     <div className="relative pt-2">
                                        <div className={cn(
                                          "absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm",
                                          isFinished ? "bg-green-600" : (isReturnPhase ? "bg-orange-500 animate-pulse" : "bg-slate-300")
                                        )}></div>
                                        <div className={cn(
                                          "p-4 rounded-xl space-y-2 shadow-xl transition-all border-2",
                                          isFinished ? "bg-green-600 border-green-500 text-white" : "bg-slate-900 border-slate-800 text-white"
                                        )}>
                                           <div className="flex justify-between items-center">
                                              <p className={cn("text-[8px] font-black uppercase tracking-widest", isFinished ? "text-white/70" : "text-blue-400")}>Fin de Jornada / Retorno Definitivo</p>
                                              {isFinished && <CircleCheck size={14} className="text-white/50" />}
                                           </div>
                                           <div className="flex items-center gap-2">
                                              <Home size={14} className={isFinished ? "text-white/50" : "text-slate-400"} />
                                              <p className="text-xs font-bold uppercase">{load.returnDestination?.name || load.origin.name}</p>
                                           </div>
                                        </div>
                                     </div>
                                  </div>
                               ) : (
                                  <div className="h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-300">
                                     <Repeat size={16} className="opacity-20 mb-1" /><p className="text-[9px] font-black uppercase italic tracking-widest">Flete Directo (Solo Ida)</p>
                                  </div>
                               )}
                            </div>
                         </div>
                      </div>
                   </CollapsibleContent>
                 </Collapsible>
               );
             })}
           </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden h-[500px] relative">
        {mounted && (
          <MapContainer center={[-28.0, -58.0]} zoom={5} className="h-full w-full" zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            {L && hubs?.map((hub) => {
              const icon = hubIcon(!!hub.isMainBase);
              if (!icon) return null;
              return (<Marker key={hub.id} position={[hub.lat || -34.6, hub.lng || -58.3]} icon={icon}><Popup><div className="p-1"><div className="font-bold text-sm">{hub.name}</div><div className="text-xs text-slate-500">{hub.city}</div></div></Popup></Marker>);
            })}
            {L && clients?.filter(c => c.address?.lat && c.address?.lng).map((client) => {
              const icon = clientMarkerIcon();
              if (!icon) return null;
              return (
                <Marker key={client.id} position={[client.address.lat!, client.address.lng!]} icon={icon}>
                  <Popup>
                    <div className="p-1">
                      <div className="font-bold text-sm uppercase">{client.name}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">{client.address.city}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {L && trucks?.filter(t => t.location?.lat).map((truck) => (
              <Marker key={truck.id} position={[truck.location!.lat!, truck.location!.lng!]} icon={getTruckIcon(!!truck.hasActiveAlert)}>
                <Popup>
                  <div className="p-2 space-y-2">
                    <div className="font-bold text-sm">Unidad: {truck.plate}</div>
                    {truck.hasActiveAlert && (
                      <div className="space-y-2">
                        <Badge variant="destructive" className="animate-pulse w-full justify-center text-[10px] h-6 border-none">
                          S.O.S: {ALERT_LABELS[truck.alertType || ''] || 'EMERGENCIA'}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full text-[10px] h-7 font-black uppercase border-slate-200"
                          onClick={() => handleDeactivateAlert(truck.id)}
                        >
                          RESOLVER ALERTA
                        </Button>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Última conexión: {format(new Date(), "HH:mm")} hs</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </Card>

      <Dialog open={isDockDialogOpen} onOpenChange={setIsDockDialogOpen}>
         <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Anchor className="text-blue-600" /> Autorizar Vía Libre</DialogTitle><DialogDescription>Indique al chofer en qué boca posicionar el camión para operar.</DialogDescription></DialogHeader>
            <div className="py-6 space-y-6">
               <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">1. Confirmar Boca de Carga / Descarga</Label><Select value={selectedDock} onValueChange={setSelectedDock}><SelectTrigger className="bg-slate-50 h-12"><SelectValue placeholder="Seleccionar Portón" /></SelectTrigger><SelectContent>{hubs?.find(h => h.id === selectedLoadForDock?.origin.id)?.loadingBays?.map(bay => (<SelectItem key={bay.id} value={bay.name}>{bay.name}</SelectItem>))}</SelectContent></Select></div>
               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2"><div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-widest"><Radio className="w-3 h-3 animate-pulse" /> Notificación Chofer</div><p className="text-[10px] text-blue-600 leading-relaxed italic">"El chofer recibirá una señal de VÍA LIBRE en su teléfono indicando que puede ingresar inmediatamente."</p></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setIsDockDialogOpen(false)} className="text-slate-500 font-bold">CANCELAR</Button><Button onClick={handleDockAssignment} disabled={isUpdatingDock || !selectedDock} className="bg-green-600 hover:bg-green-700 font-bold min-w-[150px]">{isUpdatingDock ? <Loader2 className="animate-spin mr-2" /> : <CirclePlay size={16} className="mr-2" />} HABILITAR ENTRADA</Button></DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
}
