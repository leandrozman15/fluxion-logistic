'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
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
  Radio,
  Play,
  Truck as TruckIcon,
  X,
  Fuel,
  Ticket,
  Utensils,
  BedDouble,
  Receipt,
  DollarSign,
  Wallet
} from "lucide-react";
import { Load, ProofOfDelivery, ExpenseCategory } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/SignaturePad";
import { normalizePhone, buildWaMeUrl } from "@/lib/utils/whatsapp";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";
import { getLoad, updateLoad, listLoads } from "@/lib/loads-api";
import { updateTruck } from "@/lib/trucks-api";
import { getTenantProfile } from "@/lib/settings-api";
import { calculateDistance } from "@/lib/utils/tracking-math";
import { createExpense } from "@/lib/expenses-api";
import { enqueueOfflineAction, isLikelyOfflineError } from "@/lib/offline-queue";

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

const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string; icon: typeof Fuel }[] = [
  { id: 'fuel', label: 'Combustible', icon: Fuel },
  { id: 'toll', label: 'Peaje', icon: Ticket },
  { id: 'meal', label: 'Comida', icon: Utensils },
  { id: 'lodging', label: 'Hospedaje', icon: BedDouble },
  { id: 'other', label: 'Otro', icon: Receipt },
];

export default function RouteDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [emergencyTypeInProgress, setEmergencyTypeInProgress] = useState<string | null>(null);
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [isFailedOpen, setIsFailedOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'fuel' as ExpenseCategory,
    amount: '',
    liters: '',
    pricePerLiter: '',
    description: '',
    location: '',
    receiptNumber: '',
  });
  const [gpsStatus, setGpsStatus] = useState<'off' | 'requesting' | 'active' | 'error'>('off');
  const [load, setLoad] = useState<Load | null>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [loadLoading, setLoadLoading] = useState(true);
  
  const photoInputRef = useRef<HTMLInputElement>(null);
  const watchIdRef = useRef<number | null>(null);
  // El closure de watchPosition se crea una sola vez por viaje: sin esta ref, cada
  // posición nueva se calculaba siempre contra el "load" congelado del momento en que
  // arrancó el GPS, en vez de contra la última posición real (rompiendo el km acumulado
  // y el historial de la ruta).
  const loadRef = useRef<Load | null>(null);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  // Ref para leer siempre el último valor configurado sin reiniciar el watchPosition.
  const tenantRef = useRef<any>(null);
  useEffect(() => {
    tenantRef.current = tenant;
  }, [tenant]);
  // Marca de tiempo del último envío real al backend, para respetar gpsIntervalSeconds.
  const lastGpsSyncRef = useRef<number>(0);

  const [podForm, setPodForm] = useState<Partial<ProofOfDelivery>>({
    receiverName: "",
    receiverSignatureUrl: "",
    driverSignatureUrl: "",
    photoUrl: "",
    notes: "",
    status: 'delivered'
  });

  useEffect(() => {
    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function loadData() {
      if (!tenantId || !id) {
        if (active) {
          setLoad(null);
          setTenant(null);
          setLoadLoading(false);
        }
        return;
      }

      try {
        if (active) setLoadLoading(true);
        const [loadData, tenantData] = await Promise.all([getLoad(id as string), getTenantProfile()]);
        if (!active) return;
        setLoad(loadData);
        setTenant(tenantData);
      } catch {
        if (!active) return;
        setLoad(null);
        setTenant(null);
      } finally {
        if (active) setLoadLoading(false);
      }
    }

    loadData();

    intervalId = setInterval(() => {
      if (!id) return;
      getLoad(id as string)
        .then((loadData) => {
          if (!active) return;
          setLoad(loadData);
        })
        .catch(() => {
          // Keep current state if background refresh fails.
        });
    }, 15000);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [tenantId, id]);

  useEffect(() => {
    if (!load || load.status !== 'on_route' || !tenantId) {
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
        // Respeta el intervalo configurado en Ajustes (gpsIntervalSeconds, default 30s):
        // el navegador puede disparar 'success' con mucha más frecuencia que la deseada.
        const intervalMs = (tenantRef.current?.settings?.gpsIntervalSeconds || 30) * 1000;
        const now = Date.now();
        if (now - lastGpsSyncRef.current < intervalMs) return;
        lastGpsSyncRef.current = now;

        const { latitude, longitude, speed } = pos.coords;
        const currentSpeed = speed ? Math.round(speed * 3.6) : 0;
        // Usa siempre la última versión conocida del viaje (no la congelada al montar
        // el efecto), para que el km acumulado y el historial reflejen el recorrido real.
        const current = loadRef.current;
        if (!current) return;

        try {
          const prevLat = current.tracking?.currentLat;
          const prevLng = current.tracking?.currentLng;
          // Ignora saltos GPS mínimos (ruido en parada) para no inflar el total con jitter.
          const segmentKm = (typeof prevLat === 'number' && typeof prevLng === 'number')
            ? calculateDistance(prevLat, prevLng, latitude, longitude)
            : 0;
          const distanceTraveledKm = (current.tracking?.distanceTraveledKm || 0) + (segmentKm > 0.02 ? segmentKm : 0);
          const maxSpeed = Math.max(current.tracking?.maxSpeed || 0, currentSpeed);

          const outboundDone = current.outboundStops.every(s => !!s.deliveredAt || !!s.failedAt);
          // No filtramos por isRoundTrip/returnStops acá: el regreso "vacío" a base (sin
          // paradas configuradas) también setea returnStartedAt y debe seguir acumulando km.
          const inReturnPhase = outboundDone && !!current.tracking?.returnStartedAt;
          const activeStop = inReturnPhase
            ? (current.returnStops || []).find(s => !s.deliveredAt && !s.failedAt)
            : current.outboundStops.find(s => !s.deliveredAt && !s.failedAt);
          const fallbackTarget = inReturnPhase ? (current.returnDestination || (current.isRoundTrip ? current.origin : null)) : current.destination;
          const target = activeStop || fallbackTarget;
          const distanceRemainingKm = (target?.lat && target?.lng)
            ? calculateDistance(latitude, longitude, target.lat, target.lng)
            : (current.tracking?.distanceRemainingKm || 0);

          const tracking = {
            ...(current.tracking || {}),
            currentLat: latitude,
            currentLng: longitude,
            currentSpeed,
            maxSpeed,
            distanceTraveledKm: Number(distanceTraveledKm.toFixed(2)),
            distanceRemainingKm: Number(distanceRemainingKm.toFixed(2)),
            lastUpdateAt: new Date().toISOString(),
            history: [
              ...((current.tracking as any)?.history || []),
              {
              lat: latitude,
              lng: longitude,
              speed: currentSpeed,
              timestamp: new Date().toISOString()
              },
            ],
          };

          // Actualiza el estado local antes de la red: así el próximo ping calcula la
          // distancia desde acá, sin perder el recorrido aunque falle la sincronización.
          const occurredAt = new Date().toISOString();
          setLoad((prev) => (prev ? ({ ...prev, tracking, updatedAt: occurredAt } as Load) : prev));

          const truckLocationPatch = current.assignedTruckId
            ? { ...(current as any).location, lat: latitude, lng: longitude, city: "En Tránsito" }
            : undefined;

          try {
            const updatedLoad = await updateLoad(current.id, { tracking, updatedAt: occurredAt } as any);
            setLoad(updatedLoad);

            if (current.assignedTruckId && truckLocationPatch) {
              await updateTruck(current.assignedTruckId, { location: truckLocationPatch as any, updatedAt: occurredAt });
            }
          } catch (e) {
            if (isLikelyOfflineError(e)) {
              // Solo se guarda la posición MÁS RECIENTE pendiente (mismo id) para no acumular
              // pings viejos: al volver la señal se sincroniza únicamente la última posición real.
              await enqueueOfflineAction({
                id: `gps_ping-${current.id}`,
                type: 'gps_ping',
                description: 'Posición GPS',
                payload: { loadId: current.id, assignedTruckId: current.assignedTruckId, tracking, truckLocationPatch, occurredAt },
              });
            } else {
              console.error("GPS Sync Error:", e);
            }
          }
        } catch (e) {
          console.error("GPS Sync Error:", e);
        }
      };

      const error = (err: GeolocationPositionError) => {
        console.error("Geolocation Error:", err);
        setGpsStatus('error');
      };

      watchIdRef.current = navigator.geolocation.watchPosition(success, error, options);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [load?.status, tenantId]);

  const outboundDone = useMemo(() => {
    if (!load?.outboundStops) return false;
    return load.outboundStops.every(s => !!s.deliveredAt || !!s.failedAt);
  }, [load?.outboundStops]);

  const needsReturn = !!load && (load.isRoundTrip || (load.returnStops?.length || 0) > 0);

  // Si el viaje no tiene regreso configurado, se busca (apenas se conoce el viaje, sin
  // esperar a que termine la ida) si el chofer tiene otro viaje en cola (mismo
  // assignedDriverId, todavía no finalizado). Sin próximo viaje, al terminar la ida se le
  // pide volver a base y ese tramo se contabiliza como km muerto (sin carga, sin ganancia).
  const [nextTripCheck, setNextTripCheck] = useState<'idle' | 'checking' | 'has_next' | 'none'>('idle');

  useEffect(() => {
    let active = true;
    if (!load || needsReturn) {
      setNextTripCheck('idle');
      return;
    }
    setNextTripCheck('checking');
    listLoads()
      .then((all) => {
        if (!active) return;
        const hasNext = all.some(l =>
          l.id !== load.id &&
          l.assignedDriverId === load.assignedDriverId &&
          ['pending', 'assigned', 'on_route'].includes(l.status)
        );
        setNextTripCheck(hasNext ? 'has_next' : 'none');
      })
      .catch(() => {
        if (!active) return;
        // Ante la duda (fallo de red) no forzamos el regreso vacío: se comporta como antes.
        setNextTripCheck('has_next');
      });
    return () => { active = false; };
  }, [load?.id, load?.assignedDriverId, needsReturn]);

  const isEmptyReturn = nextTripCheck === 'none';
  const needsReturnEffective = needsReturn || isEmptyReturn;
  const returnStarted = !!load?.tracking?.returnStartedAt;

  const returnStopsDone = useMemo(() => {
    return (load?.returnStops || []).every(s => !!s.deliveredAt || !!s.failedAt);
  }, [load?.returnStops]);

  const returnArrived = !!load?.tracking?.returnArrivedAt;

  // Mientras no haya regreso configurado, hay que resolver si el chofer tiene otro viaje
  // en cola antes de decidir si el viaje se cierra solo o pide volver a base sin carga.
  const resolvingNextTrip = outboundDone && !needsReturn && nextTripCheck !== 'has_next' && nextTripCheck !== 'none';

  // Fases del viaje: entregas de ida -> (si aplica) inicio de regreso -> entregas de regreso -> llegada a base.
  const phase: 'outbound' | 'checking_next' | 'awaiting_return_start' | 'return' | 'awaiting_return_arrival' | 'finished' = !load
    ? 'outbound'
    : !outboundDone
    ? 'outbound'
    : resolvingNextTrip
    ? 'checking_next'
    : !needsReturnEffective
    ? 'finished'
    : !returnStarted
    ? 'awaiting_return_start'
    : !returnStopsDone
    ? 'return'
    : !returnArrived
    ? 'awaiting_return_arrival'
    : 'finished';

  const activeStopsField: 'outboundStops' | 'returnStops' = phase === 'return' ? 'returnStops' : 'outboundStops';

  const currentStop = useMemo(() => {
    if (!load) return null;
    if (phase === 'return') return (load.returnStops || []).find(s => !s.deliveredAt && !s.failedAt) || null;
    if (phase === 'outbound') return load.outboundStops.find(s => !s.deliveredAt && !s.failedAt) || null;
    return null;
  }, [load, phase]);

  // Posición secuencial del destino actual dentro de la hoja de ruta (1 de N), para que
  // el chofer vea claramente "destino 1, destino 2..." a medida que avanza.
  const stopIndex = useMemo(() => {
    if (!load || !currentStop) return { current: 0, total: 0 };
    const list = (activeStopsField === 'returnStops' ? load.returnStops : load.outboundStops) || [];
    const idx = list.findIndex(s => s === currentStop);
    return { current: idx >= 0 ? idx + 1 : 0, total: list.length };
  }, [load, currentStop, activeStopsField]);

  const handleStartTrip = async () => {
    if (!load || !tenantId) return;
    setIsUpdating(true);
    setGpsStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const occurredAt = new Date().toISOString();
        const tracking = {
          ...(load.tracking || {}),
          tripStartedAt: occurredAt,
          currentLat: pos.coords.latitude,
          currentLng: pos.coords.longitude,
        };
        const truckLocationPatch = load.assignedTruckId
          ? { ...(load as any).location, lat: pos.coords.latitude, lng: pos.coords.longitude }
          : undefined;

        try {
          const updatedLoad = await updateLoad(load.id, {
            status: 'on_route',
            tracking,
            updatedAt: occurredAt,
          } as any);
          setLoad(updatedLoad);

          if (load.assignedTruckId && truckLocationPatch) {
            await updateTruck(load.assignedTruckId, {
              status: 'in_trip',
              location: truckLocationPatch as any,
              updatedAt: occurredAt,
            });
          }

          setGpsStatus('active');
          toast({ title: "Jornada Iniciada", description: "GPS transmitiendo en vivo." });
        } catch (e) {
          if (isLikelyOfflineError(e)) {
            await enqueueOfflineAction({
              type: 'start_trip',
              description: 'Inicio de jornada',
              payload: { loadId: load.id, assignedTruckId: load.assignedTruckId, tracking, truckLocationPatch, occurredAt },
            });
            setLoad((prev) => (prev ? ({ ...prev, status: 'on_route', tracking, updatedAt: occurredAt } as Load) : prev));
            setGpsStatus('active');
            toast({ title: "Trabajando sin conexión", description: "La jornada se inició en el dispositivo y se sincronizará al recuperar señal." });
          } else {
            toast({ variant: "destructive", title: "Error" });
          }
        } finally {
          setIsUpdating(false);
        }
      },
      (err) => {
        setIsUpdating(false);
        setGpsStatus('error');
        toast({ variant: "destructive", title: "GPS Requerido" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAction = (type: 'nav' | 'call') => {
    if (!currentStop) return;
    if (type === 'nav') {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}`, '_blank');
    } else {
      window.open(`tel:${currentStop.phone}`, '_self');
    }
  };

  const handleContactCentral = (type: 'call' | 'whatsapp') => {
    const centralPhone = tenant?.settings?.centralPhone;
    if (!centralPhone) return;
    const normalized = normalizePhone(centralPhone);
    if (type === 'call') window.open(`tel:${normalized}`, '_self');
    else window.open(buildWaMeUrl(normalized!, `Hola Central, soy el chofer del viaje ${load?.orderNumber}.`), '_blank');
  };

  const handleStartReturn = async () => {
    if (!load || !tenantId) return;
    setIsUpdating(true);
    const occurredAt = new Date().toISOString();
    const tracking = {
      ...(load.tracking || {}),
      returnStartedAt: occurredAt,
      outboundDistanceKm: load.tracking?.distanceTraveledKm || 0,
      // Marca el regreso como "vacío" (sin carga) cuando no hay más viajes en cola: ese
      // tramo no genera ganancia y se contabiliza como km muerto en Analíticas.
      isEmptyReturn,
    };
    try {
      const updatedLoad = await updateLoad(load.id, {
        tracking,
        updatedAt: occurredAt,
      } as any);
      setLoad(updatedLoad);
      toast({ title: isEmptyReturn ? "Regreso a Base Iniciado" : "Regreso Iniciado", description: "El GPS sigue transmitiendo, ahora contabilizando km de regreso." });
    } catch (e) {
      if (isLikelyOfflineError(e)) {
        await enqueueOfflineAction({
          type: 'start_return',
          description: 'Inicio de regreso',
          payload: { loadId: load.id, tracking, occurredAt },
        });
        setLoad((prev) => (prev ? ({ ...prev, tracking, updatedAt: occurredAt } as Load) : prev));
        toast({ title: "Trabajando sin conexión", description: "El regreso se inició en el dispositivo y se sincronizará al recuperar señal." });
      } else {
        toast({ variant: "destructive", title: "Error" });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmReturnArrival = async () => {
    if (!load || !tenantId) return;
    setIsUpdating(true);
    const occurredAt = new Date().toISOString();
    const tracking = {
      ...(load.tracking || {}),
      returnArrivedAt: occurredAt,
    };
    try {
      const updatedLoad = await updateLoad(load.id, {
        status: 'delivered',
        tracking,
        updatedAt: occurredAt,
      } as any);
      setLoad(updatedLoad);

      if (load.assignedTruckId) {
        await updateTruck(load.assignedTruckId, {
          status: 'available',
          updatedAt: occurredAt,
        });
      }

      toast({ title: "Regreso Completado", description: "Jornada finalizada." });
    } catch (e) {
      if (isLikelyOfflineError(e)) {
        await enqueueOfflineAction({
          type: 'confirm_return_arrival',
          description: 'Llegada de regreso',
          payload: { loadId: load.id, tracking, assignedTruckId: load.assignedTruckId, occurredAt },
        });
        setLoad((prev) => (prev ? ({ ...prev, status: 'delivered', tracking, updatedAt: occurredAt } as Load) : prev));
        toast({ title: "Trabajando sin conexión", description: "La llegada se registró en el dispositivo y se sincronizará al recuperar señal." });
      } else {
        toast({ variant: "destructive", title: "Error" });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Red de seguridad: si al confirmar la última entrega todavía no sabíamos si había un
  // próximo viaje (nextTripCheck no había resuelto), la jornada queda marcada con las
  // paradas completas pero sin cerrar. Apenas se resuelve que SÍ hay próximo viaje, se
  // cierra automáticamente acá (si resuelve que NO hay, el chofer ve el botón de volver
  // a base y el cierre lo hace handleConfirmReturnArrival).
  useEffect(() => {
    if (!load || !tenantId) return;
    if (outboundDone && !needsReturn && nextTripCheck === 'has_next' && load.status !== 'delivered') {
      const occurredAt = new Date().toISOString();
      updateLoad(load.id, { status: 'delivered', updatedAt: occurredAt } as any)
        .then((updatedLoad) => {
          setLoad(updatedLoad);
          if (load.assignedTruckId) {
            updateTruck(load.assignedTruckId, { status: 'available', updatedAt: occurredAt }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [load?.id, load?.status, outboundDone, needsReturn, nextTripCheck, tenantId]);

  const handleConfirmDelivery = async () => {
    if (!load || !currentStop || !tenantId) return;
    setIsUpdating(true);

    const storagePrefix = `tenants/${tenantId}/loads/${load.id}/pod/${currentStop.id}`;
    const receiverName = podForm.receiverName!;
    const notes = podForm.notes || "";
    const receiverSignatureDataUrl = podForm.receiverSignatureUrl || "";
    const driverSignatureDataUrl = podForm.driverSignatureUrl || "";
    const photoDataUrl = podForm.photoUrl || "";
    const occurredAt = new Date().toISOString();

    const currentStops = (load[activeStopsField] || []) as typeof load.outboundStops;
    const allFinished = currentStops.every(s => s.id === currentStop.id || !!s.deliveredAt || !!s.failedAt);
    const closesTrip = phase === 'outbound' && allFinished && !needsReturn && nextTripCheck === 'has_next';

    try {
      // 1. Procesar y Subir Imágenes a Storage para evitar límites de Firestore Document
      let receiverSigUrl = receiverSignatureDataUrl;
      if (receiverSigUrl.startsWith('data:image')) {
        receiverSigUrl = await uploadBase64(`${storagePrefix}/receiver_sig.png`, receiverSigUrl);
      }

      let driverSigUrl = driverSignatureDataUrl;
      if (driverSigUrl.startsWith('data:image')) {
        driverSigUrl = await uploadBase64(`${storagePrefix}/driver_sig.png`, driverSigUrl);
      }

      let photoUrl = photoDataUrl;
      if (photoUrl.startsWith('data:image')) {
        const compressed = await compressImage(photoUrl, 1024, 768, 0.6);
        photoUrl = await uploadBase64(`${storagePrefix}/delivery_photo.jpg`, compressed);
      }

      const finalPod: ProofOfDelivery = {
        status: 'delivered',
        receiverName,
        receiverSignatureUrl: receiverSigUrl,
        driverSignatureUrl: driverSigUrl,
        photoUrl: photoUrl,
        notes,
        confirmedAt: occurredAt
      };

      const updatedStops = currentStops.map(s => 
        s.id === currentStop.id ? { ...s, deliveredAt: occurredAt, proofOfDelivery: finalPod } : s
      );

      const updatedLoad = await updateLoad(load.id, {
        [activeStopsField]: updatedStops,
        status: closesTrip ? 'delivered' : load.status,
        updatedAt: occurredAt,
      } as any);
      setLoad(updatedLoad);

      if (closesTrip && load.assignedTruckId) {
        await updateTruck(load.assignedTruckId, {
          status: 'available',
          updatedAt: occurredAt,
        });
      }

      toast({ title: "Entrega Exitosa" });
      setIsPodOpen(false);
      setPodForm({ receiverName: "", receiverSignatureUrl: "", driverSignatureUrl: "", photoUrl: "", notes: "", status: 'delivered' });
    } catch (e: any) {
      if (isLikelyOfflineError(e)) {
        // Guarda la entrega con las firmas/foto en base64 (se re-suben recién al sincronizar),
        // y avanza localmente como si hubiera funcionado, para no frenarle el viaje al chofer.
        const localPod: ProofOfDelivery = {
          status: 'delivered',
          receiverName,
          receiverSignatureUrl: receiverSignatureDataUrl,
          driverSignatureUrl: driverSignatureDataUrl,
          photoUrl: photoDataUrl,
          notes,
          confirmedAt: occurredAt,
        };
        const updatedStops = currentStops.map(s =>
          s.id === currentStop.id ? { ...s, deliveredAt: occurredAt, proofOfDelivery: localPod } : s
        );
        await enqueueOfflineAction({
          type: 'confirm_delivery',
          description: `Entrega ${currentStop.address || currentStop.id}`,
          payload: {
            loadId: load.id,
            activeStopsField,
            updatedStops,
            stopId: currentStop.id,
            nextStatus: closesTrip ? 'delivered' : undefined,
            assignedTruckId: load.assignedTruckId,
            receiverName,
            notes,
            receiverSignatureDataUrl,
            driverSignatureDataUrl,
            photoDataUrl,
            storagePrefix,
            occurredAt,
          },
        });
        setLoad((prev) => (prev ? ({ ...prev, [activeStopsField]: updatedStops, status: closesTrip ? 'delivered' : prev.status, updatedAt: occurredAt } as Load) : prev));
        toast({ title: "Trabajando sin conexión", description: "La entrega se guardó en el dispositivo y se sincronizará automáticamente al recuperar señal." });
        setIsPodOpen(false);
        setPodForm({ receiverName: "", receiverSignatureUrl: "", driverSignatureUrl: "", photoUrl: "", notes: "", status: 'delivered' });
      } else {
        console.error(e);
        toast({ variant: "destructive", title: "Error al guardar", description: "Verifique su conexión e intente nuevamente." });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReportFailure = async (reason: any) => {
    if (!load || !currentStop || !tenantId) return;
    setIsUpdating(true);
    const occurredAt = new Date().toISOString();
    const currentStops = (load[activeStopsField] || []) as typeof load.outboundStops;
    const updatedStops = currentStops.map(s => 
      s.id === currentStop.id ? { 
        ...s, 
        failedAt: occurredAt,
        proofOfDelivery: { status: 'failed' as const, failedReason: reason, confirmedAt: occurredAt, receiverName: "FALLIDO", receiverSignatureUrl: "" }
      } : s
    );

    const allFinished = updatedStops.every(s => !!s.deliveredAt || !!s.failedAt);
    const closesTrip = phase === 'outbound' && allFinished && !needsReturn && nextTripCheck === 'has_next';

    try {
      const updatedLoad = await updateLoad(load.id, {
        [activeStopsField]: updatedStops,
        status: closesTrip ? 'delivered' : load.status,
        updatedAt: occurredAt,
      } as any);
      setLoad(updatedLoad);

      if (closesTrip && load.assignedTruckId) {
        await updateTruck(load.assignedTruckId, {
          status: 'available',
          updatedAt: occurredAt,
        });
      }

      toast({ title: "Incidente Registrado" });
      setIsFailedOpen(false);
    } catch (e) {
      if (isLikelyOfflineError(e)) {
        await enqueueOfflineAction({
          type: 'report_failure',
          description: `Incidente ${currentStop.address || currentStop.id}`,
          payload: {
            loadId: load.id,
            activeStopsField,
            updatedStops,
            nextStatus: closesTrip ? 'delivered' : undefined,
            assignedTruckId: load.assignedTruckId,
            occurredAt,
          },
        });
        setLoad((prev) => (prev ? ({ ...prev, [activeStopsField]: updatedStops, status: closesTrip ? 'delivered' : prev.status, updatedAt: occurredAt } as Load) : prev));
        toast({ title: "Trabajando sin conexión", description: "El incidente se guardó en el dispositivo y se sincronizará al recuperar señal." });
        setIsFailedOpen(false);
      } else {
        toast({ variant: "destructive", title: "Error" });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTriggerEmergency = async (type: string, label: string) => {
    if (!tenantId || !load?.assignedTruckId || !load) return;
    setIsUpdating(true);
    setEmergencyTypeInProgress(type);
    toast({ variant: "destructive", title: "Enviando alerta...", description: "Notificando a la central, un momento." });
    const occurredAt = new Date().toISOString();
    const alerts = [
      ...((load.tracking as any)?.alerts || []),
      { type: 'critical', message: `S.O.S: ${label}`, timestamp: occurredAt },
    ];
    try {
      // Ambas escrituras son independientes entre sí: corren en paralelo para no duplicar el tiempo de espera.
      const [, updatedLoad] = await Promise.all([
        updateTruck(load.assignedTruckId, {
          hasActiveAlert: true,
          alertType: type as any,
          updatedAt: occurredAt,
        }),
        updateLoad(load.id, {
          status: 'incident',
          tracking: {
            ...(load.tracking || {}),
            alerts,
          },
          updatedAt: occurredAt,
        } as any),
      ]);
      setLoad(updatedLoad);
      toast({ variant: "destructive", title: "ALERTA ENVIADA" });
      setIsEmergencyOpen(false);
    } catch (e) {
      if (isLikelyOfflineError(e)) {
        await enqueueOfflineAction({
          type: 'emergency',
          description: `SOS: ${label}`,
          payload: { loadId: load.id, assignedTruckId: load.assignedTruckId, emergencyType: type, alerts, occurredAt },
        });
        setLoad((prev) => (prev ? ({ ...prev, status: 'incident', tracking: { ...(prev.tracking || {}), alerts }, updatedAt: occurredAt } as Load) : prev));
        toast({ title: "Trabajando sin conexión", description: "La alerta se guardó en el dispositivo y se enviará a la central apenas vuelva la señal." });
        setIsEmergencyOpen(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la alerta, reintentá." });
      }
    } finally {
      setIsUpdating(false);
      setEmergencyTypeInProgress(null);
    }
  };

  const openExpenseDialog = (category: ExpenseCategory) => {
    setExpenseForm({ category, amount: '', liters: '', pricePerLiter: '', description: '', location: '', receiptNumber: '' });
    setIsExpenseOpen(true);
  };

  // Combustible: recalcula el monto total automáticamente a partir de litros x precio,
  // pero el chofer puede seguir editando el monto a mano si lo necesita.
  const handleFuelQuantityChange = (field: 'liters' | 'pricePerLiter', value: string) => {
    setExpenseForm((f) => {
      const next = { ...f, [field]: value };
      const liters = parseFloat(field === 'liters' ? value : f.liters);
      const price = parseFloat(field === 'pricePerLiter' ? value : f.pricePerLiter);
      if (liters > 0 && price > 0) {
        next.amount = (liters * price).toFixed(2);
      }
      return next;
    });
  };

  const handleRegisterExpense = async () => {
    if (!load || !tenantId) return;
    const amountNum = parseFloat(expenseForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast({ variant: "destructive", title: "Ingresá un monto válido" });
      return;
    }

    setIsSubmittingExpense(true);
    const expensePayload = {
      loadId: load.id,
      truckId: load.assignedTruckId || undefined,
      driverId: load.assignedDriverId || undefined,
      category: expenseForm.category,
      amount: amountNum,
      description: expenseForm.description || EXPENSE_CATEGORIES.find((c) => c.id === expenseForm.category)?.label || 'Gasto de viaje',
      location: expenseForm.location || undefined,
      receiptNumber: expenseForm.receiptNumber || undefined,
      liters: expenseForm.category === 'fuel' && expenseForm.liters ? parseFloat(expenseForm.liters) : undefined,
      pricePerLiter: expenseForm.category === 'fuel' && expenseForm.pricePerLiter ? parseFloat(expenseForm.pricePerLiter) : undefined,
    };
    try {
      await createExpense(expensePayload as any);
      toast({ title: "Gasto registrado", description: "Queda pendiente de auditoría por la central." });
      setIsExpenseOpen(false);
    } catch (e) {
      if (isLikelyOfflineError(e)) {
        await enqueueOfflineAction({
          type: 'expense',
          description: `Gasto: ${expensePayload.description}`,
          payload: expensePayload,
        });
        toast({ title: "Trabajando sin conexión", description: "El gasto se guardó en el dispositivo y se sincronizará al recuperar señal." });
        setIsExpenseOpen(false);
      } else {
        toast({ variant: "destructive", title: "Error al registrar el gasto" });
      }
    } finally {
      setIsSubmittingExpense(false);
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
        <div>
           {gpsStatus === 'active' ? (
             <Badge className="bg-green-600 text-white border-none text-[8px] h-5 animate-pulse"><Radio size={10} className="mr-1" /> GPS VIVO</Badge>
           ) : <Badge variant="outline" className="text-[8px] h-5">GPS {gpsStatus.toUpperCase()}</Badge>}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registrar Gastos</p>
        <div className="grid grid-cols-5 gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openExpenseDialog(c.id)}
              className="p-2.5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm flex flex-col items-center gap-1 active:scale-95 transition-all"
            >
              <c.icon size={18} className="text-blue-600" />
              <span className="text-[7px] font-black uppercase text-slate-500 leading-tight text-center">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {load.status === 'assigned' || load.status === 'pending' ? (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 text-white p-8 text-center">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><TruckIcon size={32} /></div>
             <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Preparado para Salida</CardTitle>
          </CardHeader>
          <CardFooter className="p-8"><Button className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl rounded-3xl" onClick={handleStartTrip} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />} INICIAR JORNADA</Button></CardFooter>
        </Card>
      ) : currentStop ? (
        <div className="space-y-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
            <CardContent className="p-8 space-y-6">
               <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">
                      {phase === 'return' ? 'Entrega en Regreso' : 'Siguiente Entrega'}
                      {stopIndex.total > 0 && ` · Destino ${stopIndex.current} de ${stopIndex.total}`}
                    </p>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-tight">{currentStop.name}</h2>
                  </div>
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400"><MapPin size={24} /></div>
               </div>
               <div className="p-5 bg-white/5 rounded-3xl border border-white/10"><p className="text-sm font-bold leading-tight">{currentStop.address}</p></div>
               <div className="grid grid-cols-2 gap-3">
                  <Button className="h-14 bg-blue-600 rounded-2xl font-black text-xs uppercase" onClick={() => handleAction('nav')}>NAVEGAR</Button>
                  <Button variant="outline" className="h-14 text-white rounded-2xl font-black text-xs uppercase" onClick={() => handleAction('call')}>LLAMAR</Button>
               </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
             <Button className="h-20 bg-green-600 text-white font-black text-lg rounded-3xl shadow-xl flex flex-col items-center justify-center" onClick={() => setIsPodOpen(true)}><CheckCircle size={28} /><span className="text-[10px] uppercase">Entregado</span></Button>
             <Button className="h-20 bg-red-600 text-white font-black text-lg rounded-3xl shadow-xl flex flex-col items-center justify-center" onClick={() => setIsFailedOpen(true)}><XCircle size={28} /><span className="text-[10px] uppercase">No Entregado</span></Button>
          </div>

          <Button variant="destructive" className="w-full h-16 rounded-2xl font-black text-lg animate-pulse" onClick={() => setIsEmergencyOpen(true)}>S.O.S / EMERGENCIA</Button>
        </div>
      ) : phase === 'checking_next' ? (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 text-white p-8 text-center">
             <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><Loader2 size={32} className="animate-spin" /></div>
             <CardTitle className="text-xl font-black uppercase italic tracking-tighter">Entregas de Ida Completas</CardTitle>
             <CardDescription className="text-white/80 font-bold">Verificando próximos viajes asignados...</CardDescription>
          </CardHeader>
        </Card>
      ) : phase === 'awaiting_return_start' ? (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-orange-500 text-white p-8 text-center">
             <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><TruckIcon size={32} /></div>
             <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{isEmptyReturn ? 'Sin Más Viajes Asignados' : 'Entregas de Ida Completas'}</CardTitle>
             <CardDescription className="text-white/80 font-bold">
               {isEmptyReturn ? 'No tenés otro viaje en cola. Volvé a base: esos km se registran como km muerto (sin carga).' : 'Iniciá el regreso a base para seguir contabilizando los km.'}
             </CardDescription>
          </CardHeader>
          <CardFooter className="p-8"><Button className="w-full h-20 bg-orange-500 hover:bg-orange-600 text-white font-black text-xl rounded-3xl" onClick={handleStartReturn} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />} {isEmptyReturn ? 'VOLVER A BASE' : 'INICIAR REGRESO'}</Button></CardFooter>
        </Card>
      ) : phase === 'awaiting_return_arrival' ? (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 text-white p-8 text-center">
             <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><MapPin size={32} /></div>
             <CardTitle className="text-xl font-black uppercase italic tracking-tighter">En Camino a Base</CardTitle>
             <CardDescription className="text-white/80 font-bold">
               {isEmptyReturn ? 'Confirmá tu llegada para cerrar la jornada. Este tramo se contabiliza como km muerto (sin carga).' : 'Confirmá tu llegada para cerrar la jornada y los km de regreso.'}
             </CardDescription>
          </CardHeader>
          <CardFooter className="p-8"><Button className="w-full h-20 bg-green-600 hover:bg-green-700 text-white font-black text-xl rounded-3xl" onClick={handleConfirmReturnArrival} disabled={isUpdating}>{isUpdating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} CONFIRMAR LLEGADA A BASE</Button></CardFooter>
        </Card>
      ) : (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
           <CheckCircle2 size={64} className="text-green-600" />
           <h3 className="text-xl font-black uppercase">Hoja de Ruta Completa</h3>
           <Button className="bg-slate-900 text-white h-14 px-10 rounded-2xl font-black" onClick={() => router.push('/rutas')}>VOLVER</Button>
        </div>
      )}

      {/* DIALOG ENTREGADO (POD) */}
      <Dialog open={isPodOpen} onOpenChange={setIsPodOpen}>
        <DialogContent className="max-w-[100vw] h-[100dvh] rounded-none p-0 overflow-hidden border-none shadow-2xl flex flex-col">
           <div className="bg-green-600 text-white p-6 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-black uppercase italic">Certificar Entrega</h2>
              <Button variant="ghost" onClick={() => setIsPodOpen(false)}><X /></Button>
           </div>
           
           <div className="flex-1 p-6 space-y-6 bg-slate-50 overflow-y-auto">
              <div className="space-y-4">
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Nombre de quien recibe</Label><Input className="h-12 bg-white rounded-xl font-bold" value={podForm.receiverName} onChange={e => setPodForm({...podForm, receiverName: e.target.value})} /></div>
                 <SignaturePad title="Firma del Receptor" onSave={(url) => setPodForm({...podForm, receiverSignatureUrl: url})} defaultValue={podForm.receiverSignatureUrl} />
                 <SignaturePad title="Firma del Chofer" onSave={(url) => setPodForm({...podForm, driverSignatureUrl: url})} defaultValue={podForm.driverSignatureUrl} />
                 
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Evidencia Fotográfica</Label>
                    <input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onload = async (ev) => setPodForm({...podForm, photoUrl: ev.target?.result as string});
                         reader.readAsDataURL(file);
                       }
                    }} />
                    <div className="aspect-video bg-white rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden" onClick={() => photoInputRef.current?.click()}>
                       {podForm.photoUrl ? <img src={podForm.photoUrl} className="w-full h-full object-cover" /> : <Camera size={32} className="text-slate-200" />}
                    </div>
                 </div>
              </div>
           </div>

           <div className="p-6 bg-white border-t shrink-0">
              <Button className="w-full h-16 bg-green-600 text-white font-black text-lg rounded-2xl" onClick={handleConfirmDelivery} disabled={isUpdating || !isPodFormValid}>
                 {isUpdating ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} CONFIRMAR ENTREGA
              </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* OTROS DIALOGS SIMPLIFICADOS PARA BREVEDAD */}
      <Dialog open={isEmergencyOpen} onOpenChange={setIsEmergencyOpen}>
        <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-6">
           <DialogHeader><DialogTitle className="text-red-700 uppercase">Protocolo SOS</DialogTitle></DialogHeader>
           <div className="flex flex-col gap-3 py-4">
              {EMERGENCY_TYPES.map(e => (
                <Button key={e.id} className={cn("h-16 justify-start px-6 rounded-2xl text-white", e.color)} onClick={() => handleTriggerEmergency(e.id, e.label)} disabled={isUpdating}>
                  {emergencyTypeInProgress === e.id ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                  {emergencyTypeInProgress === e.id ? "ENVIANDO..." : e.label}
                </Button>
              ))}
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFailedOpen} onOpenChange={setIsFailedOpen}>
        <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-6">
           <DialogHeader><DialogTitle className="text-red-600 uppercase">Reportar Fallo</DialogTitle></DialogHeader>
           <div className="grid grid-cols-1 gap-3 py-4">
              {INCIDENT_REASONS.map(r => (
                <Button key={r.id} variant="outline" className="h-14 justify-start px-6 rounded-2xl" onClick={() => handleReportFailure(r.id)} disabled={isUpdating}>{r.label}</Button>
              ))}
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
        <DialogContent className="max-w-[95vw] rounded-[2.5rem] p-6 max-h-[85vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="uppercase italic flex items-center gap-2"><Wallet size={18} className="text-blue-600" /> Registrar Gasto</DialogTitle>
             <DialogDescription>Queda pendiente de auditoría por la central.</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-2">
              <div className="grid grid-cols-5 gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setExpenseForm((f) => ({ ...f, category: c.id }))}
                    className={cn(
                      "p-2.5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all",
                      expenseForm.category === c.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-400 border-slate-100"
                    )}
                  >
                    <c.icon size={18} />
                    <span className="text-[7px] font-black uppercase leading-tight text-center">{c.label}</span>
                  </button>
                ))}
              </div>

              {expenseForm.category === 'fuel' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Litros</Label>
                    <Input type="number" className="h-12 rounded-xl" value={expenseForm.liters} onChange={(e) => handleFuelQuantityChange('liters', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Precio x Litro</Label>
                    <Input type="number" className="h-12 rounded-xl" value={expenseForm.pricePerLiter} onChange={(e) => handleFuelQuantityChange('pricePerLiter', e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Monto Total</Label>
                <Input type="number" className="h-12 rounded-xl font-black" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Descripción</Label>
                <Input className="h-12 rounded-xl" placeholder="Ej: YPF Ruta 9 km 300" value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Lugar</Label>
                  <Input className="h-12 rounded-xl" value={expenseForm.location} onChange={(e) => setExpenseForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">N° Comprobante</Label>
                  <Input className="h-12 rounded-xl" value={expenseForm.receiptNumber} onChange={(e) => setExpenseForm((f) => ({ ...f, receiptNumber: e.target.value }))} />
                </div>
              </div>
           </div>
           <DialogFooter>
              <Button className="w-full h-14 bg-blue-600 text-white font-black rounded-2xl" onClick={handleRegisterExpense} disabled={isSubmittingExpense || !expenseForm.amount}>
                 {isSubmittingExpense ? <Loader2 className="animate-spin mr-2" /> : <DollarSign className="mr-2" />} GUARDAR GASTO
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

