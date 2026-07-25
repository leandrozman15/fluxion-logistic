
'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, addDoc, increment } from "firebase/firestore";
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
  Zap, GpsFixed, Satellite, SignalHigh, Loader2, Compass, Gauge, History, 
  Coffee, Moon, Car, Battery, Flame, CloudRain, Barrier, FileWarning, HelpCircle,
  Siren, LifeBuoy
} from "lucide-react";
import { Load, Expense, ExpenseCategory } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateDistance, calculateAdjustedETA } from "@/lib/utils/tracking-math";

// Cargamento dinámico del Mapa
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
  { id: 'traffic', label: 'Cierre de Ruta', icon: Barrier, color: 'bg-amber-600' },
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
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);
  
  // GPS State
  const [gpsActive, setGpsActive] = useState(false);
  const [L, setL] = useState<any>(null);
  
  // Throttling State
  const lastUpdateRef = useRef<number>(0);
  const lastPosRef = useRef<{lat: number, lng: number} | null>(null);

  const [expenseData, setExpenseData] = useState<Partial<Expense>>({
    category: 'fuel',
    amount: 0,
    description: "",
    location: ""
  });

  const [incidentForm, setIncidentForm] = useState({
    description: "",
    severity: "medium",
    locationDesc: "",
    actionTaken: ""
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

  // LOGICA DE RASTREO GPS NATIVO OPTIMIZADO
  useEffect(() => {
    if (!gpsActive || !loadRef) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const now = Date.now();
        const currentSpeedKmH = (speed || 0) * 3.6;
        
        const interval = currentSpeedKmH > 5 ? 20000 : 60000;
        if (now - lastUpdateRef.current < interval) return;

        let distanceInc = 0;
        if (lastPosRef.current) {
          distanceInc = calculateDistance(lastPosRef.current.lat, lastPosRef.current.lng, latitude, longitude);
        }

        const distRemaining = load?.tracking?.distanceRemainingKm || 100;
        
        updateDoc(loadRef, {
          "tracking.currentLat": latitude,
          "tracking.currentLng": longitude,
          "tracking.currentSpeed": Math.round(currentSpeedKmH),
          "tracking.distanceTraveledKm": increment(distanceInc),
          "tracking.distanceRemainingKm": Math.max(0, distRemaining - distanceInc),
          "tracking.lastUpdateAt": serverTimestamp()
        });

        lastUpdateRef.current = now;
        lastPosRef.current = { lat: latitude, lng: longitude };
      },
      (err) => {
        console.error("GPS Native Error:", err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsActive, loadRef, load?.tracking?.distanceRemainingKm]);

  const openNativeNavigator = () => {
    const lat = displayDestination.lat;
    const lng = displayDestination.lng;
    const addr = encodeURIComponent(displayDestination.address);
    
    // Detectar OS y abrir el mapa correspondiente
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS 
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `google.navigation:q=${lat},${lng}`;
    
    window.location.href = url;
  };

  const handleStartTrip = async () => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, { 
        status: 'on_route',
        updatedAt: serverTimestamp() 
      });
      setGpsActive(true);
      toast({ title: "Viaje Iniciado", description: "Rastreo GPS activado." });
      openNativeNavigator();
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: any) => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Estado Actualizado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddExpense = async () => {
    if (!db || !id || !user) return;
    setIsUpdating(true);
    try {
      await addDoc(collection(db, "loads", id as string, "expenses"), {
        ...expenseData,
        loadId: id,
        driverId: user.uid,
        status: 'registered',
        createdAt: serverTimestamp()
      });
      toast({ title: "Gasto Registrado" });
      setIsExpenseOpen(false);
      setExpenseData({ category: 'fuel', amount: 0, description: "", location: "" });
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
      
      toast({ title: "Reporte Enviado", description: "La central ha sido notificada." });
      setIsIncidentOpen(false);
      setSelectedIncidentType(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al enviar" });
    } finally {
      setIsUpdating(false);
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

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between">
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
        <TabsList className="grid w-full grid-cols-4 bg-slate-100 p-1">
          <TabsTrigger value="mission" className="text-[10px] uppercase font-bold">Misión</TabsTrigger>
          <TabsTrigger value="time" className="text-[10px] uppercase font-bold">Tiempo</TabsTrigger>
          <TabsTrigger value="incidents" className="text-[10px] uppercase font-bold">Alertas</TabsTrigger>
          <TabsTrigger value="wallet" className="text-[10px] uppercase font-bold">Pesos</TabsTrigger>
        </TabsList>

        {/* TAB: MISION */}
        <TabsContent value="mission" className="space-y-6 animate-in fade-in">
          <Card className="bg-slate-900 text-white border-none overflow-hidden relative">
            <div className="absolute top-2 right-2">
              {gpsActive ? (
                 <Badge className="bg-green-500 border-none text-[8px] animate-pulse">📡 GPS ACTIVO</Badge>
              ) : (
                 <Badge variant="outline" className="text-white/30 border-white/20 text-[8px]">📡 STANDBY</Badge>
              )}
            </div>
            <CardContent className="p-6 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Estado Operativo</p>
                <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
              </div>
              <div className="flex flex-col gap-2">
                {load.status === 'assigned' && (
                  <Button className="w-full bg-blue-600 h-14 text-lg font-bold shadow-lg" onClick={handleStartTrip} disabled={isUpdating}>
                    INICIAR VIAJE
                  </Button>
                )}
                {load.status === 'on_route' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <p className="text-[9px] uppercase font-bold text-white/40">Velocidad</p>
                          <p className="text-xl font-black">{load.tracking?.currentSpeed || 0} <span className="text-[10px] font-normal opacity-50">km/h</span></p>
                       </div>
                       <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                          <p className="text-[9px] uppercase font-bold text-white/40">Recorrido</p>
                          <p className="text-xl font-black">{load.tracking?.distanceTraveledKm?.toFixed(1) || 0} <span className="text-[10px] font-normal opacity-50">km</span></p>
                       </div>
                    </div>
                    <Button className="w-full bg-green-600 h-14 text-lg font-bold shadow-lg" onClick={() => handleUpdateStatus('delivered')} disabled={isUpdating}>
                      CONFIRMAR ENTREGA
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden h-48 relative">
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
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status !== 'pending' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                  {load.status !== 'pending' ? <CheckCircle2 size={16}/> : <Package size={16}/>}
                </div>
                <div className="w-0.5 h-full bg-slate-100 min-h-[40px]"></div>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Punto de Carga (Origen)</h3>
                <p className="text-[11px] text-slate-500 leading-tight">{load.origin.name}</p>
                <p className="text-[10px] text-slate-400 italic">{load.origin.address}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status === 'delivered' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                   <Navigation size={16}/>
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Destino Final</h3>
                <p className="text-[11px] text-slate-500 leading-tight">{displayDestination.name}</p>
                <p className="text-[10px] text-slate-400 italic">{displayDestination.address}</p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="h-8 flex-1 text-[10px] font-bold" onClick={openNativeNavigator}><Compass size={12} className="mr-1" /> Navegar (GPS)</Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB: GESTION DE TIEMPO */}
        <TabsContent value="time" className="space-y-6 animate-in fade-in">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-slate-400 font-bold">Tiempo de Conducción</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Conduciendo Hoy</p>
                  <p className="text-xl font-bold text-blue-600">3:45 <span className="text-xs font-normal text-slate-400">hs</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Descanso Tomado</p>
                  <p className="text-xl font-bold text-green-600">1:30 <span className="text-xs font-normal text-slate-400">hs</span></p>
                </div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
                 <Zap className="text-amber-600 shrink-0" size={16} />
                 <p className="text-[10px] text-amber-800 font-bold">⚠️ Próxima pausa obligatoria: en 15 min</p>
              </div>
            </CardContent>
          </Card>

          <div className="px-2 space-y-4">
             <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Iniciar Pausa / Descanso</Label>
             <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="flex flex-col h-16 gap-1"><Coffee size={18} /> <span className="text-[10px] font-bold">COMIDA</span></Button>
                <Button variant="outline" className="flex flex-col h-16 gap-1"><Bed size={18} /> <span className="text-[10px] font-bold">DESCANSO</span></Button>
                <Button variant="outline" className="flex flex-col h-16 gap-1 col-span-2"><Moon size={18} /> <span className="text-[10px] font-bold">PERNOCTAR (DORMIR)</span></Button>
             </div>
          </div>

          <div className="px-2 space-y-3">
            <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Historial de Jornada</Label>
            <div className="space-y-2">
               {[
                 { time: '07:30 - 12:00', label: 'Conduciendo', duration: '4:30 hs', status: 'done' },
                 { time: '12:00 - 13:00', label: '☕ Almuerzo', duration: '1:00 hs', status: 'done' },
                 { time: '13:00 - 16:45', label: 'Conduciendo', duration: '3:45 hs', status: 'done' }
               ].map((log, i) => (
                 <div key={i} className="flex justify-between items-center p-3 bg-white border rounded-xl text-[11px]">
                    <div className="font-bold text-slate-700">{log.label}</div>
                    <div className="text-slate-400">{log.time} ({log.duration})</div>
                 </div>
               ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB: REPORTAR INCIDENTES */}
        <TabsContent value="incidents" className="space-y-6 animate-in fade-in">
           <div className="px-2 space-y-4">
             <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs font-bold text-red-800 flex items-center gap-2 uppercase">
                  <Siren size={16} /> ¡Emergencia Crítica!
                </p>
                <p className="text-[10px] text-red-600 mt-1">Si hubo un accidente con heridos, llame primero al 911.</p>
                <Button variant="destructive" className="w-full mt-3 h-12 font-bold text-lg" onClick={() => window.open('tel:911')}>LLAMAR 911</Button>
             </div>

             <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Tipo de Incidente</Label>
             <div className="grid grid-cols-2 gap-2">
                {INCIDENT_TYPES.map(type => (
                  <Dialog key={type.id}>
                    <DialogTrigger asChild>
                      <button 
                        className="flex flex-col items-center justify-center p-3 rounded-xl border bg-white hover:bg-slate-50 transition-all gap-2"
                        onClick={() => setSelectedIncidentType(type.id)}
                      >
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white", type.color)}>
                          <type.icon size={20} />
                        </div>
                        <span className="text-[9px] uppercase font-bold text-slate-600 text-center leading-tight">{type.label}</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] rounded-xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                           <AlertTriangle className="text-red-500" /> Reportar {type.label}
                        </DialogTitle>
                        <DialogDescription>Detalle lo ocurrido para que la central pueda asistirlo.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Gravedad</Label>
                          <div className="grid grid-cols-3 gap-2">
                             <Button variant={incidentForm.severity === 'low' ? 'default' : 'outline'} className="text-[9px]" onClick={() => setIncidentForm({...incidentForm, severity: 'low'})}>LEVE</Button>
                             <Button variant={incidentForm.severity === 'medium' ? 'default' : 'outline'} className="text-[9px]" onClick={() => setIncidentForm({...incidentForm, severity: 'medium'})}>MODERADA</Button>
                             <Button variant={incidentForm.severity === 'high' ? 'default' : 'outline'} className="text-[9px] bg-red-600 text-white" onClick={() => setIncidentForm({...incidentForm, severity: 'high'})}>GRAVE</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción del Suceso</Label>
                          <Textarea 
                            placeholder="Ej: Falla en frenos, pinchazo rueda trasera..." 
                            value={incidentForm.description}
                            onChange={e => setIncidentForm({...incidentForm, description: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ubicación de Referencia</Label>
                          <Input 
                            placeholder="Km de ruta, estación de servicio..." 
                            value={incidentForm.locationDesc}
                            onChange={e => setIncidentForm({...incidentForm, locationDesc: e.target.value})}
                          />
                        </div>
                        <Button variant="outline" className="w-full h-16 border-dashed border-2 text-slate-400">
                          <Camera className="mr-2" /> Adjuntar Evidencia (Foto/Video)
                        </Button>
                      </div>
                      <DialogFooter>
                        <Button className="w-full bg-red-600 h-12 text-lg font-bold" onClick={handleReportIncident} disabled={isUpdating || !incidentForm.description}>
                          ENVIAR REPORTE
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ))}
             </div>
           </div>
        </TabsContent>

        {/* TAB: BILLETERA (PESOS) */}
        <TabsContent value="wallet" className="space-y-6 animate-in fade-in">
          <Card className="border-none shadow-sm bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Saldo Disponible</p>
                  <h2 className="text-3xl font-black italic">
                    {((load.budget?.initialAdvance || 0) - totalSpent).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </h2>
                </div>
                <div className="bg-white/10 p-2 rounded-lg"><Wallet className="text-blue-400" /></div>
              </div>
            </CardContent>
          </Card>

          <div className="px-2 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Gastos Registrados</h4>
              <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 bg-blue-600 font-bold text-xs"><Plus size={14} className="mr-1" /> Nuevo Ticket</Button>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] rounded-xl">
                  <DialogHeader><DialogTitle>Registrar Gasto</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {EXPENSE_CATEGORIES.map(cat => (
                          <Button 
                            key={cat.id} 
                            variant={expenseData.category === cat.id ? 'default' : 'outline'}
                            className="flex flex-col h-16 gap-1 p-1 text-[9px]"
                            onClick={() => setExpenseData({...expenseData, category: cat.id})}
                          >
                            <cat.icon size={16} />
                            {cat.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Monto (ARS)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input type="number" className="pl-9" value={expenseData.amount ?? 0} onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Lugar / Punto de Ruta</Label>
                      <Input placeholder="Ej: Estación Shell km 245" value={expenseData.location ?? ''} onChange={e => setExpenseData({...expenseData, location: e.target.value})} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-blue-600 h-12 text-lg font-bold" onClick={handleAddExpense} disabled={isUpdating || !expenseData.amount}>
                      GUARDAR GASTO
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {expenses?.map(exp => {
                const CategoryIcon = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.icon || Receipt;
                return (
                  <Card key={exp.id} className="border-none shadow-sm bg-white">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 border"><CategoryIcon size={18} /></div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">${exp.amount?.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{exp.location}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[8px] uppercase h-5 font-bold">{exp.status}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* BOTONES DE ACCION FIJOS */}
      <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-40">
         <Button variant="outline" className="flex-1 h-14 font-bold shadow-lg bg-white border-slate-200" onClick={() => window.open(`tel:0800-LOGISTICA`)}>
           <LifeBuoy className="mr-2 text-blue-600" /> CENTRAL
         </Button>
         <Button className="bg-red-600 flex-1 h-14 font-bold shadow-lg text-white" onClick={() => setActiveTab('incidents')}>
           <Siren className="mr-2" /> SOS
         </Button>
      </div>
    </div>
  );
}
