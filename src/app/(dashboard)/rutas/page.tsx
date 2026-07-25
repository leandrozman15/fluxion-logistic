'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Route, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Truck, 
  Package, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Calendar,
  Navigation,
  FileText,
  Phone,
  ShieldAlert,
  Info,
  Layers,
  Repeat,
  ExternalLink
} from "lucide-react";
import { Load, LoadStatus } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function DriverRoutesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  // No MVP, buscamos todas as cargas. Em produção, filtramos por user.uid (assignedDriverId)
  const routesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: routes, loading } = useCollection<Load>(routesQuery);

  const getStatusConfig = (status: LoadStatus) => {
    switch (status) {
      case 'pending': return { label: 'Pendiente', color: 'bg-orange-100 text-orange-700', border: 'border-orange-500' };
      case 'assigned': return { label: 'Asignada', color: 'bg-blue-100 text-blue-700', border: 'border-blue-500' };
      case 'on_route': return { label: 'En Ruta', color: 'bg-blue-600 text-white', border: 'border-blue-700' };
      case 'delivered': return { label: 'Entregada', color: 'bg-green-100 text-green-700', border: 'border-green-500' };
      case 'incident': return { label: 'Incidente', color: 'bg-red-100 text-red-700', border: 'border-red-500' };
      default: return { label: status, color: 'bg-slate-100 text-slate-600', border: 'border-slate-300' };
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 px-2">
      <div className="flex items-center gap-2 pt-4">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
           <Truck size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter">Mis Viajes</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Asistente Digital para Conducción</p>
        </div>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : routes?.length === 0 ? (
          <Card className="border-dashed py-20 text-center rounded-2xl">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                 <Package size={32} />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No tienes viajes asignados</p>
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>Actualizar Panel</Button>
            </CardContent>
          </Card>
        ) : (
          routes?.map((route) => {
            const config = getStatusConfig(route.status);
            const destAddress = route.outboundStops && route.outboundStops.length > 0 
                               ? route.outboundStops[route.outboundStops.length - 1].address 
                               : (route.destination?.address || 'Destino no definido');

            const totalDocs = (route.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0) + 
                             (route.returnStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0);

            return (
              <Card key={route.id} className="hover:border-blue-300 transition-all active:scale-[0.98] mb-8 overflow-hidden border-2 shadow-xl rounded-2xl">
                {/* Status indicator bar */}
                <div className={cn("h-2 w-full", config.color.split(' ')[0])}></div>
                
                <CardContent className="p-4 space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                         <FileText size={16} />
                      </div>
                      <span className="font-black text-lg tracking-tighter text-slate-900">{route.orderNumber}</span>
                    </div>
                    <Badge className={cn("text-[9px] uppercase font-black px-3 py-1", config.color, "border-none shadow-sm")} variant="outline">
                      {config.label}
                    </Badge>
                  </div>

                  {/* Section: Presentarse en Origen */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Calendar size={12} className="text-blue-500" /> Presentarse en Origen
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-blue-500 space-y-2">
                      <p className="text-xs font-black text-slate-800 leading-tight">
                        {route.origin?.name || 'Origen no definido'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium flex items-start gap-2">
                        <MapPin size={14} className="text-slate-300 shrink-0 mt-0.5" /> 
                        {route.origin?.address}
                      </p>
                      <div className="flex items-center gap-4 pt-1">
                         <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                           <Clock size={12} /> {route.pickupDate} - {route.pickupTime} hs
                         </div>
                      </div>
                      <p className="text-[9px] text-orange-600 font-black flex items-center gap-1.5 pt-1 uppercase italic">
                         <ShieldAlert size={12} /> Llegar 15 min antes para control de seguridad
                      </p>
                    </div>
                  </div>

                  {/* Section: Detalles del Viaje */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Truck size={12} className="text-blue-500" /> Detalles del Viaje
                    </div>
                    <div className="p-4 bg-blue-50/20 rounded-2xl border border-blue-100/50 space-y-4">
                      <div className="text-xs">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter mb-1">Destino Final del Tramo</p>
                        <p className="font-bold text-slate-900 flex items-start gap-2 italic">
                          <Navigation size={14} className="text-blue-500 shrink-0 mt-0.5" />
                          {destAddress}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-3">
                        <div className="space-y-0.5">
                           <p className="text-[9px] font-black text-slate-400 uppercase">Distancia Est.</p>
                           <p className="text-sm font-black text-slate-700 italic">~700 KM</p>
                        </div>
                        <div className="space-y-0.5">
                           <p className="text-[9px] font-black text-slate-400 uppercase">Tiempo Est.</p>
                           <p className="text-sm font-black text-slate-700 italic">8:30 HS</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Retorno */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Repeat size={12} className="text-orange-500" /> Retorno Programado
                    </div>
                    <div className="p-4 bg-orange-50/20 rounded-2xl border border-orange-100/50 space-y-3">
                      <div className="flex items-center gap-2">
                        {route.isRoundTrip ? (
                          <Badge className="bg-green-100 text-green-700 border-none text-[9px] font-black uppercase">
                            <CheckCircle2 size={10} className="mr-1" /> SI (Con Carga de Regreso)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-200 text-[9px] font-black uppercase">
                            <ShieldAlert size={10} className="mr-1" /> NO (Solo Ida)
                          </Badge>
                        )}
                      </div>
                      {route.isRoundTrip && (
                        <div className="text-xs space-y-2">
                          <div>
                            <p className="text-[9px] font-black text-orange-400 uppercase mb-1">Descarga Final de Retorno</p>
                            <p className="font-bold text-slate-800 leading-tight">
                               {route.returnDestination?.name || 'Sede Central'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1 italic">{route.returnDestination?.address || 'Dirección de base'}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-orange-700">
                             <Clock size={12} /> {route.returnEstimatedArrivalDate || 'Pend.'} - {route.returnEstimatedArrivalTime || '--:--'} hs
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: Documentación */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Layers size={12} className="text-slate-500" /> Documentación Obligatoria
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 gap-2">
                       <div className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                         <div className="w-4 h-4 rounded-md bg-green-500 text-white flex items-center justify-center shadow-sm"><CheckCircle2 size={10} /></div>
                         Carta de Porte Digital (Habilitada)
                       </div>
                       {totalDocs > 0 ? (
                         <div className="flex items-center gap-2 text-[11px] font-black text-slate-700">
                           <div className="w-4 h-4 rounded-md bg-green-500 text-white flex items-center justify-center shadow-sm"><CheckCircle2 size={10} /></div>
                           {totalDocs} Remitos Vinculados a Hoja
                         </div>
                       ) : (
                         <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 italic">
                           <div className="w-4 h-4 rounded-md border-2 border-dashed border-slate-300"></div>
                           Sin remitos cargados por sistema
                         </div>
                       )}
                       <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                          <div className="w-4 h-4 rounded-md border-2 border-slate-300"></div>
                          LINTI (Confirmar Vigencia en Carnet)
                       </div>
                    </div>
                  </div>

                  {/* Section: Instrucciones */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest">
                      <Info size={12} /> Instrucciones Especiales
                    </div>
                    <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 text-[11px] text-red-700 font-bold leading-relaxed shadow-inner">
                       <ul className="list-disc pl-5 space-y-1.5 italic">
                         <li>{route.origin?.instructions || "Verificar muelles habilitados al llegar"}</li>
                         <li>Control de precintos obligatorio en salida de báscula</li>
                         <li>Informar desvíos mayores a 15 min al centro de control</li>
                       </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                    <Button className="h-12 text-[11px] font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" asChild>
                      <Link href={`/rutas/${route.id}`}>
                        <Navigation size={16} className="mr-2" /> VER MAPA / GPS
                      </Link>
                    </Button>
                    <Button variant="outline" className="h-12 text-[11px] font-black border-slate-200 text-slate-700 bg-white hover:bg-slate-50" asChild>
                      <Link href={`/cargas/${route.id}/orden`}>
                        <FileText size={16} className="mr-2" /> HOJA RUTA PDF
                      </Link>
                    </Button>
                    <Button variant="outline" className="h-12 text-[11px] font-black col-span-2 border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100" onClick={() => window.open('tel:0800LOGISTICA')}>
                      <Phone size={16} className="mr-2" /> LLAMAR A LA CENTRAL
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
