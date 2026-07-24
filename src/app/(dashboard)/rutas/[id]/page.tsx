
'use client';

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  Truck, 
  Package, 
  FileText, 
  ShieldAlert, 
  Clock, 
  Navigation,
  Info,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import { Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const handleUpdateStatus = async (newStatus: any) => {
    if (!loadRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(loadRef, { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Estado Actualizado", description: `Viaje marcado como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Clock className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Viaje no encontrado.</div>;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32">
      {/* Header Fijo */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <div className="text-center">
          <h1 className="font-bold text-lg">Hoja de Ruta</h1>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{load.orderNumber}</p>
        </div>
        <Button variant="ghost" size="icon" className="text-red-500"><ShieldAlert /></Button>
      </div>

      {/* Selector de Status Rápido */}
      <Card className="bg-slate-900 text-white border-none overflow-hidden">
        <CardContent className="p-6 text-center space-y-4">
           <div className="space-y-1">
             <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Estado de Misión</p>
             <h2 className="text-2xl font-black uppercase italic">{load.status.replace('_', ' ')}</h2>
           </div>
           
           <div className="flex gap-2">
             {load.status === 'assigned' && (
               <Button className="w-full bg-blue-600 h-14 text-lg font-bold" onClick={() => handleUpdateStatus('on_route')} disabled={isUpdating}>
                 INICIAR VIAJE
               </Button>
             )}
             {load.status === 'on_route' && (
               <Button className="w-full bg-green-600 h-14 text-lg font-bold" onClick={() => handleUpdateStatus('delivered')} disabled={isUpdating}>
                 CONFIRMAR ENTREGA
               </Button>
             )}
             {load.status === 'delivered' && (
               <div className="w-full py-4 text-green-400 font-bold flex items-center justify-center gap-2">
                 <CheckCircle2 /> VIAJE FINALIZADO
               </div>
             )}
           </div>
        </CardContent>
      </Card>

      {/* Timeline de la Misión */}
      <div className="space-y-6 px-2">
        {/* Punto 1: Origen */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status !== 'pending' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
              {load.status !== 'pending' ? <CheckCircle2 size={16}/> : <Package size={16}/>}
            </div>
            <div className="w-0.5 h-full bg-slate-100 min-h-[100px]"></div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">Punto de Carga (Origen)</h3>
              <p className="text-xs text-slate-500">{load.origin.name}</p>
            </div>
            <Card className="bg-slate-50 border-none shadow-none">
              <CardContent className="p-4 space-y-3">
                 <div className="flex items-start gap-2 text-sm">
                   <MapPin size={16} className="text-blue-600 shrink-0 mt-0.5" />
                   <span className="font-medium">{load.origin.address}, {load.origin.province}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10 bg-white" onClick={() => window.open(`tel:${load.origin.phone}`)}>
                      <Phone size={14} className="mr-2" /> Llamar
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 bg-white" onClick={() => window.open(`https://wa.me/${load.origin.phone}`)}>
                      <MessageSquare size={14} className="mr-2" /> WhatsApp
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Punto 2: Destino */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2", load.status === 'delivered' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')}>
               <Navigation size={16}/>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">Punto de Entrega (Destino)</h3>
              <p className="text-xs text-slate-500">{load.destination.name}</p>
            </div>
            <Card className="bg-slate-50 border-none shadow-none">
              <CardContent className="p-4 space-y-3">
                 <div className="flex items-start gap-2 text-sm">
                   <MapPin size={16} className="text-blue-600 shrink-0 mt-0.5" />
                   <span className="font-medium">{load.destination.address}, {load.destination.province}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10 bg-white" onClick={() => window.open(`tel:${load.destination.phone}`)}>
                      <Phone size={14} className="mr-2" /> Llamar
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 bg-white" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${load.destination.address}`)}>
                      <Navigation size={14} className="mr-2" /> GPS Ruta
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Detalles de la Carga */}
      <div className="px-2 space-y-4">
        <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Detalles Técnicos</h4>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-4 grid grid-cols-2 gap-6">
             <div className="space-y-1">
               <p className="text-[10px] text-slate-400 uppercase font-bold">Mercadería</p>
               <p className="text-sm font-bold">{load.description}</p>
             </div>
             <div className="space-y-1 text-right">
               <p className="text-[10px] text-slate-400 uppercase font-bold">Peso Total</p>
               <p className="text-sm font-bold">{load.weightKg.toLocaleString()} KG</p>
             </div>
             <div className="space-y-1">
               <p className="text-[10px] text-slate-400 uppercase font-bold">Unidades</p>
               <p className="text-sm font-bold">{load.units} {load.unitType}</p>
             </div>
             <div className="space-y-1 text-right">
               <p className="text-[10px] text-slate-400 uppercase font-bold">Prioridad</p>
               <Badge className="bg-blue-50 text-blue-600 border-none h-5 text-[9px] uppercase">{load.priority}</Badge>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentación Digital */}
      <div className="px-2 space-y-4">
        <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Documentos del Viaje</h4>
        <div className="grid gap-2">
           <Button variant="outline" className="w-full justify-between h-12 bg-white">
             <div className="flex items-center gap-2"><FileText className="text-blue-600" size={18}/> Remito Digital</div>
             <ChevronRight size={16} />
           </Button>
           {load.serviceType === 'customs' && (
             <Button variant="outline" className="w-full justify-between h-12 bg-white">
               <div className="flex items-center gap-2"><FileText className="text-orange-600" size={18}/> MIC/DTA Aduana</div>
               <ChevronRight size={16} />
             </Button>
           )}
        </div>
      </div>

      {/* Botón de Emergencia Flotante */}
      <div className="fixed bottom-6 left-6 right-6 flex gap-3">
         <Button variant="destructive" className="flex-1 h-14 font-bold shadow-lg">
           <AlertTriangle className="mr-2" /> INCIDENTE
         </Button>
         <Button className="bg-blue-600 flex-1 h-14 font-bold shadow-lg" onClick={() => window.open(`tel:0800-LOGISTICA`)}>
           <Phone className="mr-2" /> CENTRAL
         </Button>
      </div>
    </div>
  );
}
