
'use client';

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { 
  Truck as TruckIcon, 
  Users, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  Calendar,
  MapPin,
  DollarSign,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Phone,
  FileText,
  Activity,
  Navigation,
  Building2,
  Star,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Driver, Load, Hub, Tenant } from "@/app/lib/types";
import { isToday, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Dynamic import for the Map to avoid SSR errors
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 flex items-center justify-center"><Loader2 className="animate-spin" /></div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

export default function MonitorOperativoPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);
  const loadsQuery = useMemo(() => db ? collection(db, "loads") : null, [db]);
  const hubsQuery = useMemo(() => db ? collection(db, "hubs") : null, [db]);

  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: tenant } = useDoc<Tenant>(useMemo(() => db ? doc(db, "tenants", tenantId) : null, [db, tenantId]));

  const mainBase = useMemo(() => hubs?.find(h => h.isMainBase), [hubs]);

  const stats = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);

    const deliveredToday = loads?.filter(l => l.status === 'delivered' && isToday(new Date(l.updatedAt?.seconds * 1000 || l.updatedAt))).length || 0;
    const activeTrucks = trucks?.filter(t => t.status === 'in_trip').length || 0;
    const availableTrucks = trucks?.filter(t => t.status === 'available').length || 0;
    
    const billingMonth = loads?.filter(l => 
      l.status === 'delivered' && 
      new Date(l.updatedAt?.seconds * 1000 || l.updatedAt) >= monthStart
    ).reduce((acc, l) => acc + (l.totalAmount || 0), 0) || 0;

    const incidents = loads?.filter(l => l.status === 'incident').length || 0;

    return { deliveredToday, activeTrucks, availableTrucks, billingMonth, incidents, otif: 94.5 };
  }, [trucks, loads]);

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }) : null;

  const hubIcon = (isMain: boolean) => L ? L.divIcon({
    className: 'custom-hub-icon',
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900'} text-white p-2 rounded-lg shadow-xl border-2 border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>'}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  }) : null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><Calendar size={16} /> HOY: {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
            <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-blue-600"><TruckIcon size={16} /> {stats.activeTrucks} Camiones Activos</span>
            {mainBase && (
              <>
                <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
                <span className="flex items-center gap-1.5 text-amber-600"><Star size={16} fill="currentColor" /> Base: {mainBase.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/cargas/nuevo"><Plus size={16} className="mr-1" /> Nueva Carga</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/sedes"><Building2 size={16} className="mr-1" /> Gestionar Sedes</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar orden, cliente, patente..." 
              className="pl-9 h-10" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Envíos Hoy" value={stats.deliveredToday} icon={Package} description="Entregas finalizadas" />
        <KPICard title="Flota Activa" value={`${stats.activeTrucks}/${trucks?.length || 0}`} icon={TruckIcon} description="Unidades en tránsito" />
        <KPICard title="OTIF %" value={`${stats.otif}%`} icon={CheckCircle2} description="Nivel de servicio" />
        <KPICard title="Facturación" value={stats.billingMonth.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={DollarSign} description="Mes en curso" />
        <KPICard title="Incidencias" value={stats.incidents} icon={AlertTriangle} description="Atención inmediata" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <Card className="lg:col-span-7 border-none shadow-sm overflow-hidden h-[550px] relative">
          {typeof window !== 'undefined' && (
            <MapContainer 
              center={[-34.6037, -58.3816]} 
              zoom={5} 
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {/* Hubs / Sedes */}
              {hubs?.map((hub) => (
                <Marker 
                  key={hub.id} 
                  position={[hub.lat || -34.6, hub.lng || -58.3]} 
                  icon={hubIcon(!!hub.isMainBase)}
                >
                  <Popup>
                    <div className="p-1">
                      <div className="font-bold text-sm">{hub.name}</div>
                      <div className="text-xs text-slate-500">{hub.type.toUpperCase()} - {hub.city}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Camiones activos */}
              {trucks?.filter(t => t.status === 'in_trip').map((truck) => (
                <Marker 
                  key={truck.id} 
                  position={[truck.location?.lat || -34.6, truck.location?.lng || -58.3]} 
                  icon={truckIcon}
                >
                  <Popup>
                    <div className="p-1">
                      <div className="font-bold text-sm">Caminhão: {truck.plate}</div>
                      <div className="text-xs">{truck.brand} {truck.model}</div>
                      <Badge className="mt-2 h-5 text-[10px]">EN RUTA</Badge>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
          
          <div className="absolute top-4 left-4 z-[500] space-y-2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur p-3 rounded-lg border shadow-sm text-[10px] font-bold uppercase space-y-2 pointer-events-auto">
              <div className="flex items-center gap-2 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Camiones en Ruta</div>
              <div className="flex items-center gap-2 text-slate-900 font-bold"><Building2 className="w-3 h-3 text-slate-900" /> Sedes / Hubs</div>
              <div className="flex items-center gap-2 text-amber-600 font-bold"><Star className="w-3 h-3 text-amber-600 fill-current" /> Casa Central</div>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 uppercase tracking-tight">
            <Building2 size={16} className="text-blue-600" /> Sedes Activas
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-[480px] pr-2">
            {hubs?.map((hub) => (
              <Card key={hub.id} className={cn(
                "border shadow-none hover:shadow-md transition-all",
                hub.isMainBase && "border-amber-200 bg-amber-50/30"
              )}>
                <CardContent className="p-3">
                   <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-xs">{hub.name}</div>
                        {hub.isMainBase && <Star size={12} className="text-amber-500 fill-current" />}
                      </div>
                      <Badge variant="outline" className="text-[8px] uppercase">{hub.type}</Badge>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <MapPin size={10} /> {hub.city}, {hub.province}
                   </div>
                </CardContent>
              </Card>
            ))}
            {(!hubs || hubs.length === 0) && (
              <div className="text-center py-10 text-slate-400 text-xs italic border-2 border-dashed rounded-xl">
                No hay sedes registradas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
