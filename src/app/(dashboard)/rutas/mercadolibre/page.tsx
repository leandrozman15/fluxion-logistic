
'use client';

import { useState, useRef, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFirestore, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ShoppingBag, Camera, MapPin, CheckCircle2, 
  ArrowLeft, Loader2, Trash2, Edit2, Zap, 
  Navigation, ListOrdered, Play, XCircle, AlertTriangle, Search, QrCode, ChevronRight, Save, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseLogisticsLabel, type LabelOutput } from "@/ai/flows/parse-logistics-label-flow";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function MercadoLibreScanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preAssignedLoadId = searchParams.get('loadId');

  const [step, setStep] = useState(1); // 1: Home, 2: Camera/Processing, 3: Validation, 4: Summary/Optimize
  const [scannedDestinations, setScannedDestinations] = useState<LabelOutput[]>([]);
  const [currentLabel, setCurrentLabel] = useState<LabelOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenScanner = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStep(2);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await parseLogisticsLabel(base64);
        setCurrentLabel(result);
        setStep(3);
      } catch (err) {
        toast({ variant: "destructive", title: "Lectura fallida", description: "Reintente con mejor iluminación." });
        setStep(1);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveCurrentLabel = () => {
    if (currentLabel) {
      setScannedDestinations(prev => [...prev, currentLabel]);
      setCurrentLabel(null);
      toast({ title: "Paquete registrado" });
      // REAPERTURA AUTOMÁTICA PARA ESCANEO CONTINUO
      setTimeout(() => handleOpenScanner(), 500);
      setStep(1);
    }
  };

  const handleStartReparto = async () => {
    if (!db || scannedDestinations.length === 0) return;
    setIsSubmitting(true);
    try {
      const stops = scannedDestinations.map(d => ({
        id: Math.random().toString(36).substring(7),
        name: d.recipient.name,
        address: `${d.address.street} ${d.address.number}`,
        city: d.address.city,
        province: d.address.province,
        country: "Argentina" as const,
        weightKg: 1,
        description: `Tracking: ${d.tracking.id} | Barrio: ${d.address.barrio || 'S/D'}`,
        documents: [{ 
          id: d.tracking.id, 
          type: 'remito' as const, 
          number: d.tracking.id, 
          uploadedAt: new Date().toISOString(),
          leg: 'outbound' 
        }]
      }));

      if (preAssignedLoadId) {
        await updateDoc(doc(db, "loads", preAssignedLoadId), {
          outboundStops: stops,
          status: 'on_route',
          updatedAt: serverTimestamp()
        });
        toast({ title: "Reparto Iniciado", description: "Hoja de ruta sincronizada con Central." });
        router.push(`/rutas/${preAssignedLoadId}`);
      } else {
        const orderNum = `ML-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000)}`;
        const newRef = doc(collection(db, "loads"));
        await setDoc(newRef, {
          id: newRef.id,
          orderNumber: orderNum,
          clientName: "Mercado Libre (Colecta Directa)",
          serviceType: 'meli',
          status: 'on_route',
          assignedDriverId: user?.uid || 'demo_driver',
          pickupDate: new Date().toISOString().split('T')[0],
          pickupTime: format(new Date(), "HH:mm"),
          origin: { name: "Depósito MELI", address: "CABA", city: "Capital Federal", country: "Argentina" },
          outboundStops: stops,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          tracking: {
            tripStartedAt: serverTimestamp(),
            currentLat: -34.6, currentLng: -58.3, currentSpeed: 0, distanceTraveledKm: 0, distanceRemainingKm: 20, history: [], alerts: []
          }
        });
        router.push(`/rutas/${newRef.id}`);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 px-2">
       <div className="flex items-center justify-between pt-6">
         <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
         <div className="flex items-center gap-2">
            <ShoppingBag className="text-yellow-500" />
            <h1 className="font-black text-lg italic uppercase tracking-tighter">Módulo Mercado Libre</h1>
         </div>
         <Badge className="bg-yellow-400 text-slate-900 border-none">{scannedDestinations.length}</Badge>
       </div>

       {step === 1 && (
         <div className="space-y-6 animate-in fade-in">
            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
               <CardContent className="p-8 text-center space-y-6">
                  <div className="w-24 h-24 bg-yellow-400 rounded-[2rem] flex items-center justify-center text-slate-900 mx-auto shadow-2xl">
                     <Camera size={48} />
                  </div>
                  <div className="space-y-1">
                     <h2 className="text-2xl font-black italic uppercase tracking-tighter">Escanear Etiquetas</h2>
                     <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
                       Fotografíe las etiquetas para cargar la ruta
                     </p>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={onFileChange} />
                  <Button className="w-full h-20 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black text-xl rounded-2xl shadow-xl" onClick={handleOpenScanner}>
                     INICIAR CÁMARA
                  </Button>
               </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
               <Card className="border-none shadow-sm bg-white rounded-2xl p-4 flex flex-col items-center text-center gap-1">
                  <MapPin className="text-blue-500 mb-1" size={20} />
                  <p className="text-[9px] font-black text-slate-400 uppercase">Cargados</p>
                  <p className="text-2xl font-black">{scannedDestinations.length}</p>
               </Card>
               <Card className="border-none shadow-sm bg-white rounded-2xl p-4 flex flex-col items-center text-center gap-1">
                  <Zap className="text-yellow-500 mb-1" size={20} />
                  <p className="text-[9px] font-black text-slate-400 uppercase">Estado</p>
                  <p className="text-[10px] font-black text-green-600 uppercase">Listo</p>
               </Card>
            </div>

            {scannedDestinations.length > 0 && (
               <div className="space-y-4 animate-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center px-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinos en Camión</p>
                    <Button variant="ghost" className="h-6 text-[9px] font-black text-red-500" onClick={() => setScannedDestinations([])}>LIMPIAR</Button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                     {scannedDestinations.map((dest, i) => (
                       <div key={i} className="p-4 bg-white rounded-2xl border flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">{i+1}</div>
                             <div>
                                <p className="text-xs font-black text-slate-800 uppercase leading-none">{dest.recipient.name}</p>
                                <p className="text-[9px] text-slate-400 font-medium mt-1 truncate max-w-[150px]">{dest.address.street} {dest.address.number}</p>
                             </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] h-4 font-mono">{dest.tracking.id.substring(0, 8)}</Badge>
                       </div>
                     ))}
                  </div>
                  
                  <div className="p-6 bg-blue-600 rounded-[2rem] shadow-2xl space-y-4">
                     <div className="flex items-center justify-between text-white">
                        <div>
                           <p className="text-[10px] font-black uppercase opacity-60">Ruta Optimizada</p>
                           <p className="text-xl font-black italic tracking-tighter">{scannedDestinations.length} ENTREGAS</p>
                        </div>
                        <Navigation size={32} className="opacity-30" />
                     </div>
                     <Button className="w-full h-16 bg-white text-blue-600 hover:bg-blue-50 font-black text-lg rounded-2xl shadow-xl" onClick={handleStartReparto} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />}
                        COMENZAR REPARTO
                     </Button>
                  </div>
               </div>
            )}
         </div>
       )}

       {step === 2 && (
         <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95">
            <div className="relative">
               <div className="w-40 h-40 bg-yellow-100 rounded-[3rem] flex items-center justify-center text-yellow-600 animate-pulse">
                  <ShoppingBag size={80} className="fill-current" />
               </div>
               <div className="absolute inset-0 border-4 border-yellow-400 border-dashed rounded-[3rem] animate-spin duration-[3000ms]"></div>
            </div>
            <div className="space-y-1">
               <h3 className="text-2xl font-black italic uppercase tracking-tighter">Analizando Paquete</h3>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">IA extrayendo datos logísticos...</p>
            </div>
         </div>
       )}

       {step === 3 && currentLabel && (
         <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="text-center space-y-1">
               <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
               <h3 className="text-2xl font-black italic uppercase text-slate-900 leading-none">Datos Leídos</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Validación de Dirección Exitosa</p>
            </div>

            <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
               <CardHeader className="bg-slate-900 text-white p-8">
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Destinatario</p>
                        <CardTitle className="text-xl font-black uppercase italic tracking-tighter leading-tight">{currentLabel.recipient.name}</CardTitle>
                     </div>
                     <Badge className="bg-blue-600 text-white border-none px-3 font-black text-[10px]">✓</Badge>
                  </div>
               </CardHeader>
               <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                     <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><MapPin size={12}/> Dirección de Entrega</p>
                     <div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-1">
                        <p className="text-lg font-black text-slate-800 leading-tight">{currentLabel.address.street} {currentLabel.address.number}</p>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">
                          {currentLabel.address.barrio && `${currentLabel.address.barrio}, `}
                          {currentLabel.address.city}, {currentLabel.address.province}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                           <Badge variant="outline" className="bg-white border-slate-200 text-blue-600 font-mono">CP: {currentLabel.address.zipCode}</Badge>
                           {currentLabel.address.floor && <Badge variant="outline" className="bg-white">PISO {currentLabel.address.floor}</Badge>}
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tracking ID</Label>
                        <Input readOnly className="bg-slate-50 border-none font-mono text-xs font-bold h-10" value={currentLabel.tracking.id} />
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[9px] font-black text-slate-400 uppercase ml-1">Entrega</Label>
                        <Input readOnly className="bg-slate-50 border-none text-[10px] font-black uppercase h-10" value={currentLabel.tracking.deliveryWindow || 'Cualquier hora'} />
                     </div>
                  </div>
               </CardContent>
               <CardFooter className="p-8 bg-slate-50 flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-2xl h-16 font-black text-slate-500 uppercase text-xs" onClick={() => setStep(1)}>CANCELAR</Button>
                  <Button className="flex-[2] rounded-2xl h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg shadow-xl" onClick={saveCurrentLabel}>
                    GUARDAR DESTINO <ChevronRight className="ml-2" />
                  </Button>
               </CardFooter>
            </Card>
         </div>
       )}
    </div>
  );
}

export default function MercadoLibreDriverPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500" /></div>}>
      <MercadoLibreScanner />
    </Suspense>
  );
}
