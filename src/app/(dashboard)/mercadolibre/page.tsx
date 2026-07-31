
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingBag, 
  Truck, 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Navigation, 
  BarChart3, 
  Timer,
  Search,
  Loader2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin
} from "lucide-react";
import { Load, Truck as TruckType, Driver } from "@/app/lib/types";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatSafeDate } from "@/lib/utils/date-utils";

export default function MercadoLibrePage() {
  const db = useFirestore();
  
  // Consultamos todos los fletes para filtrar en memoria por Mercado Libre
  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);

  const { data: loads, loading } = useCollection<Load>(loadsQuery);
  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  // Filtramos fletes cuyo cliente sea Mercado Libre o tengan servicios FTL para la plataforma
  const meliLoads = useMemo(() => {
    if (!loads) return [];
    return loads.filter(l => 
      l.clientName.toLowerCase().includes("mercado libre") || 
      l.clientName.toLowerCase().includes("meli") ||
      l.orderNumber.startsWith("ML") // Convención de nomenclatura
    );
  }, [loads]);

  const stats = useMemo(() => {
    const total = meliLoads.length;
    const delivered = meliLoads.filter(l => l.status === 'delivered').length;
    const onRoute = meliLoads.filter(l => l.status === 'on_route' || l.status === 'on_pause').length;
    const incidents = meliLoads.filter(l => l.status === 'incident').length;
    const compliance = total > 0 ? (delivered / total) * 100 : 0;

    return { total, delivered, onRoute, incidents, compliance };
  }, [meliLoads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center text-slate-900 shadow-lg shadow-yellow-100">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Canal Mercado Libre</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Monitoreo de despachos Full y colecta de envíos.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 bg-yellow-50 text-yellow-700 border-yellow-200 font-black italic">
          OPERACIÓN ACTIVA 2026
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Total Despachos</p>
              <p className="text-xl font-black text-slate-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Entregados OK</p>
              <p className="text-xl font-black text-green-700">{stats.delivered}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Compliance</p>
              <p className="text-xl font-black text-blue-400">{Math.round(stats.compliance)}% SLA</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Incidentes ML</p>
              <p className="text-xl font-black text-red-600">{stats.incidents}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Buzón de Despachos Mercado Libre</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Seguimiento de arribos a depósitos Full y Colectas</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar por OT..." className="pl-9 h-9 rounded-xl text-xs" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-yellow-500" /></div>
          ) : meliLoads.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <ShoppingBag size={48} className="mx-auto text-slate-100" />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest italic">No hay fletes registrados para Mercado Libre aún</p>
              <Button variant="outline" asChild><Link href="/cargas/nuevo">Crear Despacho</Link></Button>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Orden / Fecha</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Punto de Entrega (MELI)</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Recursos Asignados</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Progreso</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Seguimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meliLoads.map((load) => {
                  const driver = drivers?.find(d => d.id === load.assignedDriverId);
                  const truck = trucks?.find(t => t.id === load.assignedTruckId);
                  const progress = load.status === 'delivered' ? 100 : (load.tracking?.distanceTraveledKm || 0);

                  return (
                    <TableRow key={load.id} className="hover:bg-yellow-50/30 transition-all group">
                      <TableCell className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-blue-600 text-sm">{load.orderNumber}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{formatSafeDate(load.createdAt, "dd/MM/yyyy")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-xs font-black text-slate-900 uppercase truncate">{load.outboundStops?.[0]?.name || 'Depósito MELI'}</span>
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold mt-1">
                            <MapPin size={10} className="text-yellow-500" /> {load.outboundStops?.[0]?.city || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Truck size={12} className="text-slate-400" /> {truck?.plate || 'S/D'}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">
                            {driver ? `${driver.lastName}, ${driver.firstName[0]}.` : 'Sin asignar'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24 space-y-1.5">
                          <div className="flex justify-between text-[8px] font-black uppercase">
                            <span>Avance</span>
                            <span className="text-blue-600">{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-1 bg-slate-100" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase border-none h-4",
                          load.status === 'delivered' ? "bg-green-600" : 
                          load.status === 'on_route' ? "bg-blue-600 animate-pulse" : "bg-orange-500"
                        )}>
                          {load.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-yellow-100 text-yellow-700" asChild>
                          <Link href={`/rutas/${load.id}`}>
                            <Navigation size={18} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-yellow-500 shadow-inner border border-yellow-100">
            <Timer size={32} />
          </div>
          <div>
            <p className="text-xl font-black italic text-yellow-800 tracking-tighter uppercase leading-none">Desempeño del Canal</p>
            <p className="text-xs text-yellow-700/60 font-bold mt-1">Métricas de puntualidad en colectas de última milla.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 px-6 border-l border-yellow-200 hidden md:grid">
           <div>
              <p className="text-[10px] font-black text-yellow-600 uppercase">Tiempo Carga</p>
              <p className="text-2xl font-black text-yellow-900">42m <span className="text-[10px] font-normal opacity-50 italic">avg</span></p>
           </div>
           <div>
              <p className="text-[10px] font-black text-yellow-600 uppercase">Devoluciones</p>
              <p className="text-2xl font-black text-yellow-900">0.8% <span className="text-[10px] font-normal opacity-50 italic">ok</span></p>
           </div>
        </div>
      </div>
    </div>
  );
}
