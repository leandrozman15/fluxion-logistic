'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, where, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { 
  Package, 
  Loader2,
  Calendar,
  MapPin,
  Clock,
  Compass,
  FileText,
  Phone,
  Play,
  CheckCircle2,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";
import { Load, LoadStatus } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function DriverRoutesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Generar rango de fechas para el carrusel (-4 a +4 días)
  const dateRange = useMemo(() => {
    const dates = [];
    for (let i = -4; i <= 4; i++) {
      dates.push(addDays(new Date(), i));
    }
    return dates;
  }, []);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const routesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("pickupDate", "asc"));
  }, [db]);

  const { data: routes, loading } = useCollection<Load>(routesQuery);

  // Mapeo de estados por fecha para el carrusel
  const dateStatusMap = useMemo(() => {
    if (!routes) return {};
    const map: Record<string, { hasTrips: boolean; allDelivered: boolean }> = {};
    
    routes.forEach(r => {
      const d = r.pickupDate;
      if (!map[d]) {
        map[d] = { hasTrips: true, allDelivered: true };
      }
      if (r.status !== 'delivered') {
        map[d].allDelivered = false;
      }
    });
    return map;
  }, [routes]);

  // 2. Centrar el carrusel en el día actual al cargar
  useEffect(() => {
    if (scrollRef.current) {
      const todayEl = scrollRef.current.querySelector('[data-today="true"]');
      if (todayEl) {
        todayEl.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      }
    }
  }, [loading]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 150 : scrollLeft + 150;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  // 3. Filtrar rutas por la fecha seleccionada en el carrusel
  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    return routes.filter(r => r.pickupDate === selectedDate);
  }, [routes, selectedDate]);

  // 4. Configuración de colores para las tarjetas de flete
  const getStatusConfig = (status: LoadStatus) => {
    switch (status) {
      case 'delivered': 
        return { 
          label: 'Completado', 
          color: 'bg-green-100 text-green-700', 
          border: 'border-green-500', 
          accent: 'bg-green-500',
          icon: CheckCircle2 
        };
      case 'on_route':
      case 'on_pause':
      case 'incident':
        return { 
          label: 'Viaje Actual', 
          color: 'bg-orange-100 text-orange-700', 
          border: 'border-orange-500', 
          accent: 'bg-orange-500',
          icon: History 
        };
      case 'pending':
      case 'assigned':
      default:
        return { 
          label: 'Asignado', 
          color: 'bg-blue-100 text-blue-700', 
          border: 'border-blue-500', 
          accent: 'bg-blue-500',
          icon: Calendar 
        };
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
    <div className="max-w-md mx-auto space-y-6 pb-24 px-2">
      {/* Header Estilizado con Botón de Perfil */}
      <div className="flex items-center justify-between pt-6 px-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shadow-lg border-2 border-white bg-white">
            <Image src="/icono.png" alt="App Icon" width={48} height={48} className="object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">Mis Viajes</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Asistente Digital para Conducción</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 text-blue-600" asChild>
          <Link href="/rutas/perfil">
            <User size={20} />
          </Link>
        </Button>
      </div>

      {/* Carrusel de Fechas con Lógica de Colores de Estado */}
      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Navegar Agenda</p>
        <div className="relative group px-1">
          <button 
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <div 
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto pb-4 px-8 no-scrollbar scroll-smooth"
          >
            {dateRange.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isSelected = selectedDate === dateStr;
              const isToday = isSameDay(date, new Date());
              const status = dateStatusMap[dateStr];
              
              // Lógica de colores según el requerimiento del usuario
              let boxStyles = "bg-white border-slate-100 text-slate-300"; // Gris (Sin viajes)
              
              if (isToday) {
                boxStyles = "bg-blue-600 border-blue-600 text-white shadow-blue-200"; // Azul (Hoy)
              } else if (status?.hasTrips) {
                if (status.allDelivered) {
                  boxStyles = "bg-green-600 border-green-600 text-white shadow-green-100"; // Verde (Cumplido)
                } else {
                  boxStyles = "bg-orange-500 border-orange-500 text-white shadow-orange-100"; // Naranja (Asignado)
                }
              }

              return (
                <button
                  key={dateStr}
                  data-today={isToday}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[65px] h-20 rounded-2xl border-2 transition-all shrink-0",
                    boxStyles,
                    isSelected && "scale-110 shadow-lg ring-2 ring-offset-2 ring-blue-100 z-10"
                  )}
                >
                  <span className={cn(
                    "text-[9px] font-black uppercase mb-1",
                    isToday || status?.hasTrips ? "text-white/70" : "text-slate-400"
                  )}>
                    {format(date, "EEE", { locale: es })}
                  </span>
                  <span className="text-lg font-black leading-none">
                    {format(date, "d")}
                  </span>
                  {isToday && !isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white mt-1"></div>
                  )}
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Listado de Viajes */}
      <div className="space-y-6 px-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando con Central...</p>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
              <Calendar className="text-slate-200" size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Agenda Libre</p>
              <p className="text-[10px] text-slate-400 px-10">No tienes viajes programados para esta fecha.</p>
            </div>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const config = getStatusConfig(route.status);
            const lastStop = route.outboundStops?.[route.outboundStops.length - 1];

            return (
              <Card 
                key={route.id} 
                className={cn(
                  "overflow-hidden border-2 shadow-xl rounded-3xl transition-all active:scale-[0.98]",
                  config.border
                )}
              >
                <div className={cn("h-3 w-full", config.accent)}></div>
                
                <CardContent className="p-5 space-y-6">
                  {/* Status Badge Custom */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner", config.color)}>
                        <config.icon size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-lg tracking-tighter text-slate-900 leading-none">{route.orderNumber}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Flete Multidestino</span>
                      </div>
                    </div>
                    <Badge className={cn("text-[9px] uppercase font-black px-3 py-1.5 border-none shadow-sm", config.color)}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Detalle del Punto de Carga */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      <MapPin size={12} className="text-blue-500" /> Punto de Presentación
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                      <div>
                        <p className="text-sm font-black text-slate-800 leading-tight uppercase">{route.origin?.name || 'Sede Central'}</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{route.origin?.address}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          <Clock size={12} /> {route.pickupTime} hs
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                           <Package size={12} /> {(route.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0).toLocaleString()} Kg
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones principales */}
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {(route.status === 'assigned' || route.status === 'pending') && (
                      <Button className="h-16 text-sm font-black bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 rounded-2xl animate-pulse" onClick={() => handleStartTrip(route.id, lastStop)}>
                        <Play size={20} className="mr-2 fill-current" /> INICIAR VIAJE (GPS)
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-14 text-[11px] font-black bg-white border-slate-200 rounded-2xl flex flex-col gap-1" asChild>
                        <Link href={`/rutas/${route.id}`}>
                          <Compass size={18} className="text-blue-600" />
                          VER MAPA
                        </Link>
                      </Button>
                      <Button variant="outline" className="h-14 text-[11px] font-black bg-white border-slate-200 rounded-2xl flex flex-col gap-1" asChild>
                        <Link href={`/cargas/${route.id}/orden`}>
                          <FileText size={18} className="text-slate-500" />
                          HOJA RUTA
                        </Link>
                      </Button>
                    </div>

                    <Button variant="ghost" className="h-12 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 rounded-2xl" onClick={() => window.open('tel:0800LOGISTICA')}>
                      <Phone size={14} className="mr-2" /> Central de Ayuda
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center pb-6">
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">LogísticaAr Digital Fleet v2.0</p>
      </div>
    </div>
  );
}
