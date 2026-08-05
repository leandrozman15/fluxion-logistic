'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { 
  Loader2,
  Calendar,
  Compass,
  FileText,
  CheckCircle2,
  History,
  ChevronLeft,
  ChevronRight,
  User,
  ShoppingBag,
  Truck,
  Zap,
  MessageCircle,
  Headset
} from "lucide-react";
import { Driver, Load, LoadStatus } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { format, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { normalizePhone, buildWaMeUrl } from "@/lib/utils/whatsapp";
import { listLoads } from "@/lib/loads-api";
import { listDrivers } from "@/lib/drivers-api";
import { getTenantProfile } from "@/lib/settings-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DriverRoutesPage() {
  const { tenantId, role } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rawRoutes, setRawRoutes] = useState<Load[]>([]);
  const [myDriverId, setMyDriverId] = useState<string | null>(null);
  const [myDriver, setMyDriver] = useState<Driver | null>(null);

  const dateRange = useMemo(() => {
    const dates = [];
    for (let i = -4; i <= 4; i++) {
      dates.push(addDays(new Date(), i));
    }
    return dates;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setRawRoutes([]);
          setTenant(null);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const [routesData, tenantData, driversData] = await Promise.all([listLoads(), getTenantProfile(), listDrivers()]);
        if (!active) return;
        setRawRoutes(routesData);
        setTenant(tenantData);
        const myEmail = user?.email?.toLowerCase().trim();
        const foundDriver = myEmail ? driversData.find(d => d.email?.toLowerCase().trim() === myEmail) : null;
        setMyDriverId(foundDriver?.id || null);
        setMyDriver(foundDriver || null);
      } catch {
        if (!active) return;
        setRawRoutes([]);
        setTenant(null);
        setMyDriverId(null);
        setMyDriver(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, user?.email]);

  const routes = useMemo(() => {
    if (!rawRoutes) return [];
    
    return rawRoutes
      .filter(r => {
        // Filtrar por conductor logueado (si el rol es chofer): matchea por el Driver real (resuelto por email),
        // NO por user.uid, ya que Load.assignedDriverId referencia el id del registro Driver, no el UID de Firebase Auth.
        const matchesDriver = role === 'driver' ? !!myDriverId && r.assignedDriverId === myDriverId : true;
        // Excluir archivados del panel del chofer
        const notArchived = r.status !== 'archived';
        return matchesDriver && notArchived;
      })
      .sort((a, b) => {
        const dateTimeA = `${a.pickupDate} ${a.pickupTime}`;
        const dateTimeB = `${b.pickupDate} ${b.pickupTime}`;
        return dateTimeA.localeCompare(dateTimeB);
      });
  }, [rawRoutes, role, myDriverId]);

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

  const handleContactCentral = (type: 'call' | 'whatsapp') => {
    const centralPhone = tenant?.settings?.centralPhone;
    if (!centralPhone) {
      toast({ variant: "destructive", title: "Número no configurado", description: "La central no ha definido un número de contacto." });
      return;
    }

    const normalized = normalizePhone(centralPhone);
    if (type === 'call') {
      window.open(`tel:${normalized}`, '_self');
    } else {
      window.open(buildWaMeUrl(normalized!, "Hola, soy el chofer del viaje activo. Necesito comunicarme."), '_blank');
    }
  };

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    return routes.filter(r => r.pickupDate === selectedDate);
  }, [routes, selectedDate]);

  const getStatusConfig = (status: LoadStatus) => {
    switch (status) {
      case 'delivered': 
        return { label: 'Completado', color: 'bg-green-100 text-green-700', border: 'border-green-500', accent: 'bg-green-500', icon: CheckCircle2 };
      case 'on_route':
      case 'on_pause':
      case 'incident':
        return { label: 'En Curso', color: 'bg-orange-100 text-orange-700', border: 'border-orange-500', accent: 'bg-orange-500', icon: History };
      default:
        return { label: 'Asignado', color: 'bg-blue-100 text-blue-700', border: 'border-blue-500', accent: 'bg-blue-500', icon: Calendar };
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 px-2">
      <div className="flex items-center justify-between pt-6 px-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shadow-lg border-2 border-white bg-white">
            <Image src="/icono.png" alt="App Icon" width={48} height={48} className="object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">Mi Agenda</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{myDriver ? `Hola, ${myDriver.firstName}!` : 'Asistente Digital para Conducción'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100" onClick={() => handleContactCentral('call')}>
            <Headset size={20} />
          </Button>
          <Link href="/rutas/perfil">
            <Avatar className="w-10 h-10 border border-slate-100 shadow-sm">
              <AvatarImage src={myDriver?.avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-blue-50 text-blue-600">{myDriver ? `${myDriver.firstName[0]}${myDriver.lastName[0]}` : <User size={18} />}</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-2">
         <Card className="border-2 border-blue-100 shadow-md bg-white overflow-hidden active:scale-95 transition-all">
            <CardContent className="p-0">
               <div className="bg-blue-600 h-1.5 w-full"></div>
               <div className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                     <Truck size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-900">Larga Distancia</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Fletes FTL / LTL</p>
                  </div>
               </div>
            </CardContent>
         </Card>
         <Link href="/rutas/mercadolibre">
           <Card className="border-2 border-yellow-200 shadow-md bg-white overflow-hidden active:scale-95 transition-all cursor-pointer">
              <CardContent className="p-0">
                 <div className="bg-yellow-400 h-1.5 w-full"></div>
                 <div className="p-4 flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600">
                       <ShoppingBag size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-900">Mercado Libre</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Reparto Última Milla</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
         </Link>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Calendario de Rutas</p>
        <div className="relative group px-1">
          <button onClick={() => handleScroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-slate-100 text-slate-400"><ChevronLeft size={20} /></button>
          <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-4 px-8 no-scrollbar scroll-smooth">
            {dateRange.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isSelected = selectedDate === dateStr;
              const isToday = isSameDay(date, new Date());
              const status = dateStatusMap[dateStr];
              let boxStyles = "bg-white border-slate-100 text-slate-300";
              if (isToday) boxStyles = "bg-blue-600 border-blue-600 text-white shadow-blue-200";
              else if (status?.hasTrips) boxStyles = status.allDelivered ? "bg-green-600 border-green-600 text-white shadow-green-100" : "bg-orange-50 border-orange-100 text-orange-600";
              return (
                <button key={dateStr} data-today={isToday} onClick={() => setSelectedDate(dateStr)} className={cn("flex flex-col items-center justify-center min-w-[65px] h-20 rounded-2xl border-2 transition-all shrink-0", boxStyles, isSelected && "scale-110 shadow-lg ring-2 ring-offset-2 ring-blue-100 z-10")}>
                  <span className={cn("text-[9px] font-black uppercase mb-1", (isToday || (status?.hasTrips && status.allDelivered)) ? "text-white/70" : "text-slate-400")}>{format(date, "EEE", { locale: es })}</span>
                  <span className="text-lg font-black leading-none">{format(date, "d")}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => handleScroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border border-slate-100 text-slate-400"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="space-y-6 px-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando...</p></div>
        ) : filteredRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm"><Calendar className="text-slate-200" size={32} /></div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin viajes programados</p>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const config = getStatusConfig(route.status);
            return (
              <Card key={route.id} className={cn("overflow-hidden border-2 shadow-xl rounded-3xl transition-all active:scale-[0.98]", config.border)}>
                <div className={cn("h-3 w-full", config.accent)}></div>
                <CardContent className="p-5 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner", config.color)}><config.icon size={20} /></div>
                      <div><span className="font-black text-lg tracking-tighter text-slate-900 leading-none">{route.orderNumber}</span><p className="text-[10px] font-bold text-slate-400 uppercase">Flete Larga Distancia</p></div>
                    </div>
                    <Badge className={cn("text-[9px] uppercase font-black px-3 py-1.5 border-none", config.color)}>{config.label}</Badge>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <p className="text-sm font-black text-slate-800 leading-tight uppercase">{route.origin?.name}</p>
                     <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">{route.origin?.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                     <Button variant="outline" className="h-14 text-[11px] font-black bg-white border-slate-200 rounded-2xl flex flex-col gap-1" asChild><Link href={`/rutas/${route.id}`}><Compass size={18} className="text-blue-600" />VER MAPA</Link></Button>
                     <Button variant="outline" className="h-14 text-[11px] font-black bg-white border-slate-200 rounded-2xl flex flex-col gap-1" asChild><Link href={`/cargas/${route.id}/orden`}><FileText size={18} className="text-slate-500" />HOJA RUTA</Link></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      <div className="text-center pb-6"><p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">LogísticaAr Digital Fleet v3.0</p></div>
    </div>
  );
}