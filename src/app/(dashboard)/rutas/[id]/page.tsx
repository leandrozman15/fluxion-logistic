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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  XCircle,
  CircleCheck,
  ListOrdered
} from "lucide-react";
import { Load, Expense, ExpenseCategory, LoadStatus, TrackingPoint, Tenant, LoadLegStop } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateDistance, estimateFuelFactor } from "@/lib/utils/tracking-math";
import { SignaturePad } from "@/components/SignaturePad";
import { compressImage } from "@/lib/utils/image-compression";
import React from 'react';
import { formatSafeDate } from "@/lib/utils/date-utils";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-48 w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-400">Cargando Mapa...</div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });

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
    category: 'fuel', amount: 0, description: "", location: "", liters: 0, odometerKm: 0, pricePerLiter: 0, fuelBrand: ""
  });

  const [incidentForm, setIncidentForm] = useState({ description: "", severity: "medium", locationDesc: "", actionTaken: "" });

  const [podData, setPodData] = useState({ receiverName: "", photoUrl: "", receiverSignatureUrl: "", driverSignatureUrl: "", notes: "" });

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const loadRef = useMemo(() => (db && id) ? doc(db, "loads", id as string) : null, [db, id]);
  const { data: load, loading } = useDoc<Load>(loadRef);
  const { data: tenant } = useDoc<Tenant>(useMemo(() => db ? doc(db, "tenants", "default_tenant") : null, [db]));

  const expensesQuery = useMemo(() => (db && id) ? collection(db, "loads", id as string, "expenses") : null, [db, id]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const totalSpent = useMemo(() => expenses?.reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0, [expenses]);

  // LÓGICA DE PARADA ACTUAL
  const currentStopIndex = useMemo(() => {
    if (!load?.outboundStops) return -1;
    return load.outboundStops.findIndex(s => !s.deliveredAt);
  }, [load?.outboundStops]);

  const currentStop = useMemo(() => {
    if (!load?.outboundStops || currentStopIndex === -1) return null;
    return load.outboundStops[currentStopIndex];
  }, [load?.outboundStops, currentStopIndex]);

  const isAllOutboundStopsDelivered = useMemo(() => {
    if (!load?.outboundStops) return false;
    return load.outboundStops.every(s => !!s.deliveredAt);
  }, [load?.outboundStops]);

  useEffect(() => {
    if (load?.status === 'on_route') setGpsActive(true);
    else setGpsActive(false);

    if (load?.dockEntryAuthorized) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 30, 100, 30, 100]);
      }
    }
  }, [load?.status, load?.dockEntryAuthorized]);

  useEffect(() => {
    if (!gpsActive || !loadRef || !load || typeof window === 'undefined' || !navigator.geolocation) return;

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
        }

        const isMoving = calculatedSpeed > 5;
        const newMax = Math.max(load.tracking?.maxSpeed || 0, calculatedSpeed);
        const fuelFactor = estimateFuelFactor(calculatedSpeed);
        const fuelConsumidoEnTramo = (fuelFactor * distanceInc) / 100;

        const newPoint: TrackingPoint = {
          lat: latitude, lng: longitude, speed: Math.round(calculatedSpeed), timestamp: new Date().toISOString()
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
      (err) => console.warn("GPS Native Error:", err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsActive, loadRef, load]);

  const openNativeNavigator = () => {
    if (!load) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Obtenemos todos los puntos restantes
    const remainingStops = load.outboundStops.filter(s => !s.deliveredAt);
    if (remainingStops.length === 0 && !load.returnDestination?.lat) return;

    const dest = remainingStops.length > 0 
      ? remainingStops[remainingStops.length - 1] 
      : load.returnDestination;
    
    const waypoints = remainingStops.slice(0, -1).map(s => `${s.lat},${s.lng}`).join('|');
    
    let url = "";
    if (isIOS) {
      url = `maps://maps.apple.com/?daddr=${dest?.lat},${dest?.lng}&dirflg=d`;
    } else {
      // Google Maps Dir URL con waypoints
      url = `https://www.google.com/maps/dir/?api=1&destination=${dest?.lat},${dest?.lng}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    }
    window.location.href = url;
  };

  const handleStartTrip = async () => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, { 
        status: 'on_route',
        "tracking.tripStartedAt": serverTimestamp(),
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

  const handleConfirmStopDelivery = async () => {
    if (!loadRef || !load || currentStopIndex === -1) return;
    setIsUpdating(true);
    try {
      const updatedStops = [...load.outboundStops];
      updatedStops[currentStopIndex] = {
        ...updatedStops[currentStopIndex],
        deliveredAt: new Date().toISOString()
      };

      const isFinal = currentStopIndex === load.outboundStops.length - 1;

      await updateDoc(loadRef, {
        outboundStops: updatedStops,
        ...(isFinal ? { status: 'delivered', "proofOfDelivery": { ...podData, confirmedAt: serverTimestamp() } } : {}),
        updatedAt: serverTimestamp()
      });

      toast({ title: isFinal ? "Flete Entregado" : "Parada Confirmada" });
      setIsPODOpen(false);
      setPodData({ receiverName: "", photoUrl: "", receiverSignatureUrl: "", driverSignatureUrl: "", notes: "" });
      if (isFinal) {
        setGpsActive(false);
        router.push('/rutas');
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error al confirmar" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReportIncident = async () => {
    if (!loadRef || !selectedIncidentType) return;
    try {
      await addDoc(collection(db, "tenants", "default_tenant", "events"), {
        type: 'incident_reported',
        prospectId: id,
        companyName: load?.clientName,
        actorUid: user?.uid,
        createdAt: serverTimestamp(),
        metadata: {
          incidentType: selectedIncidentType,
          ...incidentForm,
          orderNumber: load?.orderNumber
        }
      });

      await updateDoc(loadRef, { status: 'incident' });
      toast({ variant: "destructive", title: "Incidencia Reportada", description: "La central ha sido notificada." });
      setIsIncidentOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleAddExpense = async () => {
    if (!db || !id || !user) return;
    setIsUpdating(true);
    try {
      const expRef = collection(db, "loads", id as string, "expenses");
      await addDoc(expRef, {
        ...expenseData,
        driverId: user.uid,
        loadId: id,
        status: 'registered',
        createdAt: serverTimestamp()
      });

      // También registrar en gastos globales para analíticas
      await addDoc(collection(db, "global_expenses"), {
        ...expenseData,
        truckId: load?.assignedTruckId,
        driverId: user.uid,
        loadId: id,
        status: 'registered',
        createdAt: serverTimestamp()
      });

      toast({ title: "Gasto Registrado" });
      setIsExpenseOpen(false);
      setExpenseData({ category: 'fuel', amount: 0, description: "", location: "", liters: 0, odometerKm: 0, pricePerLiter: 0, fuelBrand: "" });
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
        const compressed = await compressImage(base64, 1024, 1024, 0.6);
        setPodData({ ...podData, photoUrl: compressed });
        setIsUpdating(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const truckIcon = L ? L.divIcon({
    className: 'custom-truck-icon',
    html: `<div class="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-bounce"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9V4M19 18h2a1 1 0 0 0 1-1v-4.24a2 2 0 0 0-.81-1.6l-3.19-2.39A2 2 0 0 0 17 8.17V18Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
    iconSize: [28, 28], iconAnchor: [14, 14]
  }) : null;

  const pointIcon = (color: string, number?: number) => L ? L.divIcon({
    className: 'custom-point-icon',
    html: `<div class="${color} text-white w-6 h-6 rounded-full shadow-lg border-2 border-white flex items-center justify-center font-bold text-[10px]">${number || ''}</div>`,
    iconSize: [24, 24], iconAnchor: [12, 12]
  }) : null;

  const routeLinePoints = useMemo(() => {
    if (!load) return [];
    const pts: [number, number][] = [[load.origin.lat!, load.origin.lng!]];
    load.outboundStops.forEach(s => pts.push([s.lat!, s.lng!]));
    if (load.returnDestination?.lat) pts.push([load.returnDestination.lat, load.returnDestination.lng]);
    return pts;
  }, [load]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Viaje no encontrado.</div>;

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="mission" className="text-[10px] uppercase font-bold">Misión</TabsTrigger>
          <TabsTrigger value="incidents" className="text-[10px] uppercase font-bold">Alertas</TabsTrigger>
          <TabsTrigger value="wallet" className="text-[10px] uppercase font-bold">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="mission" className="space-y-6 animate-in fade-in">
          <Card className="bg-slate-900 text-white border-none rounded-3xl overflow-hidden">
            <CardContent className="p-6 text-center space-y-4">
               <div>
                  <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Estado Operativo</p>
                  <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
               </div>
               
               {load.status === 'delivered' ? (
                 <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col items-center gap-2">
                    <CircleCheck size={40} className="text-green-400" />
                    <p className="text-xs font-bold text-green-400 uppercase">MISIÓN CUMPLIDA</p>
                 </div>
               ) : (
                 <div className="space-y-3">
                    {(load.status === 'assigned' || load.status === 'pending') && (
                      <Button className="w-full bg-blue-600 h-14 text-lg font-bold shadow-lg rounded-2xl" onClick={handleStartTrip} disabled={isUpdating}>
                        INICIAR VIAJE
                      </Button>
                    )}
                    {load.status === 'on_route' && (
                      <Dialog open={isPODOpen} onOpenChange={setIsPODOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full bg-green-600 h-16 text-lg font-bold shadow-lg rounded-2xl animate-pulse">
                            ENTREGAR PARADA {currentStopIndex + 1}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl">
                          <DialogHeader>
                            <DialogTitle>Entrega en {currentStop?.name}</DialogTitle>
                            <DialogDescription>Valide la descarga de mercadería.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6 py-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de quien recibe</Label>
                              <Input placeholder="Ej: Marcelo Gomez" value={podData.receiverName} onChange={e => setPodData({...podData, receiverName: e.target.value})} className="bg-slate-50 h-12 rounded-xl" />
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <Button variant="outline" className={cn("h-16 flex items-center justify-start px-4 gap-4 border-dashed border-2 rounded-2xl", podData.photoUrl ? "border-green-500 bg-green-50" : "")} onClick={() => podPhotoInputRef.current?.click()}>
                                <Camera className={cn("w-6 h-6", podData.photoUrl ? "text-green-600" : "text-slate-400")} />
                                <div className="text-left">
                                  <p className="text-sm font-bold">{podData.photoUrl ? "Foto Lista" : "Tomar Foto Remito"}</p>
                                </div>
                              </Button>
                              <input type="file" accept="image/*" capture="environment" className="hidden" ref={podPhotoInputRef} onChange={onPhotoChange} />
                            </div>
                            <SignaturePad title="Firma Receptor" onSave={(url) => setPodData({...podData, receiverSignatureUrl: url})} />
                            <SignaturePad title="Mi Firma (Chofer)" onSave={(url) => setPodData({...podData, driverSignatureUrl: url})} />
                          </div>
                          <DialogFooter>
                            <Button className="w-full h-14 bg-green-600 text-lg font-bold shadow-xl rounded-2xl" disabled={!podData.receiverName || !podData.receiverSignatureUrl || !podData.driverSignatureUrl || isUpdating} onClick={handleConfirmStopDelivery}>
                              {isUpdating ? <Loader2 className="animate-spin mr-2" /> : null}
                              CONFIRMAR ENTREGA
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                 </div>
               )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm h-64 relative rounded-3xl overflow-hidden">
             {L && (
               <MapContainer 
                 center={[load.tracking?.currentLat || load.origin.lat || -34.6, load.tracking?.currentLng || load.origin.lng || -58.3]} 
                 zoom={10} className="h-full w-full" zoomControl={false}
               >
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 
                 {routeLinePoints.length > 1 && (
                    <Polyline positions={routeLinePoints} color="#2563eb" weight={3} dashArray="5, 10" opacity={0.6} />
                 )}

                 <Marker position={[load.origin.lat!, load.origin.lng!]} icon={pointIcon('bg-slate-900')} />
                 
                 {load.outboundStops.map((stop, idx) => (
                    <Marker key={stop.id} position={[stop.lat!, stop.lng!]} icon={pointIcon(stop.deliveredAt ? 'bg-green-600' : 'bg-blue-600', idx + 1)} />
                 ))}

                 {load.tracking?.currentLat && (
                    <Marker position={[load.tracking.currentLat, load.tracking.currentLng]} icon={truckIcon} />
                 )}
               </MapContainer>
             )}
             <div className="absolute bottom-2 right-2 z-[500]">
                <Button size="sm" className="bg-white/90 text-blue-600 text-[10px] font-bold h-8 border shadow-sm" onClick={openNativeNavigator}>
                   <Compass size={14} className="mr-1" /> NAVEGAR GPS
                </Button>
             </div>
          </Card>

          <div className="space-y-4 px-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ListOrdered size={14} /> Itinerario de Viaje ({load.outboundStops.length} puntos)
             </p>
             <div className="space-y-3 relative pl-4 border-l-2 border-dashed border-slate-200">
                {load.outboundStops.map((stop, idx) => (
                   <div key={stop.id} className="relative">
                      <div className={cn(
                        "absolute -left-[25px] top-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-white shadow-sm",
                        stop.deliveredAt ? "bg-green-600 text-white" : "bg-blue-600 text-white"
                      )}>{idx + 1}</div>
                      <Card className={cn(
                        "border-none shadow-sm rounded-2xl transition-all",
                        stop.deliveredAt ? "bg-green-50 opacity-80" : "bg-white"
                      )}>
                         <CardContent className="p-4 flex justify-between items-center">
                            <div className="space-y-1">
                               <p className="text-xs font-bold text-slate-800 uppercase">{stop.name}</p>
                               <p className="text-[10px] text-slate-400 line-clamp-1">{stop.address}</p>
                            </div>
                            {stop.deliveredAt ? (
                               <Badge className="bg-green-600 text-[8px] border-none text-white h-4 uppercase">OK {formatSafeDate(stop.deliveredAt, "HH:mm")}</Badge>
                            ) : (
                               <Badge variant="outline" className="text-[8px] h-4 uppercase text-blue-600">Pendiente</Badge>
                            )}
                         </CardContent>
                      </Card>
                   </div>
                ))}
                {load.returnDestination?.name && (
                   <div className="relative pt-2">
                      <div className="absolute -left-[25px] top-3 w-4 h-4 bg-slate-900 rounded-full border-2 border-white"></div>
                      <div className="p-3 bg-slate-900 text-white rounded-2xl space-y-1">
                         <p className="text-[8px] uppercase font-bold text-white/50">Cierre de Jornada</p>
                         <p className="text-xs font-bold">{load.returnDestination.name}</p>
                      </div>
                   </div>
                )}
             </div>
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
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Wallet className="text-blue-400" size={20} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 px-2">
             <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tickets Registrados</p>
                <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                   <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold border-blue-200 text-blue-600 rounded-full bg-white"><Plus size={14} className="mr-1" /> NUEVO TICKET</Button>
                   </DialogTrigger>
                   <DialogContent className="max-w-[95vw] rounded-3xl">
                      <DialogHeader>
                         <DialogTitle>Registrar Gasto en Ruta</DialogTitle>
                         <DialogDescription>Cargue el ticket o factura para su rendición.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-slate-400">Categoría</Label>
                            <div className="grid grid-cols-3 gap-2">
                               {EXPENSE_CATEGORIES.map(cat => (
                                 <button key={cat.id} className={cn("flex flex-col items-center justify-center p-3 rounded-xl border transition-all", expenseData.category === cat.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-100")} onClick={() => setExpenseData({...expenseData, category: cat.id})}>
                                    <cat.icon size={18} />
                                    <span className="text-[8px] font-bold mt-1 uppercase">{cat.label}</span>
                                 </button>
                               ))}
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                               <Label className="text-[10px] font-bold uppercase text-slate-400">Monto Total</Label>
                               <Input type="number" className="h-12 rounded-xl" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[10px] font-bold uppercase text-slate-400">Lugar / Ciudad</Label>
                               <Input placeholder="Ej: YPF Pacheco" className="h-12 rounded-xl" value={expenseData.location} onChange={e => setExpenseData({...expenseData, location: e.target.value})} />
                            </div>
                         </div>

                         {expenseData.category === 'fuel' && (
                           <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Fuel size={14}/> Datos de Combustible</p>
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-blue-800">Litros Cargados</Label>
                                    <Input type="number" className="bg-white h-10 rounded-xl" value={expenseData.liters} onChange={e => setExpenseData({...expenseData, liters: parseFloat(e.target.value) || 0})} />
                                 </div>
                                 <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-blue-800">Odómetro (KM)</Label>
                                    <Input type="number" className="bg-white h-10 rounded-xl" value={expenseData.odometerKm} onChange={e => setExpenseData({...expenseData, odometerKm: parseFloat(e.target.value) || 0})} />
                                 </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-blue-800">Precio x Litro</Label>
                                    <Input type="number" className="bg-white h-10 rounded-xl" value={expenseData.pricePerLiter} onChange={e => setExpenseData({...expenseData, liters: parseFloat(e.target.value) || 0})} />
                                 </div>
                                 <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-blue-800">Marca / Bandera</Label>
                                    <Select value={expenseData.fuelBrand} onValueChange={v => setExpenseData({...expenseData, fuelBrand: v})}>
                                       <SelectTrigger className="bg-white h-10 rounded-xl"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                       <SelectContent>
                                          {['YPF', 'Shell', 'Axion', 'Puma', 'Otro'].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                 </div>
                              </div>
                           </div>
                         )}

                         <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-400">Nota / Comentario</Label>
                            <Input placeholder="Opcional" className="h-10 rounded-xl" value={expenseData.description} onChange={e => setExpenseData({...expenseData, description: e.target.value})} />
                         </div>
                      </div>
                      <DialogFooter>
                         <Button className="w-full h-14 bg-blue-600 text-lg font-bold shadow-xl rounded-2xl" disabled={!expenseData.amount || isUpdating} onClick={handleAddExpense}>
                            {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <DollarSign className="mr-1" />} REGISTRAR GASTO
                         </Button>
                      </DialogFooter>
                   </DialogContent>
                </Dialog>
             </div>

             <div className="space-y-2">
                {expenses?.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400 italic">No has registrado gastos en este viaje.</p>
                ) : (
                  expenses?.map(exp => (
                    <Card key={exp.id} className="border-none shadow-sm rounded-2xl">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border">
                              {EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.icon && React.createElement(EXPENSE_CATEGORIES.find(c => c.id === exp.category)!.icon, { size: 16 })}
                           </div>
                           <div>
                              <p className="text-[11px] font-bold text-slate-800 capitalize">{exp.category}</p>
                              <p className="text-[9px] text-slate-400">{exp.location}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-black text-slate-900">${exp.amount.toLocaleString()}</p>
                           <Badge variant="outline" className="text-[7px] h-3 uppercase font-bold opacity-60">{exp.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
             </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-40">
         <Button variant="outline" className="flex-1 h-14 font-black shadow-xl bg-white border-2 rounded-2xl" onClick={() => window.open(`tel:${tenant?.settings?.centralPhone || '0800'}`)}><LifeBuoy className="mr-2 text-blue-600" /> CENTRAL</Button>
         <Button className="bg-red-600 flex-1 h-14 font-black shadow-xl text-white rounded-2xl" onClick={() => setActiveTab('incidents')}><Siren className="mr-2" /> SOS</Button>
      </div>
    </div>
  );
}
