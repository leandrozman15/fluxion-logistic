'use client';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Navigation,
  Route,
  Gauge,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLoadById, updateLoad } from "@/lib/loads-api";
import { listTrucks, updateTruck } from "@/lib/trucks-api";

const RouteMap = dynamic(() => import("@/components/maps/route-map"), { ssr: false });

type TrackingPoint = {
  lat: number;
  lng: number;
  speed?: number;
  timestamp?: string;
};

export default function TrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const loadId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadData, setLoadData] = useState<any>(null);
  const [truckData, setTruckData] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      if (!loadId) {
        if (active) setLoading(false);
        return;
      }

      try {
        if (active) setLoading(true);
        const load = await getLoadById(loadId);
        if (!active) return;
        setLoadData(load);

        if (load.assignedTruckId) {
          const trucks = await listTrucks();
          if (!active) return;
          const assigned = trucks.find((truck) => truck.id === load.assignedTruckId) || null;
          setTruckData(assigned);
        } else {
          setTruckData(null);
        }
      } catch (error) {
        if (!active) return;
        toast({ variant: "destructive", title: "Error al cargar tracking", description: (error as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();
    return () => {
      active = false;
    };
  }, [loadId, toast]);

  const history = useMemo<TrackingPoint[]>(() => {
    const rows = loadData?.tracking?.history;
    return Array.isArray(rows) ? rows : [];
  }, [loadData]);

  const currentPoint = useMemo<TrackingPoint | null>(() => {
    if (history.length > 0) return history[history.length - 1];
    if (typeof loadData?.tracking?.currentLat === "number" && typeof loadData?.tracking?.currentLng === "number") {
      return {
        lat: loadData.tracking.currentLat,
        lng: loadData.tracking.currentLng,
        speed: loadData.tracking.currentSpeed,
      };
    }
    return null;
  }, [history, loadData]);

  const destination = useMemo(() => {
    const stop = loadData?.outboundStops?.[0];
    if (!stop) return null;
    if (typeof stop.lat === "number" && typeof stop.lng === "number") {
      return { lat: stop.lat, lng: stop.lng, name: stop.name || "Destino" };
    }
    return null;
  }, [loadData]);

  const etaLabel = useMemo(() => {
    const remaining = Number(loadData?.tracking?.distanceRemainingKm || 0);
    const speed = Number(loadData?.tracking?.currentSpeed || 0);
    if (!remaining || !speed) return "--";
    const hours = remaining / Math.max(speed, 1);
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }, [loadData]);

  const handleStatus = async (next: "on_route" | "completed") => {
    if (!loadData?.id) return;
    setSaving(true);
    try {
      const updated = await updateLoad(loadData.id, {
        status: next,
        updatedAt: new Date().toISOString(),
      } as any);
      setLoadData((prev: any) => ({ ...prev, ...updated }));
      toast({ title: next === "completed" ? "Viaje finalizado" : "Viaje reanudado" });
    } catch (error) {
      toast({ variant: "destructive", title: "No se pudo actualizar", description: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const simulateTick = async () => {
    if (!loadData?.id || !currentPoint || !destination) return;
    setSaving(true);
    try {
      const latStep = (destination.lat - currentPoint.lat) * 0.15;
      const lngStep = (destination.lng - currentPoint.lng) * 0.15;
      const nextPoint: TrackingPoint = {
        lat: currentPoint.lat + latStep,
        lng: currentPoint.lng + lngStep,
        speed: 28 + Math.round(Math.random() * 12),
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [...history, nextPoint];
      const remainingKm = Math.sqrt(Math.pow(destination.lat - nextPoint.lat, 2) + Math.pow(destination.lng - nextPoint.lng, 2)) * 111;

      const updatedLoad = await updateLoad(loadData.id, {
        tracking: {
          ...(loadData.tracking || {}),
          currentLat: nextPoint.lat,
          currentLng: nextPoint.lng,
          currentSpeed: nextPoint.speed,
          history: updatedHistory,
          distanceRemainingKm: Number(remainingKm.toFixed(2)),
        },
        updatedAt: new Date().toISOString(),
      } as any);

      setLoadData((prev: any) => ({ ...prev, ...updatedLoad, tracking: { ...(prev?.tracking || {}), ...(updatedLoad?.tracking || {}) } }));

      if (truckData?.id) {
        await updateTruck(truckData.id, {
          currentLocation: {
            lat: nextPoint.lat,
            lng: nextPoint.lng,
            updatedAt: new Date().toISOString(),
          },
        } as any);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error en simulacion", description: (error as Error).message });
      setIsRunning(false);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      simulateTick();
    }, 5000);
    return () => clearInterval(interval);
  });

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600" />
      </div>
    );
  }

  if (!loadData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="text-amber-500" />
        <p className="font-bold text-slate-700">No se encontro el viaje.</p>
        <Button onClick={() => router.push("/rutas")}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="mr-2" size={16} /> Volver
        </Button>
        <Badge className="bg-blue-50 text-blue-700 border-blue-100">Tracking en vivo</Badge>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
            <Route className="text-blue-600" size={20} />
            Viaje {loadData.orderNumber || loadData.id}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50">
            <p className="text-[10px] uppercase font-black text-slate-400">Estado</p>
            <p className="text-sm font-black text-slate-800">{String(loadData.status || "--").toUpperCase()}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50">
            <p className="text-[10px] uppercase font-black text-slate-400">Velocidad</p>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1"><Gauge size={14} /> {Number(loadData?.tracking?.currentSpeed || 0)} km/h</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50">
            <p className="text-[10px] uppercase font-black text-slate-400">Restante</p>
            <p className="text-sm font-black text-slate-800">{Number(loadData?.tracking?.distanceRemainingKm || 0).toFixed(1)} km</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50">
            <p className="text-[10px] uppercase font-black text-slate-400">ETA</p>
            <p className="text-sm font-black text-slate-800 flex items-center gap-1"><Clock size={14} /> {etaLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardContent className="p-0 h-[460px]">
          <RouteMap
            currentPosition={currentPoint ? { lat: currentPoint.lat, lng: currentPoint.lng } : null}
            routeHistory={history.map((h) => ({ lat: h.lat, lng: h.lng }))}
            destination={destination ? { lat: destination.lat, lng: destination.lng } : null}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setIsRunning((v) => !v)}
          disabled={saving}
        >
          {isRunning ? <Pause size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
          {isRunning ? "Pausar simulacion" : "Iniciar simulacion"}
        </Button>

        <Button
          variant="outline"
          onClick={() => handleStatus("on_route")}
          disabled={saving}
        >
          <Navigation size={16} className="mr-2" /> Marcar en ruta
        </Button>

        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handleStatus("completed")}
          disabled={saving}
        >
          <CheckCircle2 size={16} className="mr-2" /> Finalizar viaje
        </Button>
      </div>
    </div>
  );
}
