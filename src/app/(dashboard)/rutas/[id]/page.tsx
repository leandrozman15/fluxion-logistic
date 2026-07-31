
'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, addDoc, arrayUnion, increment, orderBy, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  ArrowLeft, MapPin, CheckCircle2, 
  Truck, Package, FileText, ShieldAlert, Clock, 
  Navigation, Info, ChevronRight,
  Plus, DollarSign, Camera, Fuel, Utensils, Bed, Wrench, Receipt,
  Zap, Satellite, Loader2, Gauge, 
  Coffee, Moon, Car, Battery, CloudRain, Construction, HelpCircle,
  Siren, CircleCheck, ListOrdered, XCircle,
  Timer, Play, Home, ShoppingBag, QrCode, Phone, CheckCircle
} from "lucide-react";
import { Load, Expense, ExpenseCategory, ProofOfDelivery, Tenant, LoadLegStop } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";
import React from 'react';
import { formatSafeDate, toSafeDate } from "@/lib/utils/date-utils";
import { SignaturePad } from "@/components/SignaturePad";
import { calculateDistance } from "@/lib/utils/tracking-math";
import { calculateRouteDetails } from "@/services/google-maps";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-48 w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-400">Cargando Mapa...</div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });

const INCIDENT_REASONS = [
  { id: 'absent', label: 'Cliente Ausente' },
  { id: 'wrong_address', label: 'Dirección Incorrecta' },
  { id: 'no_response', label: 'No Responde' },
  { id: 'refused', label: 'Rechazó Paquete' },
  { id: 'other', label: 'Otro Motivo' }
];

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("mission");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [isFailedOpen, setIsFailedOpen] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [podForm, setPodForm] = useState<Partial<ProofOfDelivery>>({
    receiverName: "",
    receiverSignatureUrl: "",
    driverSignatureUrl: "",
    photoUrl: "",
    notes: "",
    status: 'delivered'
  });

  const loadRef = useMemo(() => (db && id) ? doc(db, "loads", id as string) : null, [db, id]);
  const { data: load, loading: loadLoading } = useDoc<Load>(loadRef);

  const currentStop = useMemo(() => {
    if (!load?.outboundStops) return null;
    return load.outboundStops.find(s => !s.deliveredAt && !s.failedAt);
  }, [load?.outboundStops]);

  const handleAction = (type: 'nav' | 'call') => {
    if (!currentStop) return;
    if (type === 'nav') {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}`;
      window.open(url, '_blank');
    } else {
      window.open(`tel:${currentStop.phone}`, '_self');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!load || !loadRef || !currentStop || !db) return;
    setIsUpdating(true);
    try {
      const updatedStops = load.outboundStops.map(s => 
        s.id === currentStop.id ? { 
          ...s, 
          deliveredAt: new Date().toISOString(),
          proofOfDelivery: { ...podForm, status: 'delivered', confirmedAt: new Date().toISOString() }
        } : s
      );

      await updateDoc(loadRef, {
        outboundStops: updatedStops,
        updatedAt: serverTimestamp()
      });

      toast({ title: "Entrega Exitosa" });
      setIsPodOpen(false);
      setPodForm({ receiverName: "", receiverSignatureUrl: "", driverSignatureUrl: "", photoUrl: "", notes: "", status: 'delivered' });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReportFailure = async (reason: any) => {
    if (!load || !loadRef || !currentStop) return;
    setIsUpdating(true);
    try {
      const updatedStops = load.outboundStops.map(s => 
        s.id === currentStop.id ? { 
          ...s, 
          failedAt: new Date().toISOString(),
          proofOfDelivery: { status: 'failed', failedReason: reason, confirmedAt: new Date().toISOString(), receiverName: "FALLIDO" }
        } : s
      );

      await updateDoc(loadRef, {
        outboundStops: updatedStops,
        updatedAt: serverTimestamp()
      });

      toast({ title: "Incidente Registrado" });
      setIsFailedOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loadLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Viaje no encontrado.</div>;

  const isMeli = load.serviceType === 'meli';

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32 px-2">
      <div className="flex items-center justify-between pt-6 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
        <div className="text-center">
          <h1 className="font-black text-lg tracking-tighter italic uppercase text-slate-900 leading-none">Reparto Activo</h1>
          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest mt-1">{load.orderNumber}</p>
        </div>
        <Badge className={cn("bg-slate-100 text-slate-500 border-none", isMeli && "bg-yellow-400 text-slate-900")}>
          {isMeli ? 'ML' : 'FTL'}
        </Badge>
      </div>

      {currentStop ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
            <CardContent className="p-8 space-y-6">
               <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Siguiente Entrega</p>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-tight">{currentStop.name}</h2>
                  </div>
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400">
                    <MapPin size={24} />
                  </div>
               </div>
               
               <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-sm font-bold leading-tight">{currentStop.address}</p>
                  <p className="text-[10px] text-white/40 font-bold uppercase mt-1">{currentStop.city}, {currentStop.province}</p>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <Button className="h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs uppercase" onClick={() => handleAction('nav')}>
                    <Navigation size={18} className="mr-2" /> Navegar
                  </Button>
                  <Button variant="outline" className="h-14 bg-white/5 border-white/10 text-white rounded-2xl font-black text-xs uppercase" onClick={() => handleAction('call')}>
                    <Phone size={18} className="mr-2" /> Llamar
                  </Button>
               </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
             <Button className="h-20 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-3xl shadow-xl flex flex-col items-center justify-center gap-1" onClick={() => setIsPodOpen(true)}>
                <CheckCircle size={28} />
                <span className="text-[10px] uppercase">Entregado</span>
             </Button>
             <Button className="h-20 bg-red-600 hover:bg-red-700 text-white font-black text-lg rounded-3xl shadow-xl flex flex-col items-center justify-center gap-1" onClick={() => setIsFailedOpen(true)}>
                <XCircle size={28} />
                <span className="text-[10px] uppercase">No Entregado</span>
             </Button>
          </div>
        </div>
      ) : (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
           <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-600 shadow-inner">
              <CheckCircle2 size={48} />
           </div>
           <div className="space-y-2">
              <h3 className="text-xl font-black uppercase italic tracking-tighter">Hoja de Ruta Completa</h3>
              <p className="text-sm text-slate-400 font-medium">Has finalizado todos los destinos de esta jornada.</p>
           </div>
           <Button className="bg-slate-900 text-white h-14 px-10 rounded-2xl font-black uppercase italic" onClick={() => router.push('/rutas')}>
              VOLVER A MI AGENDA
           </Button>
        </div>
      )}

      {/* DIALOG ENTREGADO */}
      <Dialog open={isPodOpen} onOpenChange={setIsPodOpen}>
        <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
           <div className="bg-green-600 text-white p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Confirmar Entrega</DialogTitle>
                <DialogDescription className="text-white/60 text-[10px] font-bold uppercase">{currentStop?.name}</DialogDescription>
              </DialogHeader>
           </div>
           <div className="p-6 space-y-6 bg-slate-50 overflow-y-auto max-h-[70vh]">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Receptor</Label>
                <Input className="h-12 bg-white rounded-xl" placeholder="Nombre completo" value={podForm.receiverName} onChange={e => setPodForm({...podForm, receiverName: e.target.value})} />
              </div>
              <SignaturePad title="Firma de Recepción" onSave={(url) => setPodForm({...podForm, receiverSignatureUrl: url})} />
              <div className="space-y-3">
                 <Label className="text-[10px] font-black uppercase text-slate-400">Foto de Evidencia</Label>
                 <input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (ev) => setPodForm({...podForm, photoUrl: ev.target?.result as string});
                      reader.readAsDataURL(file);
                    }
                 }} />
                 <div className="aspect-video bg-white rounded-3xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden" onClick={() => photoInputRef.current?.click()}>
                    {podForm.photoUrl ? <img src={podForm.photoUrl} className="w-full h-full object-cover" /> : <Camera size={32} className="text-slate-200" />}
                 </div>
              </div>
           </div>
           <div className="p-6 bg-white border-t">
              <Button className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-2xl" onClick={handleConfirmDelivery} disabled={isUpdating || !podForm.receiverName}>
                 FINALIZAR ENTREGA
              </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG NO ENTREGADO */}
      <Dialog open={isFailedOpen} onOpenChange={setIsFailedOpen}>
        <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-8 border-none shadow-2xl">
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-red-600">Reportar Fallo</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Seleccione el motivo por el cual no se pudo entregar</DialogDescription>
           </DialogHeader>
           <div className="grid grid-cols-1 gap-3 py-6">
              {INCIDENT_REASONS.map(r => (
                <Button key={r.id} variant="outline" className="h-14 justify-start px-6 rounded-2xl font-black text-xs uppercase border-2 hover:bg-red-50 hover:border-red-200" onClick={() => handleReportFailure(r.id)}>
                   {r.label}
                </Button>
              ))}
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
