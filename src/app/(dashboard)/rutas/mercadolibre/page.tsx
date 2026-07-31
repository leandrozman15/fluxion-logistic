'use client';

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, setDoc, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ShoppingBag, Camera, MapPin, CheckCircle2, 
  ArrowLeft, Loader2, Trash2, Edit2, Zap, 
  Navigation, ListOrdered, Play, XCircle, AlertTriangle, Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseLogisticsLabel, type LabelOutput } from "@/ai/flows/parse-logistics-label-flow";
import { cn } from "@/lib/utils";
import { calculateDistance } from "@/lib/utils/tracking-math";

export default function MercadoLibreDriverPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1); // 1: Home, 2: Camera/Processing, 3: Validation, 4: List/Ready
  const [scannedDestinations, setScannedDestinations] = useState<LabelOutput[]>([]);
  const [currentLabel, setCurrentLabel] = useState<LabelOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
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
        toast({ variant: "destructive", title: "Error de lectura", description: "No se pudo reconocer la etiqueta. Intente con más luz." });
        setStep(1);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveCurrentLabel = () => {
    if (currentLabel) {
      setScannedDestinations([...scannedDestinations, currentLabel]);
      setCurrentLabel(null);
      toast({ title: "Etiqueta guardada" });
      // Reabrir cámara automáticamente para la siguiente
      handleOpenScanner();
    }
  };

  const handleStartReparto = async () => {
    if (!db || scannedDestinations.length === 0) return;
    setIsSubmitting(true);
    try {
      // 1. Crear documento de flete oficial tipo 'LTL' para este reparto
      const loadsSnap = await getDocs(query(collection(db, "loads"), orderBy("orderNumber", "desc"), limit(1)));
      let nextSeq = 1;
      if (!loadsSnap.empty) {
        const parts = loadsSnap.docs[0].data().orderNumber.split("-");
        const lastNum = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
      }
      const orderNum = `ML-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;

      const newLoadRef = doc(collection(db, "loads"));
      await setDoc(newLoadRef, {
        id: newLoadRef.id,
        orderNumber: orderNum,
        clientName: "Mercado Libre (Colecta)",
        serviceType: 'standard',
        status: 'on_route',
        assignedDriverId: user?.uid || 'demo_driver',
        pickupDate: new Date().toISOString().split('T')[0],
        pickupTime: format(new Date(), "HH:mm"),
        origin: { name: "Depósito MELI", address: "CABA", city: "Capital Federal", country: "Argentina" },
        outboundStops: scannedDestinations.map(d => ({
          id: Math.random().toString(36).substring(7),
          name: d.recipient.name,
          address: `${d.address.street} ${d.address.number}`,
          city: d.address.city,
          province: d.address.province,
          country: "Argentina",
          weightKg: 1, // Estimado ML
          description: `Tracking: ${d.tracking.id}`,
          documents: [{ id: d.tracking.id, type: 'remito', number: d.tracking.id, uploadedAt: serverTimestamp() }]
        })),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tracking: {
          tripStartedAt: serverTimestamp(),
          currentLat: -34.6, currentLng: -58.3, currentSpeed: 0, distanceTraveledKm: 0, distanceRemainingKm: 20, history: [], alerts: []
        }
      });

      toast({ title: "¡Reparto Iniciado!", description: "Ruta oficial generada." });
      router.push(`/rutas/${newLoadRef.id}`);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al crear reparto" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
       <div className="flex items-center justify-between pt-6 px-2">
         <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
         <div className="flex items-center gap-2">
            <ShoppingBag className="text-yellow-500" />
            <h1 className="font-black text-lg italic uppercase tracking-tighter">Mercado Libre</h1>
         </div>
         <Badge className="bg-yellow-400 text-slate-900 border-none">LIVE</Badge>
       </div>

       {step === 1 && (
         <div className="px-2 space-y-6 animate-in fade-in">
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-slate-900 text-white">
               <CardContent className="p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-yellow-400 rounded-3xl flex items-center justify-center text-slate-900 mx-auto shadow-2xl shadow-yellow-500/20">
                     <Camera size={40} />
                  </div>
                  <div className="space-y-1">
                     <h2 className="text-2xl font-black italic uppercase tracking-tighter">Gestión de Colecta</h2>
                     <p className="text-xs text-white/50 font-bold uppercase">Escanee las etiquetas de los paquetes para iniciar.</p>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={onFileChange} />
                  <Button className="w-full h-16 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black text-lg rounded-2xl shadow-xl" onClick={handleOpenScanner}>
                     CARGAR ETIQUETAS
                  </Button>
               </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
               <Card className="border-none shadow-sm bg-white rounded-2xl">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                     <MapPin className="text-blue-500" />
                     <p className="text-[10px] font-black text-slate-400 uppercase">Destinos</p>
                     <p className="text-xl font-black">{scannedDestinations.length}</p>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-sm bg-white rounded-2xl">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                     <Zap className="text-yellow-500" />
                     <p className="text-[10px] font-black text-slate-400 uppercase">Estado</p>
                     <p className="text-xs font-black text-green-600 uppercase">Sincronizado</p>
                  </CardContent>
               </Card>
            </div>

            {scannedDestinations.length > 0 && (
               <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paquetes Cargados</p>
                    <Button variant="ghost" className="h-6 text-[9px] font-black text-red-500" onClick={() => setScannedDestinations([])}>LIMPIAR TODO</Button>
                  </div>
                  <div className="space-y-3">
                     {scannedDestinations.map((dest, i) => (
                       <div key={i} className="p-4 bg-white rounded-2xl border flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">{i+1}</div>
                             <div>
                                <p className="text-xs font-black text-slate-800 uppercase leading-none">{dest.recipient.name}</p>
                                <p className="text-[9px] text-slate-400 font-medium mt-1">{dest.address.street} {dest.address.number}</p>
                             </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] h-4 font-mono">{dest.tracking.id}</Badge>
                       </div>
                     ))}
                  </div>
                  <Button className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl mt-6" onClick={handleStartReparto} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Navigation className="mr-2" />}
                    COMENZAR REPARTO
                  </Button>
               </div>
            )}
         </div>
       )}

       {step === 2 && (
         <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95">
            <div className="relative">
               <div className="w-32 h-32 bg-yellow-100 rounded-[2.5rem] flex items-center justify-center text-yellow-600 animate-pulse">
                  <Zap size={64} className="fill-current" />
               </div>
               <div className="absolute inset-0 border-4 border-yellow-400 border-dashed rounded-[2.5rem] animate-spin"></div>
            </div>
            <div className="space-y-2">
               <h3 className="text-xl font-black italic uppercase tracking-tighter">Analizando Etiqueta</h3>
               <p className="text-sm text-slate-400 font-medium">La IA está extrayendo los datos de envío...</p>
            </div>
         </div>
       )}

       {step === 3 && currentLabel && (
         <div className="px-2 space-y-6 animate-in slide-in-from-bottom-4">
            <div className="text-center space-y-1">
               <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
               <h3 className="text-xl font-black italic uppercase text-slate-900 leading-none">Datos Confirmados</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase">Validación Geográfica Exitosa</p>
            </div>

            <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden">
               <CardHeader className="bg-slate-900 text-white p-6">
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Destinatario</p>
                        <CardTitle className="text-lg font-black uppercase italic tracking-tighter">{currentLabel.recipient.name}</CardTitle>
                     </div>
                     <Badge className="bg-blue-600 text-white text-[8px] font-black border-none px-3">OK</Badge>
                  </div>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                     <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><MapPin size={12}/> Dirección de Entrega</p>
                     <div className="p-4 bg-slate-50 rounded-2xl border space-y-1">
                        <p className="text-sm font-bold text-slate-800">{currentLabel.address.street} {currentLabel.address.number}</p>
                        <p className="text-xs text-slate-500 font-medium uppercase">{currentLabel.address.city}, {currentLabel.address.province}</p>
                        <p className="text-[10px] text-blue-600 font-mono font-bold">CP: {currentLabel.address.zipCode}</p>
                     </div>
                  </div>
                  <div className="space-y-3">
                     <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Zap size={12}/> Logística</p>
                     <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-2xl">
                        <p className="text-[9px] font-black text-yellow-600 uppercase">Tracking ID</p>
                        <p className="text-base font-mono font-black text-slate-800 tracking-wider">{currentLabel.tracking.id}</p>
                     </div>
                  </div>
               </CardContent>
               <CardFooter className="p-6 bg-slate-50 flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl h-14 font-bold text-slate-500" onClick={() => setStep(1)}>CANCELAR</Button>
                  <Button className="flex-[2] rounded-xl h-14 bg-green-600 hover:bg-green-700 text-white font-black text-lg shadow-lg" onClick={saveCurrentLabel}>
                    GUARDAR <ChevronRight className="ml-2" />
                  </Button>
               </CardFooter>
            </Card>
         </div>
       )}
    </div>
  );
}

import { format } from "date-fns";
