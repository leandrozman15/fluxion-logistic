
'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, addDoc, arrayUnion, increment, orderBy } from "firebase/firestore";
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
  Siren, LifeBuoy, CirclePlay, CircleCheck, ListOrdered, XCircle, User,
  Signature, Timer, Play, Pause
} from "lucide-react";
import { Load, Expense, ExpenseCategory, LoadStatus, TrackingPoint, Tenant, LoadLegStop, ProofOfDelivery } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";
import React from 'react';
import { formatSafeDate, toSafeDate } from "@/lib/utils/date-utils";
import { SignaturePad } from "@/components/SignaturePad";
import { calculateDistance } from "@/lib/utils/tracking-math";

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
  { id: 'accident', label: 'Accidente/Choque', icon: Car, color: 'bg-red-600' },
  { id: 'mechanical', label: 'Avería Mecánica', icon: Wrench, color: 'bg-orange-600' },
  { id: 'tire', label: 'Pinchadura', icon: Zap, color: 'bg-yellow-600' },
  { id: 'battery', label: 'Batería', icon: Battery, color: 'bg-blue-600' },
  { id: 'weather', label: 'Clima Adverso', icon: CloudRain, color: 'bg-slate-600' },
  { id: 'traffic', label: 'Ruta Cortada', icon: Construction, color: 'bg-amber-600' },
  { id: 'health', label: 'Salud Chofer', icon: Siren, color: 'bg-red-50' },
  { id: 'other', label: 'Otro Problema', icon: HelpCircle, color: 'bg-slate-500' },
];

