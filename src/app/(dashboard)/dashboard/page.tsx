
'use client';

import { useMemo, useState } from "react";
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
  Map as MapIcon,
  Activity,
  Zap,
  Info,
  Navigation,
  Building2,
  Star,
  Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Truck, Driver, Load, Hub, Tenant } from "@/app/lib/types";
import { isBefore, addDays, parseISO, isToday, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function MonitorOperativoPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  
  const [searchTerm, setSearchTerm] = useState("");

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
        <Card className="lg:col-span-7 border-none shadow-sm overflow-hidden h-[550px] relative bg-slate-100">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            {tenant?.settings?.mapProvider === 'mapbox' ? (
              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-700 font-mono text-xs uppercase tracking-widest">
                [ Mapbox Professional Layer Active ]
              </div>
            ) : (
              <div className="w-full h-full bg-[url('https://placehold.co/1000x800/e2e8f0/94a3b8?text=Google+Maps+Platform+Active')] bg-cover"></div>
            )}
          </div>
          
          <div className="absolute top-4 left-4 z-10 space-y-2">
            <div className="bg-white/90 backdrop-blur p-3 rounded-lg border shadow-sm text-[10px] font-bold uppercase space-y-2">
              <div className="flex items-center gap-2 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Camiones en Ruta</div>
              <div className="flex items-center gap-2 text-slate-900 font-bold"><Building2 className="w-3 h-3 text-slate-900" /> Sedes / Hubs</div>
              <div className="flex items-center gap-2 text-amber-600 font-bold"><Star className="w-3 h-3 text-amber-600 fill-current" /> Casa Central</div>
              <div className="flex items-center gap-2 text-red-600"><div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div> Incidente Crítico</div>
            </div>
          </div>

          {hubs?.map((hub, i) => (
            <div 
              key={hub.id}
              className="absolute z-10 transition-transform hover:scale-110"
              style={{ left: `${30 + (i * 10)}%`, top: `${20 + (i * 15)}%` }}
            >
              <div className={cn(
                "p-2 rounded-lg shadow-xl border-2 flex flex-col items-center gap-1",
                hub.isMainBase ? "bg-amber-500 text-white border-white" : "bg-slate-900 text-white border-white"
              )}>
                {hub.isMainBase ? <Star size={20} fill="currentColor" /> : <Building2 size={20} />}
                <span className="text-[8px] font-bold whitespace-nowrap">{hub.name}</span>
              </div>
            </div>
          ))}

          {trucks?.filter(t => t.status === 'in_trip').map((truck, i) => (
            <div 
              key={truck.id}
              className="absolute group cursor-pointer transition-transform hover:scale-110"
              style={{ left: `${20 + (i * 15)}%`, top: `${45 + (i * 8)}%` }}
            >
              <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                <TruckIcon size={16} />
              </div>
            </div>
          ))}

          <CardHeader className="absolute bottom-0 right-0 p-4 pointer-events-none">
            <Badge className="bg-white/80 text-slate-900 backdrop-blur border shadow-sm">
              MOTOR: {tenant?.settings?.mapProvider?.toUpperCase() || 'GOOGLE MAPS'}
            </Badge>
          </CardHeader>
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
