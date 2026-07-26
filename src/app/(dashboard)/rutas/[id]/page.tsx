
'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, addDoc, increment, arrayUnion } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { 
  ArrowLeft, MapPin, Phone, MessageSquare, CheckCircle2, 
  Truck, Package, FileText, ShieldAlert, Clock, 
  Navigation, Info, ChevronRight, AlertTriangle,
  Wallet, Plus, DollarSign, Camera, Fuel, Utensils, Bed, Wrench, Receipt,
  Zap, Satellite, SignalHigh, Loader2, Compass, Gauge, History, 
  Coffee, Moon, Car, Battery, Flame, CloudRain, Construction, FileWarning, HelpCircle,
  Siren, LifeBuoy, PlayCircle, Edit3, UserCheck, PauseCircle, PenTool,
  Anchor,
  CirclePlay,
  XCircle
} from "lucide-react";
import { Load, Expense, ExpenseCategory, LoadStatus, TrackingPoint, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateDistance, estimateFuelFactor } from "@/lib/utils/tracking-math";
import { SignaturePad } from "@/components/SignaturePad";
import { compressImage } from "@/lib/utils/image-compression";
import React from 'react';

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-48 w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-400">Cargando Mapa...</div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });

const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: any }[] = [
  { id: 'fuel', label: 'Combustible', icon: Fuel },
  { id: 'toll', label: 'Peaje', icon: Navigation },
  { id: 'meal', label: 'Comida', icon: Utensils },
  { id: 'lodging', label: 'Hospedaje', icon: Bed },
  { id: 'maintenance', label: 'Taller/Manten.', icon: Wrench },
  { id: 'other', label: 'Otros', icon: Receipt },
];

