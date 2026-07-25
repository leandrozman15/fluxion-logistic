
'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, where, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Route as RouteIcon, 
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
  ExternalLink,
  Play,
  Compass
} from "lucide-react";
import { Load, LoadStatus } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function DriverRoutesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

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

  const handleStartTrip = async (loadId: string, destination: any) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "loads", loadId), {
        status: 'on_route',
        updatedAt: serverTimestamp()
      });
      toast({ title: "¡Buen viaje!", description: "Rastreo activo. Iniciando navegación nativa..." });
      
      const lat = destination.lat || -34.6;
      const lng = destination.lng || -58.3;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS 
        ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
        : `google.navigation:q=${lat},${lng}`;
      
      window.location.href = url;
    } catch (e) {
      toast({ variant: "destructive", title: "Error al iniciar" });
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
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200"><Package size={32} /></div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No tienes viajes asignados</p>
            </CardContent>
          </Card>
        ) : (
          routes?.map((route) => {
            const config = getStatusConfig(route.status);
            const lastStop = route.outboundStops?.[route.outboundStops.length - 1];
            const destAddress = lastStop?.address || 'Destino no definido';

            const totalDocs = (route.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0) + 
                             (route.returnStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0);

            return (
              <Card key={route.id} className="hover:border-blue-300 transition-all active:scale-[0.98] mb-8 overflow-hidden border-2 shadow-xl rounded-2xl">
                <div className={cn("h-2 w-full", config.color.split(' ')[0])}></div>
                
                <CardContent className="p-4 space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100"><FileText size={16} /></div>
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
                      <p className="text-xs font-black text-slate-800 leading-tight">{route.origin?.name || 'Origen no definido'}</p>
                      <p className="text-[11px] text-slate-500 font-medium flex items-start gap-2">
                        <MapPin size={14} className="text-slate-300 shrink-0 mt-0.5" /> {route.origin?.address}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                        <Clock size={12} /> {route.pickupDate} - {route.pickupTime} hs
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
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter mb-1">Destino Final</p>
                        <p className="font-bold text-slate-900 flex items-start gap-2 italic">
                          <Navigation size={14} className="text-blue-500 shrink-0 mt-0.5" /> {destAddress}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-3 text-[11px] font-black uppercase">
                        <span>Distancia Est.</span>
                        <span className="text-right">~700 KM</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100">
                    {route.status === 'assigned' && (
                      <Button className="h-14 text-sm font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 animate-pulse" onClick={() => handleStartTrip(route.id, lastStop)}>
                        <Play size={18} className="mr-2" /> INICIAR VIAJE (GPS)
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-12 text-[11px] font-black bg-white border-slate-200" asChild>
                        <Link href={`/rutas/${route.id}`}>
                          <Compass size={16} className="mr-2 text-blue-600" /> VER MAPA
                        </Link>
                      </Button>
                      <Button variant="outline" className="h-12 text-[11px] font-black bg-white border-slate-200" asChild>
                        <Link href={`/cargas/${route.id}/orden`}>
                          <FileText size={16} className="mr-2 text-slate-500" /> HOJA RUTA
                        </Link>
                      </Button>
                    </div>
                    <Button variant="outline" className="h-12 text-[11px] font-black col-span-2 border-slate-200 text-slate-700 bg-slate-50" onClick={() => window.open('tel:0800LOGISTICA')}>
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
