
'use client';

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, MapPin, Navigation, Clock, Gauge, 
  Fuel, ArrowLeft, RefreshCw, 
  Activity, Phone, MessageSquare, ShieldAlert,
  Compass, Zap, Loader2
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from "recharts";
import { Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { estimateFuelFactor } from "@/lib/utils/tracking-math";

// Dynamic import for the Map
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 flex items-center justify-center"><Loader2 className="animate-spin" /></div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });

export default function LiveTrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);
  const [L, setL] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  useEffect(() => {
    if (!isSimulating || !load || !loadRef) return;

    const interval = setInterval(async () => {
      const currentTracking = load.tracking || {
        currentLat: load.origin.lat || -34.6037,
        currentLng: load.origin.lng || -58.3816,
        currentSpeed: 75,
        avgSpeed: 70,
        maxSpeed: 95,
        distanceTraveledKm: 10,
        distanceRemainingKm: 250,
        timeOnRouteMinutes: 15,
        timeStoppedMinutes: 0,
        estimatedFuelLiters: 4,
        history: [],
        alerts: []
      };

      const newLat = currentTracking.currentLat + (Math.random() * 0.002 - 0.001);
      const newLng = currentTracking.currentLng + (Math.random() * 0.002 - 0.001);
      const newSpeed = 70 + Math.floor(Math.random() * 15);
      
      const newPoint = {
        lat: newLat,
        lng: newLng,
        speed: newSpeed,
        timestamp: new Date().toISOString()
      };

      const updatedHistory = [...(currentTracking.history || []), newPoint].slice(-100);
      const newFuel = (currentTracking.estimatedFuelLiters || 0) + (estimateFuelFactor(newSpeed) * 0.001);

      await updateDoc(loadRef, {
        "tracking.currentLat": newLat,
        "tracking.currentLng": newLng,
        "tracking.currentSpeed": newSpeed,
        "tracking.maxSpeed": Math.max(currentTracking.maxSpeed || 0, newSpeed),
        "tracking.distanceTraveledKm": (currentTracking.distanceTraveledKm || 0) + 0.1,
        "tracking.distanceRemainingKm": Math.max(0, (currentTracking.distanceRemainingKm || 0) - 0.1),
        "tracking.estimatedFuelLiters": newFuel,
        "tracking.history": updatedHistory,
        "tracking.lastUpdateAt": serverTimestamp()
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isSimulating, load, loadRef]);

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-2 rounded-full shadow-2xl border-4 border-white animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  }) : null;

  const breadcrumbs = useMemo(() => {
    if (!load?.tracking?.history) return [];
    return load.tracking.history.map(p => [p.lat, p.lng] as [number, number]);
  }, [load?.tracking?.history]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Activity className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Operación não encontrada.</div>;

  const tracking = load.tracking;
  const chartData = tracking?.history?.map(p => ({
    time: format(new Date(p.timestamp), "HH:mm:ss"),
    speed: p.speed
  })) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Seguimiento en Vivo</h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-mono">
                #{load.orderNumber}
              </Badge>
              {isSimulating && <Badge className="bg-red-500 animate-pulse border-none">Live Transmission</Badge>}
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Truck size={14} className="text-blue-600" /> {load.clientName} | Ruta: {load.origin.province} → {load.outboundStops?.[load.outboundStops.length-1]?.province || 'Destino'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={isSimulating ? "destructive" : "outline"} 
            size="sm" 
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? "Detener Simulación" : "Simular GPS Conductor"}
          </Button>
          <Button className="bg-blue-600">
            <RefreshCw size={14} className="mr-2" /> Actualizar Datos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-slate-900 text-white border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Gauge size={20} className="text-blue-400" />
            <p className="text-[10px] uppercase font-bold text-white/50">Velocidad</p>
            <p className="text-2xl font-bold">{tracking?.currentSpeed || 0} <span className="text-xs font-normal opacity-50">km/h</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Navigation size={20} className="text-blue-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Recorrido</p>
            <p className="text-2xl font-bold">{tracking?.distanceTraveledKm?.toFixed(1) || 0} <span className="text-xs font-normal text-slate-400">km</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Compass size={20} className="text-orange-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Restante</p>
            <p className="text-2xl font-bold">{tracking?.distanceRemainingKm?.toFixed(1) || 0} <span className="text-xs font-normal text-slate-400">km</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Clock size={20} className="text-green-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">ETA Ajustado</p>
            <p className="text-2xl font-bold">14:45 <span className="text-xs font-normal text-slate-400">hs</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Fuel size={20} className="text-purple-600" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Combustible Est.</p>
            <p className="text-2xl font-bold">{tracking?.estimatedFuelLiters?.toFixed(1) || 0} <span className="text-xs font-normal text-slate-400">L</span></p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col items-center text-center gap-1">
            <Zap size={20} className="text-yellow-500" />
            <p className="text-[10px] uppercase font-bold text-slate-400">Delay</p>
            <p className="text-2xl font-bold text-orange-600">+12 <span className="text-xs font-normal text-slate-400">min</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden h-[400px] relative">
             {mounted && (
               <MapContainer 
                 center={[tracking?.currentLat || -34.6037, tracking?.currentLng || -58.3816]} 
                 zoom={13} 
                 className="h-full w-full"
                 zoomControl={false}
               >
                 <TileLayer
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                   attribution='&copy; OpenStreetMap contributors'
                 />
                 
                 {breadcrumbs.length > 0 && (
                   <Polyline positions={breadcrumbs} color="#2563eb" weight={4} opacity={0.6} />
                 )}

                 <Marker 
                   position={[tracking?.currentLat || -34.6037, tracking?.currentLng || -58.3816]} 
                   icon={truckIcon}
                 >
                   <Popup>
                     <div className="font-bold">Orden: {load.orderNumber}</div>
                     <div className="text-xs">Estado: {load.status.toUpperCase()}</div>
                   </Popup>
                 </Marker>
               </MapContainer>
             )}
             
             <div className="absolute bottom-4 left-4 z-[500] space-y-2 pointer-events-none">
                <div className="bg-white/90 backdrop-blur p-3 rounded-lg border shadow-sm space-y-2 pointer-events-auto">
                   <p className="text-[10px] font-bold uppercase text-slate-400">Ubicación Actual (GPS)</p>
                   <p className="text-xs font-mono font-bold">
                     {tracking?.currentLat?.toFixed(4) || "0.0000"}, {tracking?.currentLng?.toFixed(4) || "0.0000"}
                   </p>
                </div>
             </div>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity size={16} className="text-blue-600" /> Análisis de Velocidad (Historial)
              </CardTitle>
              <CardDescription className="text-xs">Monitoreo de estabilidad y excesos en tiempo real.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="time" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} unit="km/h" />
                  <Tooltip />
                  <ReferenceLine y={90} label={{ position: 'right', value: 'Límite', fontSize: 10, fill: '#ef4444' }} stroke="#ef4444" strokeDasharray="3 3" />
                  <Line 
                    type="monotone" 
                    dataKey="speed" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    dot={false} 
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-sm bg-slate-900 text-white">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="text-yellow-400" /> Seguridad de Conducción
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-3">
                    {tracking?.alerts?.map((alert, i) => (
                      <div key={i} className="flex gap-3 text-xs border-l border-white/10 pl-3">
                         <span className="opacity-40 font-mono">{(alert.timestamp as any)?.toDate ? format((alert.timestamp as any).toDate(), "HH:mm") : '14:35'}</span>
                         <span className={alert.type === 'warning' ? "text-yellow-400" : alert.type === 'critical' ? "text-red-500" : "text-green-400"}>{alert.message}</span>
                      </div>
                    )) || (
                      <div className="text-[10px] text-white/30 italic">Sin alertas en la jornada actual.</div>
                    )}
                 </div>
                 <div className="pt-4 border-t border-white/5 space-y-2">
                    <p className="text-[10px] uppercase font-bold text-white/40">Score del Conductor</p>
                    <div className="flex items-center justify-between">
                       <span className="text-3xl font-bold text-green-400">92<span className="text-xs opacity-50">/100</span></span>
                       <Badge variant="outline" className="border-green-400 text-green-400">Nivel Pro</Badge>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm">
             <CardHeader><CardTitle className="text-sm">Comunicación Directa</CardTitle></CardHeader>
             <CardContent className="space-y-3">
                <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold" onClick={() => window.open(`https://wa.me/${load.origin.phone}`, '_blank')}>
                   <MessageSquare className="mr-2" /> WhatsApp
                </Button>
                <Button variant="outline" className="w-full h-12 text-slate-700 font-bold">
                   <Phone className="mr-2" /> Llamar Conductor
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
