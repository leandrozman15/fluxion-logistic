'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  ArrowLeft, MapPin, CheckCircle2, 
  Loader2, Navigation, Phone, CheckCircle, 
  XCircle, Camera, Siren, AlertTriangle, ShieldAlert,
  MessageCircle,
  Headset
} from "lucide-react";
import { Load, ProofOfDelivery, Truck, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/SignaturePad";
import { normalizePhone, buildWaMeUrl } from "@/lib/utils/whatsapp";

const INCIDENT_REASONS = [
  { id: 'absent', label: 'Cliente Ausente' },
  { id: 'wrong_address', label: 'Dirección Incorrecta' },
  { id: 'no_response', label: 'No Responde' },
  { id: 'refused', label: 'Rechazó Paquete' },
  { id: 'other', label: 'Otro Motivo' }
];

const EMERGENCY_TYPES = [
  { id: 'security', label: 'PROBLEMA DE SEGURIDAD', icon: ShieldAlert, color: 'bg-red-600' },
  { id: 'mechanical', label: 'FALLA MECÁNICA / AUXILIO', icon: Siren, color: 'bg-orange-600' },
  { id: 'accident', label: 'SINIESTRO / ACCIDENTE', icon: AlertTriangle, color: 'bg-red-800' }
];

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [isFailedOpen, setIsFailedOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [podForm, setPodForm] = useState<Partial<ProofOfDelivery>>({
    receiverName: "",
    receiverSignatureUrl: "",
    driverSignatureUrl: "",
    photoUrl: "",
    notes: "",
    status: 'delivered'
  });

  const loadRef = useMemo(() => (db && tenantId && id) ? doc(db, "tenants", tenantId, "loads", id as string) : null, [db, tenantId, id]);
  const { data: load, loading: loadLoading } = useDoc<Load>(loadRef);

  const tenantRef = useMemo(() => (db && tenantId) ? doc(db, "tenants", tenantId) : null, [db, tenantId]);
  const { data: tenant } = useDoc<Tenant>(tenantRef);

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

  const handleContactCentral = (type: 'call' | 'whatsapp') => {
    const centralPhone = tenant?.settings?.centralPhone;
    if (!centralPhone) {
      toast({ variant: "destructive", title: "Número no configurado", description: "La central no ha definido un número de contacto." });
      return;
    }

    const normalized = normalizePhone(centralPhone);
    if (type === 'call') {
      window.open(`tel:${normalized}`, '_self');
    } else {
      window.open(buildWaMeUrl(normalized!, `Hola Central, soy el chofer del viaje ${load?.orderNumber}.`), '_blank');
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

  const handleTriggerEmergency = async (type: string, label: string) => {
    if (!db || !tenantId || !load?.assignedTruckId || !loadRef) return;
    setIsUpdating(true);
    try {
      const truckRef = doc(db, "tenants", tenantId, "trucks", load.assignedTruckId);
      await updateDoc(truckRef, {
        hasActiveAlert: true,
        alertType: type,
        updatedAt: serverTimestamp()
      });

      await updateDoc(loadRef, {
        status: 'incident',
        "tracking.alerts": arrayUnion({
          type: 'critical',
          message: `S.O.S CONDUCTOR: ${label}`,
          timestamp: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      toast({ 
        variant: "destructive", 
        title: "ALERTA ENVIADA", 
        description: "La central ha sido notificada de su emergencia." 
      });
      setIsEmergencyOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al enviar alerta" });
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

          <Card className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden">
             <CardHeader className="bg-slate-50 py-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                   <Headset size={14} className="text-blue-600" /> Comunicación con Central
                </CardTitle>
             </CardHeader>
             <CardContent className="p-4 grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 rounded-2xl font-bold text-[10px] uppercase border-slate-200" onClick={() => handleContactCentral('call')}>
                   <Phone size={14} className="mr-2 text-blue-600" /> Llamada Voz
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl font-bold text-[10px] uppercase border-green-200 text-green-700 bg-green-50" onClick={() => handleContactCentral('whatsapp')}>
                   <MessageCircle size={14} className="mr-2" /> WhatsApp
                </Button>
             </CardContent>
          </Card>

          <Button 
            variant="destructive" 
            className="w-full h-16 rounded-2xl font-black text-lg shadow-2xl animate-pulse flex items-center gap-3"
            onClick={() => setIsEmergencyOpen(true)}
          >
            <Siren size={32} /> S.O.S / EMERGENCIA
          </Button>
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

      {/* DIALOG EMERGENCIA */}
      <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
        <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-8 border-none shadow-2xl bg-red-50">
           <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-red-700">Protocolo de Auxilio</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase text-red-400">Su ubicación será enviada a la central de monitoreo inmediatamente</DialogDescription>
           </DialogHeader>
           <div className="flex flex-col gap-4 py-6">
              {EMERGENCY_TYPES.map(e => (
                <Button 
                  key={e.id} 
                  className={cn("h-20 justify-start gap-4 px-6 rounded-3xl font-black text-sm uppercase text-white shadow-xl", e.color)}
                  onClick={() => handleTriggerEmergency(e.id, e.label)}
                  disabled={isUpdating}
                >
                   <e.icon size={32} />
                   <span>{e.label}</span>
                </Button>
              ))}
           </div>
           <DialogFooter>
              <Button variant="ghost" className="w-full text-slate-400 font-bold" onClick={() => setIsEmergencyOpen(false)}>CANCELAR ALERTA</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Button key={r.id} variant="outline" className="h-14 justify-start px-6 rounded-2xl font-black text-xs uppercase border-2 hover:bg-red-50 hover:border-red-200" onClick={() => handleReportFailure(r.id as any)}>
                   {r.label}
                </Button>
              ))}
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
