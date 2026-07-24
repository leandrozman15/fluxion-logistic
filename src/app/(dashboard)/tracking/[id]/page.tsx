
'use client';

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, MapPin, Navigation, Clock, Gauge, 
  Fuel, AlertTriangle, ArrowLeft, RefreshCw, 
  Activity, Phone, MessageSquare, ShieldAlert,
  ChevronRight, Compass, Zap
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from "recharts";
import { Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateDistance, calculateAdjustedETA, estimateFuelFactor } from "@/lib/utils/tracking-math";
import { format, addMinutes } from "date-fns";
import { es } from "date-fns/locale";

export default function LiveTrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  // Simulação de Dados em Tempo Real para MVP
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

      // Simular pequeno deslocamento
      const newLat = currentTracking.currentLat + 0.001;
      const newLng = currentTracking.currentLng + 0.001;
      const newSpeed = 70 + Math.floor(Math.random() * 15);
      
      const newPoint = {
        lat: newLat,
        lng: newLng,
        speed: newSpeed,
        timestamp: new Date().toISOString()
      };

      const updatedHistory = [...(currentTracking.history || []).slice(-19), newPoint];
      const newFuel = currentTracking.estimatedFuelLiters + (estimateFuelFactor(newSpeed) * 0.001);

      await updateDoc(loadRef, {
        "tracking.currentLat": newLat,
        "tracking.currentLng": newLng,
        "tracking.currentSpeed": newSpeed,
        "tracking.maxSpeed": Math.max(currentTracking.maxSpeed, newSpeed),
        "tracking.distanceTraveledKm": currentTracking.distanceTraveledKm + 0.1,
        "tracking.distanceRemainingKm": Math.max(0, currentTracking.distanceRemainingKm - 0.1),
        "tracking.estimatedFuelLiters": newFuel,
        "tracking.history": updatedHistory,
        "tracking.lastUpdateAt": serverTimestamp()
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isSimulating, load, loadRef]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Activity className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Operação não encontrada.</div>;

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
              <Truck size={14} className="text-blue-600" /> {load.clientName} | Ruta: {load.origin.province} → {load.destination.province}
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

      {/* Grid de KPIs de Telemetría */}
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
        {/* Mapa e Histórico */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden h-[400px] relative bg-slate-100">
             <div className="absolute inset-0 bg-[url('https://placehold.co/1200x800/e2e8f0/94a3b8?text=Mapa+En+Vivo+de+la+Ruta')] bg-cover opacity-50"></div>
             
             {/* Marcador del Camión */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                <div className="bg-blue-600 text-white p-2 rounded-full shadow-2xl border-4 border-white animate-bounce">
                  <Truck size={24} />
                </div>
                <Badge className="mt-2 bg-slate-900 text-white">{load.orderNumber}</Badge>
             </div>

             <div className="absolute bottom-4 left-4 z-20 space-y-2">
                <div className="bg-white/90 backdrop-blur p-3 rounded-lg border shadow-sm space-y-2">
                   <p className="text-[10px] font-bold uppercase text-slate-400">Ubicación Actual (GPS)</p>
                   <p className="text-xs font-mono font-bold">{tracking?.currentLat.toFixed(4)}, {tracking?.currentLng.toFixed(4)}</p>
                   <Button size="sm" variant="outline" className="w-full h-7 text-[9px] uppercase font-bold">Centrar en Vehículo</Button>
                </div>
             </div>
          </Card>

          {/* Gráfico de Velocidad */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity size={16} className="text-blue-600" /> Análisis de Velocidad (60 min)
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
              <div className="flex justify-center gap-4 mt-2 text-[10px] uppercase font-bold">
                 <div className="flex items-center gap-1 text-blue-600"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Óptimo (70-85)</div>
                 <div className="flex items-center gap-1 text-orange-500"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Precaución (85-95)</div>
                 <div className="flex items-center gap-1 text-red-600"><div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div> Exceso (+95)</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Alertas y Acciones */}
        <div className="space-y-6">
           <Card className="border-none shadow-sm bg-slate-900 text-white">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert size={16} className="text-yellow-400" /> Seguridad de Conducción
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-3">
                    {[
                      { time: '14:35', msg: 'Frenada brusca detectada (0.7g)', type: 'warning' },
                      { time: '14:28', msg: 'Velocidad estable en límite', type: 'info' },
                      { time: '14:15', msg: 'Aceleración brusca en peaje', type: 'warning' }
                    ].map((alert, i) => (
                      <div key={i} className="flex gap-3 text-xs border-l border-white/10 pl-3">
                         <span className="opacity-40 font-mono">{alert.time}</span>
                         <span className={cn(
                           alert.type === 'warning' ? "text-yellow-400" : "text-green-400"
                         )}>{alert.msg}</span>
                      </div>
                    ))}
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
                <Button variant="secondary" className="w-full text-xs font-bold text-slate-500 uppercase py-6">
                   Alertar Incidente Crítico
                </Button>
             </CardContent>
           </Card>

           <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Navigation size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-blue-800">Próxima Parada Estimada</p>
                <p className="text-[10px] text-blue-600 font-medium">Peaje Gral. Lagos (Km 270)</p>
                <p className="text-[10px] text-blue-400">Arribo: 15:20 hs (+10 min delay)</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