const INCIDENT_TYPES = [
  { id: 'accident', label: 'Accidente/Choque', icon: Car, color: 'bg-red-500' },
  { id: 'mechanical', label: 'Avería Mecánica', icon: Wrench, color: 'bg-orange-500' },
  { id: 'tire', label: 'Pinchadura', icon: Zap, color: 'bg-yellow-600' },
  { id: 'battery', label: 'Batería', icon: Battery, color: 'bg-blue-500' },
  { id: 'fire', label: 'Incendio', icon: Flame, color: 'bg-red-700' },
  { id: 'weather', label: 'Clima/Inundación', icon: CloudRain, color: 'bg-slate-500' },
  { id: 'traffic', label: 'Cierre de Ruta', icon: Construction, color: 'bg-amber-600' },
  { id: 'doc', label: 'Documentación', icon: FileWarning, color: 'bg-purple-500' },
  { id: 'health', label: 'Salud/Dolor', icon: Siren, color: 'bg-red-400' },
  { id: 'other', label: 'Otro', icon: HelpCircle, color: 'bg-slate-400' },
];

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("mission");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const [isPODOpen, setIsPODOpen] = useState(false);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);
  
  const [gpsActive, setGpsActive] = useState(false);
  const [L, setL] = useState<any>(null);
  
  const lastUpdateRef = useRef<number>(0);
  const lastPosRef = useRef<{lat: number, lng: number, timestamp: number} | null>(null);
  const podPhotoInputRef = useRef<HTMLInputElement>(null);

  const [expenseData, setExpenseData] = useState<any>({
    category: 'fuel',
    amount: 0,
    description: "",
    location: "",
    liters: 0,
    odometerKm: 0,
    pricePerLiter: 0,
    fuelBrand: ""
  });

  const [incidentForm, setIncidentForm] = useState({
    description: "",
    severity: "medium",
    locationDesc: "",
    actionTaken: ""
  });

  const [podData, setPodData] = useState({
    receiverName: "",
    photoUrl: "",
    receiverSignatureUrl: "",
    driverSignatureUrl: "",
    notes: ""
  });

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  // Obtener datos del Tenant para el teléfono central
  const { data: tenant } = useDoc<Tenant>(useMemo(() => {
    if (!db) return null;
    return doc(db, "tenants", "default_tenant"); // O usar el hook useTenant()
  }, [db]));

  useEffect(() => {
    if (load?.status === 'on_route') {
      setGpsActive(true);
    } else {
      setGpsActive(false);
    }

    if (load?.dockEntryAuthorized) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 30, 100, 30, 100]);
      }
    }
  }, [load?.status, load?.dockEntryAuthorized]);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return collection(db, "loads", id as string, "expenses");
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const totalSpent = useMemo(() => {
    return expenses?.reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0;
  }, [expenses]);

  const displayDestination = useMemo(() => {
    if (!load) return { name: 'Cargando...', address: '', lat: -34.6, lng: -58.3 };
    if (load.outboundStops && load.outboundStops.length > 0) {
      const last = load.outboundStops[load.outboundStops.length - 1];
      return { name: last.name, address: last.address, lat: last.lat || -34.6, lng: last.lng || -58.3 };
    }
    return { name: 'S/D', address: '-', lat: -34.6, lng: -58.3 };
  }, [load]);

  useEffect(() => {
    if (!gpsActive || !loadRef || !load || typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const now = Date.now();
        const UPDATE_INTERVAL = 10000; 
        if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;

        let distanceInc = 0;
        let calculatedSpeed = (speed || 0) * 3.6;
        let timeDiffMinutes = (now - (lastPosRef.current?.timestamp || lastUpdateRef.current || now)) / (1000 * 60);
        
        if (timeDiffMinutes > 15) timeDiffMinutes = 0.16; 

        if (lastPosRef.current) {
          distanceInc = calculateDistance(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
          if (speed === null || speed === 0) {
            const timeDiffHours = (now - lastPosRef.current.timestamp) / (1000 * 3600);
            if (timeDiffHours > 0) calculatedSpeed = distanceInc / timeDiffHours;
          }
        }

        const isMoving = calculatedSpeed > 5;
        const currentMax = load.tracking?.maxSpeed || 0;
        const newMax = Math.max(currentMax, calculatedSpeed);
        
        const fuelFactor = estimateFuelFactor(calculatedSpeed);
        const fuelConsumidoEnTramo = (fuelFactor * distanceInc) / 100;

        const newPoint: TrackingPoint = {
          lat: latitude,
          lng: longitude,
          speed: Math.round(calculatedSpeed),
          timestamp: new Date().toISOString()
        };

        updateDoc(loadRef, {
          "tracking.currentLat": latitude,
          "tracking.currentLng": longitude,
          "tracking.currentSpeed": Math.round(calculatedSpeed),
          "tracking.maxSpeed": Math.round(newMax),
          "tracking.distanceTraveledKm": increment(distanceInc),
          "tracking.distanceRemainingKm": increment(-distanceInc),
          "tracking.timeOnRouteMinutes": increment(isMoving ? timeDiffMinutes : 0),
          "tracking.timeStoppedMinutes": increment(isMoving ? 0 : timeDiffMinutes),
          "tracking.estimatedFuelLiters": increment(fuelConsumidoEnTramo),
          "tracking.lastUpdateAt": serverTimestamp(),
          "tracking.history": arrayUnion(newPoint),
          updatedAt: serverTimestamp()
        });

        lastUpdateRef.current = now;
        lastPosRef.current = { lat: latitude, lng: longitude, timestamp: now };
      },
      (err) => {
        console.warn("GPS Native Error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsActive, loadRef, load]);

  const openNativeNavigator = () => {
    const lat = displayDestination.lat;
    const lng = displayDestination.lng;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `google.navigation:q=${lat},${lng}`;
    window.location.href = url;
  };

  const handleStartTrip = async () => {
    if (!loadRef || !load) return;
    setIsUpdating(true);
    try {
      const initialHistory = load.tracking?.history || [];

      await updateDoc(loadRef, { 
        status: 'on_route',
        "tracking.tripStartedAt": serverTimestamp(),
        "tracking.distanceTraveledKm": 0,
        "tracking.timeOnRouteMinutes": 0,
        "tracking.timeStoppedMinutes": 0,
        "tracking.maxSpeed": 0,
        "tracking.estimatedFuelLiters": 0,
        "tracking.history": initialHistory,
        updatedAt: serverTimestamp() 
      });
      setGpsActive(true);
      toast({ title: "Viaje Iniciado" });
      openNativeNavigator();
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartPause = async (type: string) => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, {
        status: 'on_pause',
        "tracking.lastPauseType": type,
        "tracking.pauseStartedAt": serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: `Pausa iniciada: ${type}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResumeTrip = async () => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, {
        status: 'on_route',
        updatedAt: serverTimestamp()
      });
      toast({ title: "Viaje reanudado" });
      openNativeNavigator();
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, {
        status: 'delivered',
        proofOfDelivery: {
          ...podData,
          confirmedAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
      setGpsActive(false);
      toast({ title: "Entrega Confirmada" });
      setIsPODOpen(false);
      router.push('/rutas');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al confirmar entrega", description: "Verifique el tamaño de los adjuntos e intente nuevamente." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddExpense = async () => {
    if (!db || !id || !user || !load) return;
    setIsUpdating(true);
    try {
      const expenseObj = {
        ...expenseData,
        loadId: id,
        driverId: user.uid,
        truckId: load.assignedTruckId || null,
        status: 'registered',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "loads", id as string, "expenses"), expenseObj);
      if (load.assignedTruckId) {
        await addDoc(collection(db, "global_expenses"), expenseObj);
      }
      toast({ title: "Gasto Registrado" });
      setIsExpenseOpen(false);
      setExpenseData({ category: 'fuel', amount: 0, description: "", location: "", liters: 0, odometerKm: 0, pricePerLiter: 0, fuelBrand: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReportIncident = async () => {
    if (!db || !id || !user) return;
    setIsUpdating(true);
    try {
      await addDoc(collection(db, "loads", id as string, "incidents"), {
        type: selectedIncidentType,
        ...incidentForm,
        createdAt: serverTimestamp(),
        status: 'open',
        driverId: user.uid
      });
      await updateDoc(doc(db, "loads", id as string), { status: 'incident' });
      toast({ title: "Reporte Enviado" });
      setIsIncidentOpen(false);
      setSelectedIncidentType(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUpdating(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const compressed = await compressImage(base64, 1024, 1024, 0.6);
          setPodData({ ...podData, photoUrl: compressed });
          toast({ title: "Foto optimizada", description: "La imagen ha sido procesada correctamente." });
        } catch (err) {
          console.error("Compression error:", err);
          setPodData({ ...podData, photoUrl: base64 });
        } finally {
          setIsUpdating(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9V4"/><path d="M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  }) : null;

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Viaje no encontrado.</div>;

  const centralPhone = tenant?.settings?.centralPhone || "0800LOGISTICA";

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32 px-2">
      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <div className="text-center">
          <h1 className="font-bold text-lg">Asistente de Viaje</h1>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{load.orderNumber}</p>
        </div>
        <div className="flex items-center gap-2">
           {gpsActive ? <SignalHigh size={20} className="text-green-500 animate-pulse" /> : <Satellite size={20} className="text-slate-300" />}
           <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setActiveTab('incidents')}><ShieldAlert /></Button>
        </div>
      </div>

      {load.dockEntryAuthorized && (
        <div className="mx-2 p-6 bg-green-600 text-white rounded-3xl shadow-xl shadow-green-200 border-4 border-white animate-in zoom-in duration-500 flex flex-col items-center gap-4 text-center">
           <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <CirclePlay size={40} className="text-white" />
           </div>
           <div>
              <p className="text-sm font-black uppercase tracking-widest opacity-80">Vía Libre Activada</p>
              <h2 className="text-2xl font-black italic">INGRESE A {load.origin.dockName || 'BOCA ASIGNADA'}</h2>
              <p className="text-xs mt-2 opacity-70">El centro de despacho autoriza su ingreso inmediato.</p>
           </div>
           <Button variant="outline" className="bg-white/10 border-white/20 text-white w-full h-12 font-bold" onClick={() => updateDoc(loadRef!, { dockEntryAuthorized: false })}>
              ENTENDIDO
           </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger value="mission" className="text-[10px] uppercase font-bold">Misión</TabsTrigger>
          <TabsTrigger value="time" className="text-[10px] uppercase font-bold">Tiempo</TabsTrigger>
          <TabsTrigger value="incidents" className="text-[10px] uppercase font-bold">Alertas</TabsTrigger>
          <TabsTrigger value="wallet" className="text-[10px] uppercase font-bold">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="mission" className="space-y-6 animate-in fade-in">
          <Card className="bg-slate-900 text-white border-none overflow-hidden relative rounded-3xl">
            <CardContent className="p-6 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Estado Operativo</p>
                <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
              </div>
              <div className="flex flex-col gap-2">
                {(load.status === 'assigned' || load.status === 'pending') && (
                  <Button className="w-full bg-blue-600 h-14 text-lg font-bold shadow-lg rounded-2xl" onClick={handleStartTrip} disabled={isUpdating}>
                    INICIAR VIAJE
                  </Button>
                )}
                {load.status === 'on_pause' && (
                  <Button className="w-full bg-orange-600 h-14 text-lg font-bold shadow-lg flex items-center justify-center gap-2 rounded-2xl" onClick={handleResumeTrip} disabled={isUpdating}>
                    <PlayCircle size={24} /> REANUDAR VIAJE
                  </Button>
                )}
                {load.status === 'on_route' && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                       <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                          <p className="text-[9px] uppercase font-bold text-white/40">Velocidad</p>
                          <p className="text-xl font-black">{load.tracking?.currentSpeed || 0} <span className="text-[10px] font-normal opacity-50">km/h</span></p>
                       </div>
                       <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                          <p className="text-[9px] uppercase font-bold text-white/40">Recorrido</p>
                          <p className="text-xl font-black">{load.tracking?.distanceTraveledKm?.toFixed(2) || 0} <span className="text-[10px] font-normal text-slate-400">km</span></p>
                       </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1 h-14 border-orange-500 text-orange-600 font-bold shadow-sm rounded-2xl">
                            <PauseCircle className="mr-2" /> PARAR
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] rounded-3xl">
                          <DialogHeader>
                            <DialogTitle>Registrar Parada</DialogTitle>
                            <DialogDescription>Indique el motivo de la detención actual.</DialogDescription>
                          </DialogHeader>
                          <div className="grid grid-cols-1 gap-3 py-4">
                            <Button variant="outline" className="h-16 flex items-center justify-start px-6 gap-4 rounded-2xl" onClick={() => { handleStartPause('COMIDA'); setIsPauseDialogOpen(false); }}>
                              <Utensils className="text-orange-500" />
                              <div className="text-left">
                                <p className="font-bold text-sm">Comida</p>
                                <p className="text-[10px] text-slate-500">Parada para almuerzo/cena</p>
                              </div>
                            </Button>
                            <Button variant="outline" className="h-16 flex items-center justify-start px-6 gap-4 rounded-2xl" onClick={() => { handleStartPause('DESCANSO'); setIsPauseDialogOpen(false); }}>
                              <Coffee className="text-blue-500" />
                              <div className="text-left">
                                <p className="font-bold text-sm">Descanso Técnico</p>
                                <p className="text-[10px] text-slate-500">Pausa reglamentaria</p>
                              </div>
                            </Button>
                            <Button variant="outline" className="h-16 flex items-center justify-start px-6 gap-4 rounded-2xl bg-slate-900 text-white" onClick={() => { handleStartPause('PERNOCTE'); setIsPauseDialogOpen(false); }}>
                              <Moon className="text-blue-400" />
                              <div className="text-left">
                                <p className="font-bold text-sm">Pernocte</p>
                                <p className="text-[10px] text-white/50">Parada para dormir</p>
                              </div>
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={isPODOpen} onOpenChange={setIsPODOpen}>
                        <DialogTrigger asChild>
                          <Button className="flex-1 bg-green-600 h-14 font-bold shadow-lg rounded-2xl">
                            ENTREGAR
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl">
                          <DialogHeader>
                            <DialogTitle>Prueba de Entrega (POD)</DialogTitle>
                            <DialogDescription>Complete el protocolo para finalizar el flete.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 py-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de quien recibe</Label>
                              <Input placeholder="Ej: Marcelo Gomez" value={podData.receiverName} onChange={e => setPodData({...podData, receiverName: e.target.value})} className="bg-slate-50 h-12 rounded-xl" />
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <Button variant="outline" className={cn("h-16 flex items-center justify-start px-4 gap-4 border-dashed border-2 rounded-2xl", podData.photoUrl ? "border-green-500 bg-green-50" : "")} onClick={() => podPhotoInputRef.current?.click()}>
                                {isUpdating ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Camera className={cn("w-6 h-6", podData.photoUrl ? "text-green-600" : "text-slate-400")} />}
                                <div className="text-left">
                                  <p className="text-sm font-bold">{podData.photoUrl ? "Foto Lista" : "Tomar Foto Remito"}</p>
                                  <p className="text-[10px] text-slate-500">Evidencia física de entrega</p>
                                </div>
                              </Button>
                              <input type="file" accept="image/*" capture="environment" className="hidden" ref={podPhotoInputRef} onChange={onPhotoChange} />
                            </div>

                            <div className="space-y-4">
                               <div className="grid grid-cols-1 gap-4">
                                  {podData.receiverSignatureUrl ? (
                                    <div className="p-3 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
                                       <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 bg-white rounded-xl border overflow-hidden">
                                             <img src={podData.receiverSignatureUrl} alt="Firma Receptor" className="w-full h-full object-contain" />
                                          </div>
                                          <p className="text-[10px] font-bold text-green-700 uppercase">Firma Receptor OK</p>
                                       </div>
                                       <Button variant="ghost" size="sm" onClick={() => setPodData({...podData, receiverSignatureUrl: ""})}><Edit3 size={14}/></Button>
                                    </div>
                                  ) : (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="outline" className="h-16 flex items-center justify-start px-4 gap-4 border-slate-200 rounded-2xl">
                                          <PenTool className="text-blue-600" />
                                          <div className="text-left">
                                            <p className="text-sm font-bold">Firma del Receptor</p>
                                            <p className="text-[10px] text-slate-500">Solicitar rúbrica al cliente</p>
                                          </div>
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-[90vw] rounded-3xl p-4">
                                        <DialogHeader>
                                          <DialogTitle>Firma del Receptor (Cliente)</DialogTitle>
                                          <DialogDescription>Solicite al cliente que firme en el recuadro inferior.</DialogDescription>
                                        </DialogHeader>
                                        <SignaturePad 
                                          title="Firma del Receptor (Cliente)" 
                                          onSave={(url) => { setPodData({...podData, receiverSignatureUrl: url}); }} 
                                        />
                                      </DialogContent>
                                    </Dialog>
                                  )}

                                  {podData.driverSignatureUrl ? (
                                    <div className="p-3 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
                                       <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 bg-white rounded-xl border overflow-hidden">
                                             <img src={podData.driverSignatureUrl} alt="Firma Chofer" className="w-full h-full object-contain" />
                                          </div>
                                          <p className="text-[10px] font-bold text-green-700 uppercase">Firma Chofer OK</p>
                                       </div>
                                       <Button variant="ghost" size="sm" onClick={() => setPodData({...podData, driverSignatureUrl: ""})}><Edit3 size={14}/></Button>
                                    </div>
                                  ) : (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="outline" className="h-16 flex items-center justify-start px-4 gap-4 border-slate-200 rounded-2xl">
                                          <UserCheck className="text-slate-900" />
                                          <div className="text-left">
                                            <p className="text-sm font-bold">Firma del Chofer</p>
                                            <p className="text-[10px] text-slate-500">Su conformidad como transportista</p>
                                          </div>
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-[90vw] rounded-3xl p-4">
                                        <DialogHeader>
                                          <DialogTitle>Firma del Chofer / Transportista</DialogTitle>
                                          <DialogDescription>Firme para validar su cierre de jornada.</DialogDescription>
                                        </DialogHeader>
                                        <SignaturePad 
                                          title="Firma del Chofer / Transportista" 
                                          onSave={(url) => { setPodData({...podData, driverSignatureUrl: url}); }} 
                                        />
                                      </DialogContent>
                                    </Dialog>
                                  )}
                               </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-slate-400">Observaciones</Label>
                              <Textarea placeholder="Ej: Sin novedades, bultos en buen estado..." value={podData.notes} onChange={e => setPodData({...podData, notes: e.target.value})} className="bg-slate-50 rounded-xl min-h-[100px]" />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              className="w-full h-14 bg-green-600 text-lg font-bold shadow-xl rounded-2xl" 
                              disabled={!podData.receiverName || !podData.receiverSignatureUrl || !podData.driverSignatureUrl || isUpdating} 
                              onClick={handleConfirmDelivery}
                            >
                              {isUpdating ? <Loader2 className="animate-spin mr-2" /> : null}
                              FINALIZAR Y GUARDAR
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden h-48 relative rounded-3xl">
             {typeof window !== 'undefined' && L && (
               <MapContainer 
                 center={[load.tracking?.currentLat || load.origin.lat || -34.6, load.tracking?.currentLng || load.origin.lng || -58.3]} 
                 zoom={13} 
                 className="h-full w-full"
                 zoomControl={false}
               >
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 {load.tracking?.currentLat && (
                   <Marker position={[load.tracking.currentLat, load.tracking.currentLng]} icon={truckIcon} />
                 )}
               </MapContainer>
             )}
          </Card>

          <div className="space-y-6 px-2">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status !== 'pending' && load.status !== 'assigned' ? 'bg-green-50 border-green-500 text-green-600' : 'bg-white border-slate-200 text-slate-400')}>
                  {load.status !== 'pending' && load.status !== 'assigned' ? <CheckCircle2 size={16} /> : <Package size={16} />}
                </div>
                <div className="w-0.5 h-full bg-slate-100 min-h-[40px]"></div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                   <h3 className="font-bold text-sm">Punto de Carga (Origen)</h3>
                   {load.origin.dockName && <Badge className="bg-blue-600 text-white text-[9px] uppercase font-black px-2 h-4 animate-pulse"><Anchor size={10} className="mr-1" /> {load.origin.dockName}</Badge>}
                </div>
                <p className="text-[11px] text-slate-500">{load.origin.name}</p>
                {load.dockEntryAuthorized && (
                   <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg mt-2 text-green-700">
                      <CirclePlay size={16} className="animate-pulse shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-tighter">Vía Libre: Puede ingresar a {load.origin.dockName}</p>
                   </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status === 'delivered' ? 'bg-green-50 border-green-500 text-green-600' : 'bg-white border-slate-200 text-slate-400')}>
                   <Navigation size={16} />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-bold text-sm">Destino Final</h3>
                <p className="text-[11px] text-slate-500">{displayDestination.name}</p>
                <Button variant="outline" size="sm" className="h-10 w-full text-[10px] font-bold mt-2 rounded-xl" onClick={openNativeNavigator}><Compass size={12} className="mr-1" /> Navegar (GPS)</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="time" className="space-y-6 animate-in fade-in">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="pb-2 bg-slate-50 border-b"><CardTitle className="text-xs uppercase text-slate-400 font-black tracking-widest">Tiempo de Conducción</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500">En Ruta (Movimiento)</p>
                  <p className="text-xl font-black text-blue-600">{Math.round(load.tracking?.timeOnRouteMinutes || 0)} <span className="text-xs font-normal text-slate-400 uppercase">min</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Parado / Pausa</p>
                  <p className="text-xl font-black text-orange-600">{Math.round(load.tracking?.timeStoppedMinutes || 0)} <span className="text-xs font-normal text-slate-400 uppercase">min</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="px-2 space-y-4">
             {load.status === 'on_pause' ? (
                <div className="p-8 bg-orange-50 border-2 border-orange-200 rounded-3xl text-center space-y-4 shadow-lg">
                   <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                      <PauseCircle size={32} />
                   </div>
                   <p className="text-sm font-black text-orange-800 uppercase italic">PAUSA ACTIVA: {load.tracking?.lastPauseType}</p>
                   <Button className="w-full bg-orange-600 h-16 text-lg font-bold rounded-2xl shadow-orange-200 shadow-lg" onClick={handleResumeTrip}>REANUDAR VIAJE</Button>
                </div>
             ) : (
               <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="flex flex-col h-20 gap-1 rounded-2xl border-2" onClick={() => handleStartPause('COMIDA')}><Utensils size={20} /> <span className="text-[10px] font-black uppercase">COMIDA</span></Button>
                  <Button variant="outline" className="flex flex-col h-20 gap-1 rounded-2xl border-2" onClick={() => handleStartPause('DESCANSO')}><Coffee size={20} /> <span className="text-[10px] font-black uppercase">DESCANSO</span></Button>
                  <Button variant="outline" className="flex flex-col h-20 gap-1 col-span-2 bg-slate-900 text-white rounded-2xl" onClick={() => handleStartPause('PERNOCTE')}><Moon size={20} /> <span className="text-[10px] font-black uppercase">DORMIR (PERNOCTE)</span></Button>
               </div>
             )}
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-6 animate-in fade-in">
           <div className="px-2 space-y-4">
             <Button variant="destructive" className="w-full h-14 font-black text-lg rounded-2xl shadow-xl animate-pulse" onClick={() => window.open('tel:911')}><Siren size={24} className="mr-2" /> LLAMAR EMERGENCIA (911)</Button>
             <div className="grid grid-cols-2 gap-2">
                {INCIDENT_TYPES.map(type => (
                  <Dialog key={type.id}>
                    <DialogTrigger asChild>
                      <button className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 bg-white gap-2 active:bg-slate-50" onClick={() => setSelectedIncidentType(type.id)}>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", type.color)}><type.icon size={20} /></div>
                        <span className="text-[9px] uppercase font-black text-slate-600 text-center tracking-tight">{type.label}</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] rounded-3xl">
                      <DialogHeader>
                        <DialogTitle>Reportar {type.label}</DialogTitle>
                        <DialogDescription>Detalle lo ocurrido para recibir asistencia inmediata.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción</Label>
                          <Textarea placeholder="Indique qué sucedió..." value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} className="h-32 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">Ubicación / Ref.</Label>
                          <Input placeholder="Ej: Autopista km 45" value={incidentForm.locationDesc} onChange={e => setIncidentForm({...incidentForm, locationDesc: e.target.value})} className="h-12 rounded-xl" />
                        </div>
                      </div>
                      <DialogFooter><Button className="w-full bg-red-600 h-14 font-black rounded-2xl" onClick={handleReportIncident}>ENVIAR REPORTE CRÍTICO</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                ))}
             </div>
           </div>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6 animate-in fade-in">
          <Card className="bg-slate-900 text-white border-none shadow-xl rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-10"><DollarSign size={64}/></div>
            <CardContent className="p-6 flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Saldo de Anticipo</p>
                <h2 className="text-3xl font-black italic">{((load.budget?.initialAdvance || 0) - totalSpent).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</h2>
                <p className="text-[9px] text-blue-400 font-bold uppercase">De un total de ${load.budget?.initialAdvance?.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Wallet className="text-blue-400" size={20} />
              </div>
            </CardContent>
          </Card>

          <div className="px-2 space-y-4">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Comprobantes</h4>
              <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogTrigger asChild><Button size="sm" className="bg-blue-600 font-black text-[10px] h-8 rounded-lg uppercase"><Plus size={14} className="mr-1" /> Nuevo Ticket</Button></DialogTrigger>
                <DialogContent className="max-w-[95vw] rounded-3xl overflow-y-auto max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Registrar Gasto en Ruta</DialogTitle>
                    <DialogDescription>Cargue los datos del comprobante para su rendición.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5 py-4">
                    <div className="grid grid-cols-3 gap-2">
                        {EXPENSE_CATEGORIES.map(cat => (
                          <Button key={cat.id} variant={expenseData.category === cat.id ? 'default' : 'outline'} className="flex flex-col h-16 gap-1 p-1 text-[9px] rounded-xl border-2" onClick={() => setExpenseData({...expenseData, category: cat.id})}>
                            <cat.icon size={16} />{cat.label}
                          </Button>
                        ))}
                    </div>
                    {expenseData.category === 'fuel' && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl animate-in slide-in-from-top-2">
                         <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-blue-700">Odómetro KM</Label><Input type="number" className="h-10 bg-white rounded-lg" value={expenseData.odometerKm || ''} onChange={e => setExpenseData({...expenseData, odometerKm: parseFloat(e.target.value)})} /></div>
                         <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-blue-700">Cant. Litros</Label><Input type="number" className="h-10 bg-white rounded-lg" value={expenseData.liters || ''} onChange={e => setExpenseData({...expenseData, liters: parseFloat(e.target.value), amount: (parseFloat(e.target.value) || 0) * (expenseData.pricePerLiter || 0)})} /></div>
                         <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-blue-700">Precio/Litro</Label><Input type="number" className="h-10 bg-white rounded-lg" value={expenseData.pricePerLiter || ''} onChange={e => setExpenseData({...expenseData, pricePerLiter: parseFloat(e.target.value), amount: (expenseData.liters || 0) * (parseFloat(e.target.value) || 0)})} /></div>
                         <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-blue-700">Bandera (YPF/Shell)</Label><Input className="h-10 bg-white rounded-lg" placeholder="Estación" value={expenseData.fuelBrand || ''} onChange={e => setExpenseData({...expenseData, fuelBrand: e.target.value})} /></div>
                      </div>
                    )}
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Importe Total ($)</Label><Input type="number" className="h-12 rounded-xl text-lg font-bold" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value)})} /></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Lugar / Localidad</Label><Input placeholder="Ej: Shell km 245" className="h-12 rounded-xl" value={expenseData.location} onChange={e => setExpenseData({...expenseData, location: e.target.value})} /></div>
                  </div>
                  <DialogFooter><Button className="w-full h-14 bg-blue-600 font-black rounded-2xl shadow-lg" onClick={handleAddExpense}>REGISTRAR COMPROBANTE</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {expenses?.map(exp => (
                <Card key={exp.id} className="border-none shadow-sm rounded-2xl active:bg-slate-50 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border shadow-inner">
                        {EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.icon && <div className="text-slate-400">{React.createElement(EXPENSE_CATEGORIES.find(c => c.id === exp.category)!.icon, { size: 18 })}</div>}
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-800">${exp.amount?.toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400 uppercase font-black tracking-tight">{exp.category === 'fuel' ? `${exp.fuelBrand || ''} - ${exp.location}` : exp.location}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[8px] uppercase font-black border-slate-200 bg-white">{exp.status}</Badge>
                  </CardContent>
                </Card>
              ))}
              {(!expenses || expenses.length === 0) && (
                <div className="py-10 text-center text-[10px] text-slate-400 uppercase font-bold italic">Sin tickets registrados en este viaje</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-40">
         <Button variant="outline" className="flex-1 h-14 font-black shadow-xl bg-white border-2 rounded-2xl" onClick={() => window.open(`tel:${centralPhone}`)}><LifeBuoy className="mr-2 text-blue-600" /> CENTRAL</Button>
         <Button className="bg-red-600 flex-1 h-14 font-black shadow-xl text-white rounded-2xl" onClick={() => setActiveTab('incidents')}><Siren className="mr-2" /> SOS</Button>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
