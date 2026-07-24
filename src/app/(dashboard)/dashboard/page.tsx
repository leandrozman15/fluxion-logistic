
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
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
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Truck, Driver, Load, LoadStatus } from "@/app/lib/types";
import { isBefore, addDays, parseISO, isToday, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function MonitorOperativoPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveTab] = useState("all");

  // Consultas Memoizadas
  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);
  const loadsQuery = useMemo(() => db ? collection(db, "loads") : null, [db]);

  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);

  // Lógica de Métricas (KPIs)
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

    // Cálculo OTIF Simulado (On-Time In Full)
    const otif = 94.5; 

    return {
      deliveredToday,
      activeTrucks,
      availableTrucks,
      billingMonth,
      incidents,
      otif
    };
  }, [trucks, loads]);

  // Lógica de Alertas Dinâmicos
  const alerts = useMemo(() => {
    const list: any[] = [];
    const now = new Date();
    const warningThreshold = addDays(now, 15);

    // Alertas de Incidente em Cargas
    loads?.filter(l => l.status === 'incident').forEach(l => {
      list.push({ 
        type: "CRÍTICA", 
        title: `Incidente: ${l.orderNumber}`, 
        detail: l.description, 
        color: "bg-red-600",
        icon: AlertTriangle
      });
    });

    // Alertas de Documentação (LINTI / Licença)
    drivers?.forEach(d => {
      if (d.licenseExpiry && isBefore(parseISO(d.licenseExpiry), warningThreshold)) {
        list.push({ 
          type: "CONDUCTOR", 
          title: `Vencimento: ${d.lastName}`, 
          detail: `Licença vence em ${d.licenseExpiry}`, 
          color: "bg-orange-500",
          icon: Users
        });
      }
    });

    return list.slice(0, 4);
  }, [loads, drivers]);

  return (
    <div className="space-y-6">
      {/* ZONA 1: BARRA DE FILTROS Y ACCIONES */}
      <div className="bg-white p-4 rounded-xl border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1.5"><Calendar size={16} /> HOY: {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
            <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-blue-600"><TruckIcon size={16} /> {stats.activeTrucks} Camiones Activos</span>
            <span className="h-4 w-[1px] bg-slate-200 hidden md:block"></span>
            <span className="flex items-center gap-1.5 text-green-600"><Users size={16} /> {stats.availableTrucks} Disponibles</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/cargas/nuevo"><Plus size={16} className="mr-1" /> Nueva Carga</Link>
            </Button>
            <Button variant="outline" size="sm"><TrendingUp size={16} className="mr-1" /> Reporte</Button>
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
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="h-10 px-4">Hoy</Button>
            <Button variant="ghost" size="sm" className="h-10 px-4">Esta Semana</Button>
            <Button variant="ghost" size="sm" className="h-10 px-4">Incidentes</Button>
          </div>
        </div>
      </div>

      {/* ZONA 2: KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard 
          title="Envíos Hoy" 
          value={stats.deliveredToday} 
          icon={Package} 
          description="Entregas finalizadas" 
        />
        <KPICard 
          title="Flota Activa" 
          value={`${stats.activeTrucks}/${trucks?.length || 0}`} 
          icon={TruckIcon} 
          description="Unidades en tránsito" 
        />
        <KPICard 
          title="OTIF %" 
          value={`${stats.otif}%`} 
          icon={CheckCircle2} 
          description="Nivel de servicio" 
        />
        <KPICard 
          title="Facturación" 
          value={stats.billingMonth.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} 
          icon={DollarSign} 
          description="Mes en curso" 
        />
        <KPICard 
          title="Incidencias" 
          value={stats.incidents} 
          icon={AlertTriangle} 
          description="Atención inmediata" 
        />
      </div>

      {/* ZONA 3: CONTENIDO PRINCIPAL (MAPA + TARJETAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Panel Izquierdo: Mapa Simulado (70%) */}
        <Card className="lg:col-span-7 border-none shadow-sm overflow-hidden h-[500px] relative bg-slate-100">
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            {/* Patrón de mapa simulado */}
            <div className="w-full h-full bg-[url('https://placehold.co/1000x800/e2e8f0/94a3b8?text=Mapa+Operativo+Nacional')] bg-cover"></div>
          </div>
          
          <div className="absolute top-4 left-4 z-10 space-y-2">
            <div className="bg-white/90 backdrop-blur p-2 rounded-lg border shadow-sm text-[10px] font-bold uppercase space-y-1">
              <div className="flex items-center gap-2 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600"></div> En Ruta</div>
              <div className="flex items-center gap-2 text-green-600"><div className="w-2 h-2 rounded-full bg-green-600"></div> Entregado</div>
              <div className="flex items-center gap-2 text-red-600"><div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div> Incidente</div>
            </div>
          </div>

          {/* Marcadores de Camiones (Simulados con datos reales) */}
          {trucks?.filter(t => t.status === 'in_trip').map((truck, i) => (
            <div 
              key={truck.id}
              className="absolute group cursor-pointer transition-transform hover:scale-110"
              style={{ 
                left: `${20 + (i * 15)}%`, 
                top: `${30 + (i * 10)}%` 
              }}
            >
              <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                <TruckIcon size={16} />
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-900 text-white text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {truck.plate}
              </div>
            </div>
          ))}

          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button size="icon" variant="secondary" className="bg-white shadow-md"><MapIcon size={18} /></Button>
            <Button size="icon" variant="secondary" className="bg-white shadow-md"><Plus size={18} /></Button>
          </div>
          
          <CardHeader className="absolute top-0 right-0 p-4 pointer-events-none">
            <Badge className="bg-white/80 text-slate-900 backdrop-blur">LIVE TRACKING</Badge>
          </CardHeader>
        </Card>

        {/* Panel Derecho: Viajes Activos (30%) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <Zap size={16} className="text-blue-600" /> VIAJES ACTIVOS
            </h3>
            <Button variant="link" size="sm" className="text-[10px] uppercase font-bold p-0">Ver Todos</Button>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[450px] pr-2">
            {loads?.filter(l => l.status === 'on_route' || l.status === 'assigned' || l.status === 'incident').map((load) => (
              <Card key={load.id} className={cn(
                "border shadow-none hover:shadow-md transition-all cursor-pointer",
                load.status === 'incident' ? "border-red-200 bg-red-50/10" : ""
              )}>
                <CardContent className="p-3 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-xs">#{load.orderNumber}</div>
                    <Badge className={cn(
                      "text-[8px] uppercase",
                      load.status === 'on_route' ? "bg-blue-100 text-blue-700" :
                      load.status === 'incident' ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"
                    )}>
                      {load.status === 'on_route' ? 'En Ruta' : load.status === 'incident' ? 'Incidente' : 'Asignado'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{load.clientName}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <MapPin size={10} className="text-slate-400" />
                      <span className="truncate">{load.origin.province} → {load.destination.province}</span>
                    </div>
                  </div>

                  {load.status === 'on_route' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-bold text-slate-400">
                        <span>PROGRESO</span>
                        <span>75%</span>
                      </div>
                      <Progress value={75} className="h-1 bg-slate-100" />
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-7 text-[9px] flex-1">DETALLES</Button>
                    <Button variant="secondary" size="sm" className="h-7 text-[9px] flex-1">MAPA</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!loads || loads.length === 0) && (
              <div className="text-center py-10 text-slate-400 text-xs italic">No hay viajes activos.</div>
            )}
          </div>
        </div>
      </div>

      {/* ZONA 4: ACTIVIDAD Y ALERTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actividad Reciente */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity size={16} className="text-blue-600" /> Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {loads?.slice(0, 6).map((load) => (
                <div key={load.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <Clock size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{load.orderNumber}</p>
                      <p className="text-[10px] text-slate-500">Estado cambiado a: <span className="font-semibold text-blue-600">{load.status}</span></p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">Hace 15m</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas Críticas */}
        <Card className="bg-slate-900 text-white border-none shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" /> Alertas Críticas & Vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2 opacity-40">
                <CheckCircle2 size={32} />
                <p className="text-xs">No hay alertas activas.</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-start gap-3 hover:bg-white/10 transition-colors cursor-pointer">
                  <div className={cn("p-1.5 rounded-md", alert.color)}>
                    <alert.icon size={14} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-bold uppercase opacity-50">{alert.type}</span>
                      <span className="text-[8px] opacity-40">AHORA</span>
                    </div>
                    <p className="text-xs font-bold">{alert.title}</p>
                    <p className="text-[10px] opacity-60 leading-tight">{alert.detail}</p>
                  </div>
                </div>
              ))
            )}
            {alerts.length > 0 && (
              <Button variant="ghost" className="w-full text-[10px] opacity-50 hover:opacity-100 uppercase font-bold" size="sm">
                Gestionar todas as Alertas
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
