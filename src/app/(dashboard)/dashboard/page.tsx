
'use client';

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, limit } from "firebase/firestore";
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
  ArrowRight
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
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

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

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "drivers");
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

  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const monthStart = startOfMonth(today);

    // Entregas finalizadas hoy
    const deliveredToday = loads?.filter(l => 
      l.status === 'delivered' && 
      isToday(new Date(l.updatedAt?.seconds * 1000 || l.updatedAt))
    ).length || 0;

    // Fletes programados para hoy (activos o pendientes)
    const scheduledToday = loads?.filter(l => l.pickupDate === todayStr).length || 0;
    
    // Viajes actualmente en ruta
    const onRouteCount = loads?.filter(l => l.status === 'on_route').length || 0;

    // Flota activa (En viaje o camión ocupado)
    const activeTrucks = trucks?.filter(t => t.status === 'in_trip').length || 0;
    
    const billingMonth = loads?.filter(l => 
      l.status === 'delivered' && 
      new Date(l.updatedAt?.seconds * 1000 || l.updatedAt) >= monthStart
    ).reduce((acc, l) => acc + (l.totalAmount || 0), 0) || 0;

    const incidents = loads?.filter(l => l.status === 'incident').length || 0;

    return { 
      deliveredToday, 
      scheduledToday,
      onRouteCount,
      activeTrucks: Math.max(activeTrucks, onRouteCount), 
      billingMonth, 
      incidents, 
      otif: 94.5
    };
  }, [trucks, loads]);

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Entregas Hoy" value={stats.deliveredToday} icon={CheckCircle2} description="Finalizadas" />
        <KPICard title="Salidas Hoy" value={stats.scheduledToday} icon={Calendar} description="Programadas" />
        <KPICard title="Flota Activa" value={stats.activeTrucks} icon={TruckIcon} description="En carretera" />
        <KPICard title="Facturación" value={stats.billingMonth.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={DollarSign} description="Mes actual" />
        <KPICard title="Incidencias" value={stats.incidents} icon={AlertTriangle} description="Atención req." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden h-[550px] relative">
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

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm h-fit">
            <CardHeader className="pb-3 border-b">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Clock className="w-4 h-4 text-blue-600" /> Salidas Programadas Hoy
               </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
               <div className="space-y-1">
                 {loads?.filter(l => l.pickupDate === format(new Date(), "yyyy-MM-dd")).slice(0, 5).map(load => (
                   <div key={load.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                           <Package size={16} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{load.orderNumber}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-medium">{load.pickupTime} hs - {load.clientName}</p>
                         </div>
                      </div>
                      <Badge variant={load.status === 'on_route' ? 'default' : 'outline'} className="text-[8px] uppercase h-5">
                         {load.status === 'on_route' ? 'En viaje' : 'Pendiente'}
                      </Badge>
                   </div>
                 ))}
                 {(!loads || loads.filter(l => l.pickupDate === format(new Date(), "yyyy-MM-dd")).length === 0) && (
                    <div className="py-10 text-center text-xs text-slate-400 italic">No hay salidas programadas para hoy.</div>
                 )}
               </div>
               <div className="px-4 pt-4">
                  <Button variant="link" className="w-full text-xs font-bold text-blue-600 dark:text-blue-400 p-0 h-auto" asChild>
                    <Link href="/cargas">Ver todos los fletes <ArrowRight size={12} className="ml-1" /></Link>
                  </Button>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-blue-600 dark:bg-blue-700 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={64} /></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-white/70 font-bold tracking-widest">Optimización Bioceánica</CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-[11px] leading-relaxed opacity-90">
                 Detección de retorno vacío en Ruta 9. Recomendamos asignar carga de retorno desde Córdoba para optimizar un 42% el costo de combustible.
               </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
