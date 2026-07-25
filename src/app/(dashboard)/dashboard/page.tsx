
'use client';

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Truck as TruckIcon, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  Calendar,
  MapPin,
  DollarSign,
  Plus,
  Activity,
  Building2,
  Loader2,
  Zap,
  Globe,
  Clock,
  ArrowRight,
  Navigation,
  Compass,
  User,
  Scale,
  Timer,
  Route as RouteIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Driver, Load, Hub, Client } from "@/app/lib/types";
import { isToday, startOfMonth, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin" /></div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => import("react-leaflet").then(m => m.TileLayer)), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => import("react-leaflet").then(m => m.Marker)), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => import("react-leaflet").then(m => m.Popup)), { ssr: false });

export default function MonitorOperativoPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  
  const [mounted, setMounted] = useState(false);
  const [L, setL] = useState<any>(null);

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

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const stats = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);

    const deliveredToday = loads?.filter(l => 
      l.status === 'delivered' && 
      (l.updatedAt?.seconds ? isToday(new Date(l.updatedAt.seconds * 1000)) : isToday(new Date(l.updatedAt)))
    ).length || 0;

    const scheduledToday = loads?.filter(l => l.pickupDate === todayStr).length || 0;
    const onRouteCount = loads?.filter(l => l.status === 'on_route').length || 0;
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
  }, [trucks, loads, todayStr]);

  const dailyOperations = useMemo(() => {
    if (!loads) return [];
    return loads.filter(l => 
      l.status === 'on_route' || 
      (l.pickupDate === todayStr && l.status !== 'delivered' && l.status !== 'cancelled')
    ).sort((a, b) => {
      if (a.status === 'on_route' && b.status !== 'on_route') return -1;
      if (a.status !== 'on_route' && b.status === 'on_route') return 1;
      return (a.pickupTime || '').localeCompare(b.pickupTime || '');
    });
  }, [loads, todayStr]);

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }) : null;

  const hubIcon = (isMain: boolean) => L ? L.divIcon({
    className: 'custom-hub-icon',
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900 dark:bg-slate-800'} text-white p-2 rounded-lg shadow-xl border-2 border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>'}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  }) : null;

  const clientIcon = L ? L.divIcon({
    className: 'custom-client-icon',
    html: `<div class="bg-green-600 text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }) : null;

  return (
    <div className="space-y-6">
      {/* Barra de Estado Superior */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Globe size={16} /> Red Regional: {trucks?.length || 0} Unidades</span>
            <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold"><Activity size={16} /> {stats.onRouteCount} En Tránsito</span>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Entregas Hoy" value={stats.deliveredToday} icon={CheckCircle2} description="Finalizadas" />
        <KPICard title="Salidas Hoy" value={stats.scheduledToday} icon={Calendar} description="Programadas" />
        <KPICard title="Flota Activa" value={stats.activeTrucks} icon={TruckIcon} description="En carretera" />
        <KPICard title="Facturación" value={stats.billingMonth.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={DollarSign} description="Mes actual" />
        <KPICard title="Incidencias" value={stats.incidents} icon={AlertTriangle} description="Atención req." />
      </div>

      {/* Agenda Operativa del Día - Consolidada */}
      <Card className="border-none shadow-sm border-l-4 border-l-blue-600">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
           <div>
             <CardTitle className="text-lg flex items-center gap-2">
               <Activity className="w-5 h-5 text-blue-600" /> Agenda Operativa del Día
             </CardTitle>
             <CardDescription className="text-xs font-bold uppercase">Consolidado detallado de viajes activos y programados hoy</CardDescription>
           </div>
           <Badge variant="outline" className="h-6 font-bold">{dailyOperations.length} Operaciones hoy</Badge>
        </CardHeader>
        <CardContent className="pt-4 px-0">
           <div className="flex flex-col">
             {dailyOperations.map(load => {
               const driver = drivers?.find(d => d.id === load.assignedDriverId);
               const truck = trucks?.find(t => t.id === load.assignedTruckId);
               const totalWeight = (load.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0) + (load.returnStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0);
               const lastStop = load.outboundStops?.[load.outboundStops.length - 1];

               return (
                 <div key={load.id} className="px-6 py-5 flex flex-col lg:flex-row items-start lg:items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800 cursor-pointer group gap-6" onClick={() => window.location.href = load.status === 'on_route' ? `/tracking/${load.id}` : `/cargas/${load.id}/orden`}>
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                       <div className={cn(
                         "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-colors shadow-sm",
                         load.status === 'on_route' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200" : "bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200"
                       )}>
                         {load.status === 'on_route' ? <Navigation size={24} className="animate-pulse" /> : <Clock size={24} />}
                       </div>
                       
                       <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">{load.orderNumber}</p>
                            {load.status === 'on_route' && <Badge className="text-[9px] bg-blue-600 text-white border-none animate-pulse px-2 h-4">LIVE tracking</Badge>}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                             <span className="font-bold text-slate-500 uppercase flex items-center gap-1.5"><Building2 size={12} className="text-slate-400" /> {load.clientName}</span>
                             <span className="font-bold text-blue-600 flex items-center gap-1.5"><MapPin size={12} /> {load.pickupTime}hs → {lastStop?.city || 'Destino'}</span>
                          </div>
                       </div>
                    </div>

                    {/* Información Detallada del Viaje */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 flex-[2] w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Conductor</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                             <User size={12} className="text-blue-500" /> {driver ? `${driver.lastName}, ${driver.firstName[0]}.` : 'No asignado'}
                          </p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Camión</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                             <TruckIcon size={12} className="text-blue-500" /> {truck?.plate || 'Sin unidad'}
                          </p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Carga Total</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                             <Scale size={12} className="text-slate-400" /> {totalWeight.toLocaleString()} <span className="text-[9px] font-normal opacity-50 uppercase">Kg</span>
                          </p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Itinerario</p>
                          <div className="flex items-center gap-3">
                             <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <RouteIcon size={12} className="text-slate-400" /> ~700 <span className="text-[9px] opacity-50">km</span>
                             </p>
                             <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Timer size={12} className="text-slate-400" /> {load.estimatedArrivalTime}hs <span className="text-[9px] opacity-50">ETA</span>
                             </p>
                          </div>
                       </div>
                    </div>

                    <div className="hidden lg:block">
                       <ArrowRight size={20} className="text-slate-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                 </div>
               );
             })}
             {dailyOperations.length === 0 && (
                <div className="py-24 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-800">
                    <Package size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">Parrilla Operativa Vacía</p>
                    <p className="text-xs text-slate-300">No hay fletes programados para el inicio o en tránsito hoy.</p>
                  </div>
                </div>
             )}
           </div>
        </CardContent>
      </Card>

      {/* Mapa de Flota */}
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
            
            {hubIcon && hubs?.map((hub) => (
              <Marker key={hub.id} position={[hub.lat || -34.6, hub.lng || -58.3]} icon={hubIcon(!!hub.isMainBase)}>
                <Popup>
                  <div className="p-1">
                    <div className="font-bold text-sm">{hub.name}</div>
                    <div className="text-xs text-slate-500">{hub.country} - {hub.city}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {clientIcon && clients?.filter(c => typeof c.address?.lat === 'number' && typeof c.address?.lng === 'number').map((client) => (
              <Marker key={client.id} position={[client.address.lat!, client.address.lng!]} icon={clientIcon}>
                <Popup>
                  <div className="p-1">
                    <div className="font-bold text-sm text-green-700">{client.name}</div>
                    <div className="text-xs text-slate-500">{client.address.city}, {client.address.country}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {truckIcon && trucks?.filter(t => t.status === 'in_trip').map((truck) => (
              <Marker key={truck.id} position={[truck.location?.lat || -34.6, truck.location?.lng || -58.3]} icon={truckIcon}>
                <Popup>
                  <div className="p-1 font-bold text-sm">Patente: {truck.plate}</div>
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
    </div>
  );
}
