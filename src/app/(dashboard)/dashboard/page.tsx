
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
  CheckCircle2,
  Calendar,
  MapPin,
  DollarSign,
  Plus,
  Search,
  MoreVertical,
  Activity,
  Navigation,
  Building2,
  Star,
  Loader2,
  ShieldCheck,
  Zap,
  Globe,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Driver, Load, Hub, Tenant } from "@/app/lib/types";
import { isToday, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
  const [mounted, setMounted] = useState(false);

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
    return collection(db, "loads");
  }, [db]);

  const hubsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "hubs");
  }, [db]);

  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);

  const stats = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);

    const deliveredToday = loads?.filter(l => l.status === 'delivered' && isToday(new Date(l.updatedAt?.seconds * 1000 || l.updatedAt))).length || 0;
    const activeTrucks = trucks?.filter(t => t.status === 'in_trip').length || 0;
    
    const billingMonth = loads?.filter(l => 
      l.status === 'delivered' && 
      new Date(l.updatedAt?.seconds * 1000 || l.updatedAt) >= monthStart
    ).reduce((acc, l) => acc + (l.totalAmount || 0), 0) || 0;

    const incidents = loads?.filter(l => l.status === 'incident').length || 0;

    const totalComexValue = loads?.filter(l => l.serviceType === 'customs' && l.status !== 'cancelled')
      .reduce((acc, l) => acc + (l.international?.cifValueUsd || 0), 0) || 0;

    const docCompliance = trucks ? (trucks.filter(t => t.documentation?.every(d => d.status === 'valid')).length / (trucks.length || 1)) * 100 : 0;

    return { 
      deliveredToday, 
      activeTrucks, 
      billingMonth, 
      incidents, 
      otif: 94.5,
      totalComexValue,
      docCompliance
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
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900'} text-white p-2 rounded-lg shadow-xl border-2 border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>'}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  }) : null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><Globe size={16} /> Red de Carga Regional: {trucks?.length || 0} Unidades</span>
            <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-blue-600"><TruckIcon size={16} /> {stats.activeTrucks} En Tránsito</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/cargas/nuevo"><Plus size={16} className="mr-1" /> Nuevo Flete</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Entregas Hoy" value={stats.deliveredToday} icon={Package} description="Cono Sur" />
        <KPICard title="Flota Activa" value={stats.activeTrucks} icon={TruckIcon} description="En carretera" />
        <KPICard title="OTIF Regional" value={`${stats.otif}%`} icon={CheckCircle2} description="Efectividad" />
        <KPICard title="Facturación" value={stats.billingMonth.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} icon={DollarSign} description="ARS/USD" />
        <KPICard title="Incidencias" value={stats.incidents} icon={AlertTriangle} description="Requiere atención" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden h-[550px] relative">
          {mounted && (
            <MapContainer 
              center={[-28.0, -58.0]} 
              zoom={4} 
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {hubs?.map((hub) => (
                <Marker key={hub.id} position={[hub.lat || -34.6, hub.lng || -58.3]} icon={hubIcon(!!hub.isMainBase)}>
                  <Popup>
                    <div className="p-1">
                      <div className="font-bold text-sm">{hub.name}</div>
                      <div className="text-xs text-slate-500">{hub.country} - {hub.city}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {trucks?.filter(t => t.status === 'in_trip').map((truck) => (
                <Marker key={truck.id} position={[truck.location?.lat || -34.6, truck.location?.lng || -58.3]} icon={truckIcon}>
                  <Popup>
                    <div className="p-1 font-bold text-sm">Patente: {truck.plate}</div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
          
          <div className="absolute top-4 left-4 z-[500] space-y-2 pointer-events-none">
            <div className="bg-white/90 backdrop-blur p-3 rounded-lg border shadow-sm text-[10px] font-bold uppercase space-y-2 pointer-events-auto">
              <div className="flex items-center gap-2 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Tránsito Internacional</div>
              <div className="flex items-center gap-2 text-slate-900 font-bold"><Building2 className="w-3 h-3 text-slate-900" /> Sedes Regionales</div>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Bioceánico Insights
              </CardTitle>
              <CardDescription className="text-white/50 text-[10px]">Rentabilidad del corredor comercial.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Carga en Aduana (Bioceánico)</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-green-400">
                    {stats.totalComexValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </span>
                  <Badge variant="outline" className="border-green-400/30 text-green-400 text-[8px] mb-1.5">CIF USD</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[9px] uppercase font-bold text-white/40 mb-1">Rutas Activas</p>
                  <p className="text-xl font-bold text-blue-400">{stats.activeTrucks}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[9px] uppercase font-bold text-white/40 mb-1">Fronteras</p>
                  <p className="text-xl font-bold text-yellow-400">100%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm h-[200px] flex flex-col items-center justify-center text-center p-6 space-y-3">
             <Globe className="w-10 h-10 text-blue-100" />
             <div>
               <p className="font-bold text-slate-700">Cobertura Total</p>
               <p className="text-[10px] text-slate-400 uppercase tracking-widest">AR · CL · PY · UY · BO · BR</p>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
