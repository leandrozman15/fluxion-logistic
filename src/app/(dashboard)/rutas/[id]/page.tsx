
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
  Siren, LifeBuoy, CirclePlay, CircleCheck, ListOrdered
} from "lucide-react";
import { Load, Expense, ExpenseCategory, LoadStatus, TrackingPoint, Tenant, LoadLegStop } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculateDistance, estimateFuelFactor } from "@/lib/utils/tracking-math";
import { SignaturePad } from "@/components/SignaturePad";
import { compressImage } from "@/lib/utils/image-compression";
import React from 'react';
import { formatSafeDate, toSafeDate } from "@/lib/utils/date-utils";

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

  const expensesQuery = useMemo(() => (db && id) ? collection(db, "loads", id as string, "expenses") : null, [db, id]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

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
      setGpsActive(true);
      toast({ title: "Viaje Iniciado" });
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
      const expRef = collection(db, "loads", id as string, "expenses");
      await addDoc(expRef, { ...expenseData, driverId: user.uid, loadId: id, status: 'registered', createdAt: serverTimestamp() });
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
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="mission" className="text-[10px] uppercase font-bold">Misión</TabsTrigger>
          <TabsTrigger value="incidents" className="text-[10px] uppercase font-bold">Alertas</TabsTrigger>
          <TabsTrigger value="wallet" className="text-[10px] uppercase font-bold">Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="mission" className="space-y-6">
          <Card className="bg-slate-900 text-white border-none rounded-3xl overflow-hidden">
            <CardContent className="p-6 text-center space-y-4">
               <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
               <Button className="w-full bg-blue-600 h-14 text-lg font-bold" onClick={handleStartTrip} disabled={isUpdating}>INICIAR VIAJE</Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm h-64 relative rounded-3xl overflow-hidden">
             {L && <MapContainer center={[load.tracking?.currentLat || load.origin.lat || -34.6, load.tracking?.currentLng || load.origin.lng || -58.3]} zoom={10} className="h-full w-full"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></MapContainer>}
          </Card>

          <div className="space-y-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ListOrdered size={14} /> Itinerario</p>
             {load.outboundStops.map((stop, idx) => (
                <div key={stop.id} className="p-4 bg-white border rounded-2xl flex justify-between items-center">
                   <div><p className="text-xs font-bold uppercase">{stop.name}</p><p className="text-[10px] text-slate-400">{stop.address}</p></div>
                   {stop.deliveredAt ? <Badge className="bg-green-600">OK</Badge> : <Badge variant="outline">Pendiente</Badge>}
                </div>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
           <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
             <DialogTrigger asChild><Button className="w-full bg-blue-600 h-14 font-bold rounded-2xl"><Plus className="mr-2" /> NUEVO GASTO</Button></DialogTrigger>
             <DialogContent className="max-w-[95vw] rounded-3xl">
                <DialogHeader><DialogTitle>Registrar Gasto</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Categoría</Label>
                      <div className="grid grid-cols-3 gap-2">{EXPENSE_CATEGORIES.map(cat => (<button key={cat.id} className={cn("flex flex-col items-center justify-center p-3 rounded-xl border", expenseData.category === cat.id ? "bg-blue-600 text-white" : "bg-white text-slate-500")} onClick={() => setExpenseData({...expenseData, category: cat.id})}><cat.icon size={18} /><span className="text-[8px] font-bold mt-1 uppercase">{cat.label}</span></button>))}</div>
                   </div>
                   <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Monto</Label><Input type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: parseFloat(e.target.value) || 0})} /></div><div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Lugar</Label><Input placeholder="Ciudad" value={expenseData.location} onChange={e => setExpenseData({...expenseData, location: e.target.value})} /></div></div>
                   {expenseData.category === 'fuel' && (
                     <div className="p-4 bg-blue-50 rounded-2xl space-y-4">
                        <Label className="text-[10px] font-bold text-blue-800 uppercase">Detalle Combustible</Label>
                        <Select value={expenseData.fuelBrand} onValueChange={v => setExpenseData({...expenseData, fuelBrand: v})}><SelectTrigger className="bg-white"><SelectValue placeholder="Marca" /></SelectTrigger><SelectContent>{['YPF', 'Shell', 'Axion', 'Puma'].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
                        <div className="grid grid-cols-2 gap-4"><Input type="number" placeholder="Litros" className="bg-white" value={expenseData.liters} onChange={e => setExpenseData({...expenseData, liters: parseFloat(e.target.value) || 0})} /><Input type="number" placeholder="Km" className="bg-white" value={expenseData.odometerKm} onChange={e => setExpenseData({...expenseData, odometerKm: parseFloat(e.target.value) || 0})} /></div>
                     </div>
                   )}
                </div>
                <DialogFooter><Button className="w-full h-14 bg-blue-600 font-bold rounded-2xl" onClick={handleAddExpense}>REGISTRAR</Button></DialogFooter>
             </DialogContent>
           </Dialog>
           <div className="space-y-2">{expenses?.map(exp => (<Card key={exp.id} className="border-none shadow-sm"><CardContent className="p-3 flex justify-between items-center"><div className="flex items-center gap-3"><div><p className="text-xs font-bold capitalize">{exp.category}</p><p className="text-[9px] text-slate-400">{exp.location}</p></div></div><p className="text-xs font-black">${exp.amount.toLocaleString()}</p></CardContent></Card>))}</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
