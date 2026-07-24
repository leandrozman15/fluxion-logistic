
'use client';

import { useMemo, useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft, MapPin, Phone, MessageSquare, CheckCircle2, 
  Truck, Package, FileText, ShieldAlert, Clock, 
  Navigation, Info, ChevronRight, AlertTriangle,
  Wallet, Plus, DollarSign, Camera, Fuel, Utensils, Bed, Wrench, Receipt,
  Zap, GpsFixed, Satellite, SignalHigh, Loader2, Compass, Gauge
} from "lucide-react";
import { Load, Expense, ExpenseCategory, TrackingPoint } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateDistance, estimateFuelFactor } from "@/lib/utils/tracking-math";

// Carregamento dinâmico do Mapa para evitar erros de SSR
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

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  
  // GPS State
  const [gpsActive, setGpsActive] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [L, setL] = useState<any>(null);

  const [expenseData, setExpenseData] = useState<Partial<Expense>>({
    category: 'fuel',
    amount: 0,
    description: "",
    location: ""
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

  // GPS Tracking Logic
  const toggleGPS = () => {
    if (gpsActive) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setGpsActive(false);
      setWatchId(null);
      toast({ title: "GPS Desactivado", description: "El rastreo se ha detenido." });
    } else {
      if (!navigator.geolocation) {
        toast({ variant: "destructive", title: "GPS no soportado", description: "Su dispositivo no permite geolocalización." });
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (!loadRef) return;
          const { latitude, longitude, speed } = pos.coords;
          const currentSpeed = (speed || 0) * 3.6; // m/s to km/h

          // Atualizar Firestore com telemetria básica
          updateDoc(loadRef, {
            "tracking.currentLat": latitude,
            "tracking.currentLng": longitude,
            "tracking.currentSpeed": Math.round(currentSpeed),
            "tracking.lastUpdateAt": serverTimestamp(),
            // Simulação de acúmulo de distância no MVP
            "tracking.distanceTraveledKm": increment(0.01)
          });
        },
        (err) => {
          console.error("GPS Error:", err);
          toast({ variant: "destructive", title: "Error de GPS", description: "Asegúrese de dar permisos de ubicación." });
          setGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      setWatchId(id);
      setGpsActive(true);
      toast({ title: "GPS Activado", description: "Transmitiendo ubicación a la base." });
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
      toast({ title: "Estado Actualizado", description: `Viaje marcado como ${newStatus}.` });
      if (newStatus === 'on_route' && !gpsActive) toggleGPS();
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
      toast({ title: "Gasto Registrado", description: "El gasto ha sido enviado a administración." });
      setIsExpenseOpen(false);
      setExpenseData({ category: 'fuel', amount: 0, description: "", location: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar gasto" });
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
          <h1 className="font-bold text-lg">Hoja de Ruta</h1>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{load.orderNumber}</p>
        </div>
        <div className="flex items-center gap-2">
           {gpsActive ? <SignalHigh size={20} className="text-green-500 animate-pulse" /> : <Satellite size={20} className="text-slate-300" />}
           <Button variant="ghost" size="icon" className="text-red-500"><ShieldAlert /></Button>
        </div>
      </div>

      <Tabs defaultValue="mission" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1">
          <TabsTrigger value="mission">Misión</TabsTrigger>
          <TabsTrigger value="wallet">Billetera</TabsTrigger>
        </TabsList>

        <TabsContent value="mission" className="space-y-6 animate-in fade-in">
          <Card className="bg-slate-900 text-white border-none overflow-hidden relative">
            <div className="absolute top-2 right-2">
              {gpsActive ? (
                 <Badge className="bg-green-500 border-none text-[8px] animate-pulse">📡 GPS TRANSMITIENDO</Badge>
              ) : (
                 <Badge variant="outline" className="text-white/30 border-white/20 text-[8px]">📡 GPS APAGADO</Badge>
              )}
            </div>
            <CardContent className="p-6 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Estado de Misión</p>
                <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
              </div>
              <div className="flex flex-col gap-2">
                {load.status === 'assigned' && (
                  <Button className="w-full bg-blue-600 h-14 text-lg font-bold shadow-lg shadow-blue-900/50" onClick={() => handleUpdateStatus('on_route')} disabled={isUpdating}>
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
                    <Button className="w-full bg-green-600 h-14 text-lg font-bold shadow-lg shadow-green-900/50" onClick={() => handleUpdateStatus('delivered')} disabled={isUpdating}>
                      CONFIRMAR ENTREGA
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mapa de Ruta */}
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
             <Button 
              size="icon" 
              variant="secondary" 
              className="absolute bottom-2 right-2 z-[500] h-8 w-8 shadow-md"
              onClick={toggleGPS}
             >
               {gpsActive ? <SignalHigh size={16} className="text-green-600" /> : <Satellite size={16} />}
             </Button>
          </Card>

          <div className="space-y-6 px-2">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status !== 'pending' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                  {load.status !== 'pending' ? <CheckCircle2 size={16}/> : <Package size={16}/>}
                </div>
                <div className="w-0.5 h-full bg-slate-100 min-h-[60px]"></div>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Punto de Carga</h3>
                  <p className="text-xs text-slate-500">{load.origin.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 flex-1 text-[10px] font-bold" onClick={() => window.open(`tel:${load.origin.phone}`)}><Phone size={12} className="mr-1" /> Llamar</Button>
                  <Button variant="outline" size="sm" className="h-8 flex-1 text-[10px] font-bold" onClick={() => window.open(`https://wa.me/${load.origin.phone}`)}><MessageSquare size={12} className="mr-1" /> WhatsApp</Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status === 'delivered' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
                   <Navigation size={16}/>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Destino Final</h3>
                  <p className="text-xs text-slate-500">{load.destination.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 flex-1 text-[10px] font-bold" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${load.destination.lat},${load.destination.lng}`)}><Navigation size={12} className="mr-1" /> Navegar</Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

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
                <div className="bg-white/10 p-2 rounded-lg">
                  <Wallet className="text-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-white/40">Anticipo Recibido</p>
                  <p className="text-sm font-bold text-green-400">${load.budget?.initialAdvance?.toLocaleString() || '0'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] uppercase font-bold text-white/40">Gastos Registrados</p>
                  <p className="text-sm font-bold text-orange-400">${totalSpent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="px-2 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Últimos Movimientos</h4>
              <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 bg-blue-600 font-bold text-xs"><Plus size={14} className="mr-1" /> Registrar Gasto</Button>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] rounded-xl">
                  <DialogHeader>
                    <DialogTitle>Nuevo Gasto de Viaje</DialogTitle>
                  </DialogHeader>
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
                        <Input 
                          type="number" 
                          className="pl-9" 
                          placeholder="0.00" 
                          value={expenseData.amount || ''} 
                          onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Lugar / Estación</Label>
                      <Input placeholder="Ej: YPF Ruta 9 km 45" value={expenseData.location || ''} onChange={e => setAxisData({...expenseData, location: e.target.value})} />
                    </div>
                    <Button variant="outline" className="w-full border-dashed border-2 h-16 text-slate-500">
                      <Camera className="mr-2" /> Adjuntar Foto Ticket
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button className="w-full bg-blue-600 h-12 text-lg font-bold" onClick={handleAddExpense} disabled={isUpdating || !expenseData.amount}>
                      {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <DollarSign size={18} className="mr-2" />}
                      Guardar Gasto
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
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 border">
                          <CategoryIcon size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">${exp.amount?.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">{exp.location}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[8px] uppercase h-5 font-bold">
                          {exp.status === 'registered' ? 'Registrado' : exp.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(!expenses || expenses.length === 0) && (
                <div className="py-10 text-center text-slate-400 text-xs italic">No hay gastos registrados aún.</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-6 left-6 right-6 flex gap-3 z-40">
         <Button variant="destructive" className="flex-1 h-14 font-bold shadow-lg shadow-red-900/20">
           <AlertTriangle className="mr-2" /> INCIDENTE
         </Button>
         <Button className="bg-blue-600 flex-1 h-14 font-bold shadow-lg shadow-blue-900/20" onClick={() => window.open(`tel:0800-LOGISTICA`)}>
           <Phone className="mr-2" /> CENTRAL
         </Button>
      </div>
    </div>
  );
}
