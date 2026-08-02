'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, serverTimestamp, arrayUnion, writeBatch } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
  Headset,
  Zap,
  Radio,
  Compass,
  Play,
  User,
  Truck as TruckIcon,
  Signature
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
  const [gpsStatus, setGpsStatus] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const watchIdRef = useRef<number | null>(null);

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

  // EFECTO: Seguimiento GPS en tiempo real
  useEffect(() => {
    if (!load || load.status !== 'on_route' || !loadRef || !db || !tenantId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setGpsStatus('off');
      }
      return;
    }

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setGpsStatus('requesting');
      
      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      };

      const success = async (pos: GeolocationPosition) => {
        setGpsStatus('active');
        const { latitude, longitude, speed } = pos.coords;
        const currentSpeed = speed ? Math.round(speed * 3.6) : 0; // Convert to km/h

        try {
          // 1. Actualizar el viaje (Historial y telemetría)
          updateDoc(loadRef, {
            "tracking.currentLat": latitude,
            "tracking.currentLng": longitude,
            "tracking.currentSpeed": currentSpeed,
            "tracking.lastUpdateAt": serverTimestamp(),
            "tracking.history": arrayUnion({
              lat: latitude,
              lng: longitude,
              speed: currentSpeed,
              timestamp: new Date().toISOString()
            })
          });

          // 2. Actualizar la ubicación del camión en la flota
          if (load.assignedTruckId) {
            const truckRef = doc(db, "tenants", tenantId, "trucks", load.assignedTruckId);
            updateDoc(truckRef, {
              "location.lat": latitude,
              "location.lng": longitude,
              "location.city": "En Tránsito",
              updatedAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("GPS Sync Error:", e);
        }
      };

      const error = (err: GeolocationPositionError) => {
        console.error("Geolocation Error:", err);
        setGpsStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          toast({ 
            variant: "destructive", 
            title: "GPS Bloqueado", 
            description: "Por favor, active los permisos de ubicación en los ajustes de su navegador/celular." 
          });
        }
      };

      watchIdRef.current = navigator.geolocation.watchPosition(success, error, options);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [load?.status, loadRef, db, tenantId, toast]);

  const currentStop = useMemo(() => {
    if (!load?.outboundStops) return null;
    return load.outboundStops.find(s => !s.deliveredAt && !s.failedAt);
  }, [load?.outboundStops]);

  const handleStartTrip = async () => {
    if (!load || !loadRef || !tenantId || !db) return;

    if (!("geolocation" in navigator)) {
      toast({ variant: "destructive", title: "Error de Hardware", description: "Su dispositivo no posee sensor GPS compatible." });
      return;
    }

    setIsUpdating(true);
    setGpsStatus('requesting');

    // SOLICITUD NATIVA DE PERMISOS (Pre-flight)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const batch = writeBatch(db);
          
          // Actualizar estado del viaje
          batch.update(loadRef, {
            status: 'on_route',
            "tracking.tripStartedAt": serverTimestamp(),
            "tracking.currentLat": pos.coords.latitude,
            "tracking.currentLng": pos.coords.longitude,
            updatedAt: serverTimestamp()
          });

          // Actualizar estado del camión
          if (load.assignedTruckId) {
            const truckRef = doc(db, "tenants", tenantId, "trucks", load.assignedTruckId);
            batch.update(truckRef, { 
              status: 'in_trip',
              "location.lat": pos.coords.latitude,
              "location.lng": pos.coords.longitude,
              updatedAt: serverTimestamp()
            });
          }

          await batch.commit();
          setGpsStatus('active');
          toast({ title: "Jornada Iniciada", description: "Permisos concedidos. GPS transmitiendo en vivo." });
        } catch (e) {
          toast({ variant: "destructive", title: "Error de Sincronización" });
        } finally {
          setIsUpdating(false);
        }
      },
      (err) => {
        setIsUpdating(false);
        setGpsStatus('error');
        let msg = "Debe permitir el acceso al GPS para poder iniciar el viaje.";
        if (err.code === err.TIMEOUT) msg = "El GPS tardó demasiado en responder. Verifique estar en un lugar a cielo abierto.";
        toast({ variant: "destructive", title: "GPS Requerido", description: msg });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
    if (!load || !loadRef || !currentStop || !db || !tenantId) return;
    setIsUpdating(true);
    try {
      const updatedStops = load.outboundStops.map(s => 
        s.id === currentStop.id ? { 
          ...s, 
          deliveredAt: new Date().toISOString(),
          proofOfDelivery: { ...podForm, status: 'delivered', confirmedAt: new Date().toISOString() }
        } : s
      );

      const allFinished = updatedStops.every(s => !!s.deliveredAt || !!s.failedAt);
      
      const batch = writeBatch(db);
      
      batch.update(loadRef, {
        outboundStops: updatedStops,
        status: allFinished ? 'delivered' : load.status,
        updatedAt: serverTimestamp()
      });

      if (allFinished && load.assignedTruckId) {
        const truckRef = doc(db, "tenants", tenantId, "trucks", load.assignedTruckId);
        batch.update(truckRef, { 
          status: 'available',
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();

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
    if (!load || !loadRef || !currentStop || !db || !tenantId) return;
    setIsUpdating(true);
    try {
      const updatedStops = load.outboundStops.map(s => 
        s.id === currentStop.id ? { 
          ...s, 
          failedAt: new Date().toISOString(),
          proofOfDelivery: { status: 'failed', failedReason: reason, confirmedAt: new Date().toISOString(), receiverName: "FALLIDO" }
        } : s
      );

      const allFinished = updatedStops.every(s => !!s.deliveredAt || !!s.failedAt);
      const batch = writeBatch(db);

      batch.update(loadRef, {
        outboundStops: updatedStops,
        status: allFinished ? 'delivered' : load.status,
        updatedAt: serverTimestamp()
      });

      if (allFinished && load.assignedTruckId) {
        const truckRef = doc(db, "tenants", tenantId, "trucks", load.assignedTruckId);
        batch.update(truckRef, { status: 'available', updatedAt: serverTimestamp() });
      }

      await batch.commit();

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

  const isPodFormValid = podForm.receiverName && podForm.receiverSignatureUrl && podForm.driverSignatureUrl;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32 px-2">
      <div className="flex items-center justify-between pt-6 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
        <div className="text-center">
          <h1 className="font-black text-lg tracking-tighter italic uppercase text-slate-900 leading-none">Terminal Móvil</h1>
          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest mt-1">{load.orderNumber}</p>
        </div>
        <div className="flex flex-col items-center">
           {gpsStatus === 'active' ? (
             <Badge className="bg-green-600 text-white border-none text-[8px] h-5 animate-pulse">
                <Radio size={10} className="mr-1" /> GPS VIVO
             </Badge>
           ) : gpsStatus === 'requesting' ? (
             <Badge variant="outline" className="text-[8px] h-5 border-blue-400 text-blue-600 animate-pulse">BUSCANDO...</Badge>
           ) : gpsStatus === 'error' ? (
             <Badge variant="destructive" className="text-[8px] h-5">SIN SEÑAL</Badge>
           ) : (
             <Badge variant="outline" className="text-[8px] h-5">GPS OFF</Badge>
           )}
        </div>
      </div>

      {load.status === 'assigned' ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
           <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 text-white p-8 text-center">
                 <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                    <TruckIcon size={32} />
                 </div>
                 <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Preparado para Salida</CardTitle>
                 <CardDescription className="text-white/40 text-[10px] font-bold uppercase">Debe permitir el uso del GPS para activar el monitoreo central</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 <div className="flex justify-between items-center text-sm border-b pb-3">
                    <span className="font-bold text-slate-400 uppercase">Punto de Carga</span>
                    <span className="font-black text-slate-800 uppercase">{load.origin.name}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm border-b pb-3">
                    <span className="font-bold text-slate-400 uppercase">Destinos</span>
                    <span className="font-black text-slate-800">{load.outboundStops.length} Paradas</span>
                 </div>
              </CardContent>
              <CardFooter className="p-8 pt-0">
                 <Button className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl rounded-3xl shadow-2xl transition-all active:scale-95" onClick={handleStartTrip} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />}
                    INICIAR JORNADA
                 </Button>
              </CardFooter>
           </Card>
        </div>
      ) : currentStop ? (
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

      {/* DIALOG ENTREGADO (POD) */}
      <Dialog open={isPodOpen} onOpenChange={setIsPodOpen}>
        <DialogContent className="max-w-[100vw] sm:max-w-lg h-[100dvh] sm:h-auto rounded-none sm:rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
           <div className="bg-green-600 text-white p-6 shrink-0">
              <DialogHeader>
                <div className="flex justify-between items-center">
                   <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Certificar Entrega</DialogTitle>
                   <Button variant="ghost" size="icon" onClick={() => setIsPodOpen(false)} className="text-white/60 hover:text-white"><XCircle /></Button>
                </div>
                <DialogDescription className="text-white/60 text-[10px] font-bold uppercase">{currentStop?.name}</DialogDescription>
              </DialogHeader>
           </div>
           
           <div className="flex-1 p-6 space-y-6 bg-slate-50 overflow-y-auto">
              <div className="space-y-4">
                 <div className="space-y-1.5">
                   <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre de quien recibe</Label>
                   <Input 
                    className="h-12 bg-white rounded-xl font-bold" 
                    placeholder="Ej: Juan Perez" 
                    value={podForm.receiverName} 
                    onChange={e => setPodForm({...podForm, receiverName: e.target.value})} 
                   />
                 </div>

                 <div className="grid grid-cols-1 gap-4">
                    <SignaturePad 
                      title="Firma del Receptor" 
                      onSave={(url) => setPodForm({...podForm, receiverSignatureUrl: url})} 
                      defaultValue={podForm.receiverSignatureUrl}
                    />
                    
                    <SignaturePad 
                      title="Firma del Chofer (Certifica)" 
                      onSave={(url) => setPodForm({...podForm, driverSignatureUrl: url})} 
                      defaultValue={podForm.driverSignatureUrl}
                    />
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Evidencia Fotográfica (Bulto/Puerta)</Label>
                    <input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onload = async (ev) => setPodForm({...podForm, photoUrl: ev.target?.result as string});
                         reader.readAsDataURL(file);
                       }
                    }} />
                    <div className={cn(
                      "aspect-video bg-white rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all",
                      podForm.photoUrl ? "border-blue-400" : "border-slate-200"
                    )} onClick={() => photoInputRef.current?.click()}>
                       {podForm.photoUrl ? (
                         <img src={podForm.photoUrl} className="w-full h-full object-cover" alt="POD" />
                       ) : (
                         <>
                           <Camera size={32} className="text-slate-200" />
                           <p className="text-[9px] font-black text-slate-300 uppercase mt-2">Tomar Fotografía</p>
                         </>
                       )}
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observaciones</Label>
                    <Input 
                      className="h-10 bg-white rounded-xl text-xs" 
                      placeholder="Ej: Portón azul, entrega en guardia..." 
                      value={podForm.notes}
                      onChange={e => setPodForm({...podForm, notes: e.target.value})}
                    />
                 </div>
              </div>
           </div>

           <div className="p-6 bg-white border-t shrink-0">
              <Button 
                className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-2xl shadow-xl disabled:opacity-30" 
                onClick={handleConfirmDelivery} 
                disabled={isUpdating || !isPodFormValid}
              >
                 {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                 CONFIRMAR ENTREGA
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