const PAUSE_TYPES = [
  { id: 'lunch', label: 'Almuerzo', icon: Utensils, color: 'bg-blue-600' },
  { id: 'rest', label: 'Descanso', icon: Coffee, color: 'bg-green-600' },
  { id: 'sleep', label: 'Dormir / Noche', icon: Moon, color: 'bg-slate-800' },
  { id: 'fuel', label: 'Combustible', icon: Fuel, color: 'bg-orange-600' },
  { id: 'paperwork', label: 'Trámites', icon: FileText, color: 'bg-indigo-600' },
  { id: 'other', label: 'Otras', icon: Clock, color: 'bg-slate-500' },
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
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);
  
  const [L, setL] = useState<any>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const loadRefData = useRef<Load | null>(null);

  const [expenseData, setExpenseData] = useState<any>({
    category: 'fuel', amount: 0, description: "", location: "", liters: 0, odometerKm: 0, pricePerLiter: 0, fuelBrand: ""
  });

  const [incidentDescription, setIncidentDescription] = useState("");

  const [podForm, setPodForm] = useState<Partial<ProofOfDelivery>>({
    receiverName: "",
    receiverSignatureUrl: "",
    driverSignatureUrl: "",
    photoUrl: "",
    notes: ""
  });

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const loadRef = useMemo(() => (db && id) ? doc(db, "loads", id as string) : null, [db, id]);
  const { data: load, loading: loadLoading } = useDoc<Load>(loadRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(collection(db, "loads", id as string, "expenses"), orderBy("createdAt", "desc"));
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  useEffect(() => {
    if (load) loadRefData.current = load;
  }, [load]);

  useEffect(() => {
    if (!load || load.status !== 'on_route' || !loadRef) return;

    const updateLocation = () => {
      if (typeof window === 'undefined' || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, speed } = position.coords;
          const currentSpeed = speed ? Math.round(speed * 3.6) : 0;

          let distanceDelta = 0;
          const currentData = loadRefData.current;
          if (currentData?.tracking?.currentLat && currentData?.tracking?.currentLng) {
            distanceDelta = calculateDistance(
              currentData.tracking.currentLat,
              currentData.tracking.currentLng,
              latitude,
              longitude
            );
          }

          const newPoint = {
            lat: latitude,
            lng: longitude,
            speed: currentSpeed,
            timestamp: new Date().toISOString()
          };

          updateDoc(loadRef, {
            "tracking.currentLat": latitude,
            "tracking.currentLng": longitude,
            "tracking.currentSpeed": currentSpeed,
            "tracking.lastUpdateAt": serverTimestamp(),
            "tracking.distanceTraveledKm": increment(distanceDelta),
            "tracking.history": arrayUnion(newPoint),
            updatedAt: serverTimestamp()
          });
        },
        (error) => {
          console.error("GPS Error:", error);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    };

    updateLocation();
    const intervalId = setInterval(updateLocation, 60000);
    return () => clearInterval(intervalId);
  }, [load?.status, loadRef]);

  const currentStopIndex = useMemo(() => {
    if (!load?.outboundStops) return -1;
    return load.outboundStops.findIndex(s => !s.deliveredAt);
  }, [load?.outboundStops]);

  const currentStop = useMemo(() => {
    if (!load?.outboundStops || currentStopIndex === -1) return null;
    return load.outboundStops[currentStopIndex];
  }, [load?.outboundStops, currentStopIndex]);

  const handleStartTrip = async () => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, { 
        status: 'on_route',
        "tracking.tripStartedAt": serverTimestamp(),
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Viaje Iniciado", description: "Rastreo GPS activo." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al iniciar viaje" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartPause = async (typeId: string) => {
    if (!loadRef) return;
    setIsUpdating(true);
    const label = PAUSE_TYPES.find(p => p.id === typeId)?.label || "Pausa";
    try {
      await updateDoc(loadRef, {
        status: 'on_pause',
        "tracking.lastPauseType": label,
        "tracking.pauseStartedAt": serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: `Modo ${label} Activo` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEndPause = async () => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, {
        status: 'on_route',
        "tracking.lastPauseType": null,
        "tracking.pauseStartedAt": null,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Viaje Reanudado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoClick = () => {
    photoInputRef.current?.click();
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64, 1024, 1024, 0.6);
        setPodForm(prev => ({ ...prev, photoUrl: compressed }));
        toast({ title: "Foto capturada" });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!load || !loadRef || !currentStop || !db) return;
    if (!podForm.receiverName || !podForm.receiverSignatureUrl || !podForm.driverSignatureUrl) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Firma y nombre obligatorios." });
      return;
    }

    setIsUpdating(true);
    try {
      // 1. Marcar el remito administrativo como ENTREGADO
      for (const docItem of currentStop.documents) {
        if (docItem.pendingRemitoId) {
          await updateDoc(doc(db, "pending_remitos", docItem.pendingRemitoId), {
            status: 'delivered',
            deliveredAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // 2. Marcar la parada del viaje como entregada
      const updatedStops = load.outboundStops.map(s => 
        s.id === currentStop.id ? { 
          ...s, 
          deliveredAt: new Date().toISOString(),
          proofOfDelivery: { ...podForm, confirmedAt: new Date().toISOString() }
        } : s
      );

      const allDone = updatedStops.every(s => !!s.deliveredAt);
      
      await updateDoc(loadRef, {
        outboundStops: updatedStops,
        status: allDone ? 'delivered' : 'on_route',
        updatedAt: serverTimestamp()
      });

      toast({ title: "Entrega Confirmada", description: "Remito archivado y central notificada." });
      setIsPodOpen(false);
      setPodForm({ receiverName: "", receiverSignatureUrl: "", driverSignatureUrl: "", photoUrl: "", notes: "" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al confirmar entrega" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddExpense = async () => {
    if (!db || !id || !user || !load) return;
    setIsUpdating(true);
    try {
      const expRef = collection(db, "loads", id as string, "expenses");
      const globalExpRef = collection(db, "global_expenses");
      
      const payload = { 
        ...expenseData, 
        driverId: user.uid, 
        loadId: id, 
        truckId: load.assignedTruckId,
        status: 'registered', 
        createdAt: serverTimestamp() 
      };

      await addDoc(expRef, payload);
      await addDoc(globalExpRef, payload);

      if (expenseData.category === 'fuel' && expenseData.odometerKm > 0 && load.assignedTruckId) {
        await updateDoc(doc(db, "trucks", load.assignedTruckId), {
          odometerKm: expenseData.odometerKm,
          updatedAt: serverTimestamp()
        });
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
    if (!loadRef || !selectedIncidentType) return;
    setIsUpdating(true);
    try {
      const incident = {
        type: 'critical',
        message: `INCIDENTE: ${INCIDENT_TYPES.find(t => t.id === selectedIncidentType)?.label}. ${incidentDescription}`,
        timestamp: new Date().toISOString()
      };

      await updateDoc(loadRef, {
        status: 'incident',
        "tracking.alerts": arrayUnion(incident),
        updatedAt: serverTimestamp()
      });

      toast({ title: "Alerta Enviada" });
      setIsIncidentOpen(false);
      setSelectedIncidentType(null);
      setIncidentDescription("");
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loadLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center text-slate-400">Viaje no encontrado.</div>;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32 px-2">
      <div className="flex items-center justify-between pt-4 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
        <div className="text-center">
          <h1 className="font-black text-lg tracking-tighter italic uppercase text-slate-900 leading-none">Mi Viaje</h1>
          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest mt-1">{load.orderNumber}</p>
        </div>
        <div className="flex items-center gap-2">
           {load.status === 'on_route' ? (
             <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100 shadow-sm animate-pulse">
                <Satellite size={18} />
             </div>
           ) : load.status === 'on_pause' ? (
             <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm">
                <Timer size={18} />
             </div>
           ) : (
             <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
                <Satellite size={18} />
             </div>
           )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="mission" className="text-[9px] uppercase font-black rounded-xl">Misión</TabsTrigger>
          <TabsTrigger value="pauses" className="text-[9px] uppercase font-black rounded-xl">Pausas</TabsTrigger>
          <TabsTrigger value="incidents" className="text-[9px] uppercase font-black rounded-xl">Alertas</TabsTrigger>
          <TabsTrigger value="wallet" className="text-[9px] uppercase font-black rounded-xl">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="mission" className="space-y-6 animate-in fade-in">
          <Card className={cn(
            "border-none rounded-[2.5rem] overflow-hidden shadow-2xl transition-all",
            load.status === 'on_route' ? "bg-blue-600 text-white" : 
            load.status === 'delivered' ? "bg-green-600 text-white" : 
            load.status === 'on_pause' ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
          )}>
            <CardContent className="p-8 text-center space-y-4">
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Estado de Jornada</p>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter">
                   {load.status === 'on_route' ? 'En Tránsito' : 
                    load.status === 'on_pause' ? `Pausa: ${load.tracking?.lastPauseType || 'Descanso'}` :
                    load.status === 'delivered' ? 'Viaje Finalizado' : 
                    load.status === 'incident' ? 'Incidencia' : 'Listo para Salir'}
                 </h2>
               </div>
               
               {load.status === 'pending' || load.status === 'assigned' ? (
                 <Button className="w-full bg-white text-slate-900 hover:bg-slate-50 h-16 text-lg font-black rounded-2xl shadow-xl animate-pulse" onClick={handleStartTrip} disabled={isUpdating}>
                   INICIAR VIAJE <ChevronRight className="ml-2" />
                 </Button>
               ) : load.status === 'on_pause' ? (
                 <Button className="w-full bg-white text-amber-600 hover:bg-slate-50 h-16 text-lg font-black rounded-2xl shadow-xl" onClick={handleEndPause} disabled={isUpdating}>
                   REANUDAR VIAJE <Play className="ml-2 fill-current" />
                 </Button>
               ) : load.status === 'on_route' && currentStop ? (
                 <div className="space-y-3">
                   <p className="text-[10px] font-bold text-white/70 uppercase">Destino {currentStopIndex + 1} de {load.outboundStops.length}: {currentStop.name}</p>
                   <Button className="w-full bg-green-500 hover:bg-green-600 text-white h-16 text-lg font-black rounded-2xl shadow-xl" onClick={() => setIsPodOpen(true)} disabled={isUpdating}>
                     CONFIRMAR LLEGADA <CheckCircle2 className="ml-2" />
                   </Button>
                 </div>
               ) : load.status === 'delivered' ? (
                 <div className="flex flex-col items-center gap-2">
                    <CircleCheck size={48} className="text-white/30" />
                    <p className="text-xs font-bold opacity-70">Tarea cumplida. Central de despacho notificada.</p>
                 </div>
               ) : null}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl h-64 relative rounded-[2rem] overflow-hidden mx-1">
             {L && (
               <MapContainer 
                center={[load.tracking?.currentLat || load.origin.lat || -34.6, load.tracking?.currentLng || load.origin.lng || -58.3]} 
                zoom={10} 
                className="h-full w-full"
                zoomControl={false}
               >
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
               </MapContainer>
             )}
          </Card>

          <div className="space-y-4 px-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
               <ListOrdered size={14} className="text-blue-500" /> Hoja de Ruta Secuencial
             </p>
             <div className="space-y-3">
                {load.outboundStops.map((stop, idx) => (
                   <div key={stop.id} className={cn(
                     "p-5 rounded-3xl border-2 flex justify-between items-center transition-all",
                     stop.deliveredAt ? "bg-green-50 border-green-100" : "bg-white border-slate-100 shadow-sm"
                   )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border shadow-inner",
                          stop.deliveredAt ? "bg-green-600 text-white border-green-500" : "bg-slate-50 text-slate-400 border-slate-100"
                        )}>
                          {idx + 1}
                        </div>
                        <div>
                           <p className={cn("text-sm font-black uppercase", stop.deliveredAt ? "text-green-700" : "text-slate-800")}>{stop.name}</p>
                           <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">{stop.address}</p>
                        </div>
                      </div>
                      {stop.deliveredAt ? (
                        <Badge className="bg-green-600 border-none text-[8px] h-4 uppercase font-black">ENTREGADO</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] h-4 uppercase font-black border-slate-200 text-slate-400">PENDIENTE</Badge>
                      )}
                   </div>
                ))}
             </div>
          </div>
        </TabsContent>

        <TabsContent value="pauses" className="space-y-6 animate-in fade-in">
           <div className="px-1 space-y-6">
             <div className="text-center space-y-2 py-4">
                <Timer className="w-12 h-12 text-blue-600 mx-auto" />
                <h3 className="text-xl font-black italic uppercase text-slate-900">Pausas y Descansos</h3>
             </div>

             {load.status === 'on_pause' ? (
                <Card className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-8 text-center space-y-6 shadow-xl">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">En Pausa por</p>
                      <h4 className="text-2xl font-black text-amber-700 uppercase italic">{load.tracking?.lastPauseType}</h4>
                   </div>
                   <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white h-16 text-lg font-black rounded-2xl shadow-xl" onClick={handleEndPause} disabled={isUpdating}>
                      TERMINAR PAUSA <Play className="ml-2 fill-current" />
                   </Button>
                </Card>
             ) : (
                <div className="grid grid-cols-2 gap-4">
                   {PAUSE_TYPES.map(pause => (
                     <button 
                        key={pause.id}
                        className="p-6 rounded-3xl border-2 bg-white border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-95 group shadow-sm"
                        onClick={() => handleStartPause(pause.id)}
                        disabled={isUpdating || load.status === 'delivered' || load.status === 'pending' || load.status === 'assigned'}
                     >
                        <pause.icon size={32} className="text-slate-400 group-hover:text-blue-600 mx-auto mb-2" />
                        <span className="text-[10px] font-black uppercase text-slate-800">{pause.label}</span>
                     </button>
                   ))}
                </div>
             )}
           </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-6 animate-in fade-in">
           <div className="px-1 space-y-6">
             <div className="text-center space-y-2 py-4">
                <ShieldAlert className="w-12 h-12 text-red-600 mx-auto animate-pulse" />
                <h3 className="text-xl font-black italic uppercase text-slate-900">Reportar Incidencia</h3>
             </div>

             <div className="grid grid-cols-2 gap-4">
                {INCIDENT_TYPES.map(type => (
                  <button 
                    key={type.id} 
                    className={cn(
                      "p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all active:scale-95",
                      selectedIncidentType === type.id ? "bg-red-600 text-white border-red-600 shadow-xl" : "bg-white text-slate-400 border-slate-100"
                    )}
                    onClick={() => setSelectedIncidentType(type.id)}
                  >
                    <type.icon size={32} className={cn(selectedIncidentType === type.id ? "text-white" : "text-slate-300")} />
                    <span className="text-[10px] font-black uppercase text-center leading-tight">{type.label}</span>
                  </button>
                ))}
             </div>

             {selectedIncidentType && (
               <div className="space-y-4 bg-white p-6 rounded-[2rem] border-2 border-red-100 shadow-xl">
                  <Textarea 
                    placeholder="Detalle adicional..." 
                    className="bg-slate-50 border-none rounded-xl"
                    value={incidentDescription}
                    onChange={e => setIncidentDescription(e.target.value)}
                  />
                  <Button className="w-full h-14 bg-red-600 text-white font-black text-lg rounded-2xl shadow-xl" onClick={handleReportIncident} disabled={isUpdating}>
                    ENVIAR ALERTA
                  </Button>
               </div>
             )}
           </div>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6 animate-in fade-in">
           <div className="px-1 space-y-6">
             <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
               <DialogTrigger asChild>
                 <Button className="w-full bg-blue-600 hover:bg-blue-700 h-16 font-black text-lg rounded-2xl shadow-xl">
                   <Plus className="mr-2" /> REGISTRAR GASTO
                 </Button>
               </DialogTrigger>
               <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-8">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Nuevo Gasto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Categoría</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {EXPENSE_CATEGORIES.map(cat => (
                            <button 
                              key={cat.id} 
                              className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95", 
                                expenseData.category === cat.id ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-400 border-transparent"
                              )} 
                              onClick={() => setExpenseData({...expenseData, category: cat.id})}
                            >
                              <cat.icon size={20} />
                              <span className="text-[8px] font-black mt-2 uppercase">{cat.label}</span>
                            </button>
                          ))}
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-slate-400">Monto</Label>
                           <div className="relative">
                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                              <Input type="number" className="pl-9 h-12 bg-slate-50 border-none font-black rounded-xl" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})} />
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-slate-400">Lugar</Label>
                           <Input placeholder="Ej: San Pedro" className="h-12 bg-slate-50 border-none text-xs font-bold rounded-xl" value={expenseData.location} onChange={e => setExpenseData({...expenseData, location: e.target.value})} />
                        </div>
                     </div>
                  </div>
                  <DialogFooter>
                    <Button className="w-full h-16 bg-blue-600 text-white font-black text-lg rounded-2xl" onClick={handleAddExpense} disabled={isUpdating || !expenseData.amount}>
                      GUARDAR GASTO
                    </Button>
                  </DialogFooter>
               </DialogContent>
             </Dialog>

             <div className="divide-y divide-slate-100">
                {expenses?.map(exp => (
                  <div key={exp.id} className="p-4 flex justify-between items-center bg-white rounded-2xl shadow-sm mb-2">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                           {EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.icon ? React.createElement(EXPENSE_CATEGORIES.find(c => c.id === exp.category)!.icon, { size: 18 }) : <DollarSign size={18} />}
                        </div>
                        <div>
                           <p className="text-xs font-black uppercase text-slate-800">{exp.category}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase">{exp.location}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-sm font-black text-slate-900">${exp.amount.toLocaleString()}</p>
                        <Badge variant="outline" className="text-[8px] h-3 px-1">{exp.status}</Badge>
                     </div>
                  </div>
                ))}
             </div>
           </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isPodOpen} onOpenChange={setIsPodOpen}>
         <DialogContent className="max-w-full sm:max-w-md h-[95vh] sm:h-auto rounded-t-[2.5rem] sm:rounded-[2.5rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl">
            <div className="bg-slate-900 text-white p-6 pb-8 shrink-0">
               <div className="flex justify-between items-start mb-4">
                  <Badge className="bg-green-500 text-white border-none text-[8px] uppercase font-black">Entrega</Badge>
                  <Button variant="ghost" size="icon" onClick={() => setIsPodOpen(false)} className="text-white/40"><XCircle /></Button>
               </div>
               <h2 className="text-2xl font-black uppercase italic tracking-tighter">Confirmar Recepción</h2>
               <p className="text-white/40 text-[10px] font-bold uppercase mt-2">{currentStop?.name}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50">
               <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-500">1. Nombre del Receptor</Label>
                  <Input 
                    className="h-14 bg-white border-slate-200 shadow-sm font-bold rounded-2xl"
                    value={podForm.receiverName}
                    onChange={e => setPodForm({...podForm, receiverName: e.target.value})}
                  />
               </div>

               <div className="space-y-6">
                  <SignaturePad title="Firma Receptor" onSave={(url) => setPodForm({...podForm, receiverSignatureUrl: url})} />
                  <SignaturePad title="Firma Chofer" onSave={(url) => setPodForm({...podForm, driverSignatureUrl: url})} />
               </div>

               <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-500">2. Foto del Remito</Label>
                  <input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="environment" onChange={onPhotoChange} />
                  <div className="aspect-video rounded-[2rem] border-3 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden bg-slate-100" onClick={handlePhotoClick}>
                    {podForm.photoUrl ? (
                      <img src={podForm.photoUrl} className="w-full h-full object-cover" alt="Remito" />
                    ) : (
                      <>
                        <Camera size={32} className="text-slate-300" />
                        <p className="text-[11px] font-black text-slate-400 uppercase">Capturar Foto</p>
                      </>
                    )}
                  </div>
               </div>
            </div>

            <div className="p-6 bg-white border-t shrink-0">
               <Button 
                className="w-full h-18 text-lg font-black uppercase rounded-[1.5rem] bg-green-600 text-white hover:bg-green-700"
                onClick={handleConfirmDelivery} 
                disabled={isUpdating || !podForm.receiverName || !podForm.receiverSignatureUrl || !podForm.driverSignatureUrl || !podForm.photoUrl}
               >
                 {isUpdating ? <Loader2 className="animate-spin mr-3" /> : <CircleCheck className="mr-3" />}
                 FINALIZAR ENTREGA
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
