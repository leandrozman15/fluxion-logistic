'use client';

import { useState, useRef, useMemo, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag, Camera, MapPin, CheckCircle2,
  ArrowLeft, Loader2, AlertTriangle, Navigation, Play, ChevronRight, Crosshair,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseLogisticsLabel, type LabelOutput } from "@/ai/flows/parse-logistics-label-flow";
import { geocodeAddress } from "@/services/google-maps";
import { cn } from "@/lib/utils";
import { format, addHours } from "date-fns";
import { getTenantProfile } from "@/lib/settings-api";
import { createLoad, updateLoad } from "@/lib/loads-api";
import { listDrivers } from "@/lib/drivers-api";
import { sequenceByNearestNeighbor } from "@/lib/utils/tracking-math";

function MercadoLibreScanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preAssignedLoadId = searchParams.get('loadId');

  const [step, setStep] = useState(1);
  const [scannedDestinations, setScannedDestinations] = useState<(LabelOutput & { lat?: number; lng?: number })[]>([]);
  const [currentLabel, setCurrentLabel] = useState<(LabelOutput & { lat?: number; lng?: number }) | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantMapApiKey, setTenantMapApiKey] = useState<string | null>(null);
  const [myDriverId, setMyDriverId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadTenantData() {
      if (!tenantId) return;
      try {
        const tenant = await getTenantProfile();
        if (!active) return;
        setTenantMapApiKey((tenant.settings as any)?.mapApiKey || null);

        const myEmail = user?.email?.toLowerCase().trim();
        if (myEmail) {
          const drivers = await listDrivers();
          if (!active) return;
          const myDriver = drivers.find(d => d.email?.toLowerCase().trim() === myEmail);
          setMyDriverId(myDriver?.id || null);
        }
      } catch {
        if (!active) return;
        setTenantMapApiKey(null);
      }
    }
    loadTenantData();
    return () => {
      active = false;
    };
  }, [tenantId, user?.email]);

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

        let geo = null;
        if (tenantMapApiKey) {
          const fullAddress = `${result.address.street} ${result.address.number}, ${result.address.city}, ${result.address.province}, Argentina`;
          geo = await geocodeAddress(fullAddress, tenantMapApiKey);
        }

        setCurrentLabel({
          ...result,
          lat: geo?.lat,
          lng: geo?.lng,
        });
        setStep(3);
      } catch {
        toast({ variant: "destructive", title: "Lectura fallida", description: "Reintente con mejor iluminacion." });
        setStep(1);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveCurrentLabel = () => {
    if (!currentLabel) return;
    setScannedDestinations((prev) => [...prev, currentLabel]);
    setCurrentLabel(null);
    toast({ title: "Paquete registrado" });
    setTimeout(() => handleOpenScanner(), 300);
    setStep(1);
  };

  const getCurrentPositionAsync = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

  const handleStartReparto = async () => {
    if (!tenantId || scannedDestinations.length === 0) return;
    setIsSubmitting(true);
    try {
      // Ordena las paradas por vecino más cercano partiendo de la posición actual del chofer,
      // en vez de simplemente respetar el orden en que se fueron escaneando las etiquetas.
      const currentPos = await getCurrentPositionAsync();
      const orderedDestinations = currentPos
        ? sequenceByNearestNeighbor(scannedDestinations, currentPos.coords.latitude, currentPos.coords.longitude)
        : scannedDestinations;

      const stops = orderedDestinations.map((d) => ({
        id: Math.random().toString(36).substring(7),
        name: d.recipient.name,
        address: `${d.address.street} ${d.address.number}`,
        city: d.address.city,
        province: d.address.province,
        country: "Argentina" as const,
        lat: d.lat || null,
        lng: d.lng || null,
        weightKg: 1,
        description: `Tracking: ${d.tracking.id} | Barrio: ${d.address.barrio || 'S/D'}`,
        documents: [{
          id: d.tracking.id,
          type: 'remito' as const,
          number: d.tracking.id,
          uploadedAt: new Date().toISOString(),
          leg: 'outbound' as const,
        }],
      }));

      if (preAssignedLoadId) {
        await updateLoad(preAssignedLoadId, {
          outboundStops: stops,
          status: 'on_route',
          updatedAt: new Date().toISOString(),
        } as any);
        toast({ title: "Reparto iniciado", description: `Ruta ordenada por cercanía: ${stops.length} paradas.` });
        router.push(`/rutas/${preAssignedLoadId}`);
      } else {
        const orderNum = `ML-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000)}`;
        const estimatedArrival = addHours(new Date(), 4);
        const created = await createLoad({
          orderNumber: orderNum,
          clientName: "Mercado Libre (Colecta Directa)",
          serviceType: 'meli' as any,
          status: 'on_route',
          assignedDriverId: myDriverId || undefined,
          pickupDate: new Date().toISOString().split('T')[0],
          pickupTime: format(new Date(), "HH:mm"),
          estimatedArrivalDate: format(estimatedArrival, "yyyy-MM-dd"),
          estimatedArrivalTime: format(estimatedArrival, "HH:mm"),
          origin: { name: "Deposito MELI", address: "CABA", city: "Capital Federal", country: "Argentina" } as any,
          outboundStops: stops as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tracking: {
            tripStartedAt: new Date().toISOString(),
            currentLat: currentPos?.coords.latitude ?? -34.6,
            currentLng: currentPos?.coords.longitude ?? -58.3,
            currentSpeed: 0,
            distanceTraveledKm: 0,
            distanceRemainingKm: 20,
            history: [],
            alerts: [],
          } as any,
        } as any);
        router.push(`/rutas/${created.id}`);
      }
    } catch {
      toast({ variant: "destructive", title: "Error al iniciar reparto" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 px-2">
      <div className="flex items-center justify-between pt-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
        <div className="flex items-center gap-2"><ShoppingBag className="text-yellow-500" /><h1 className="font-black text-lg italic uppercase tracking-tighter">Modulo Mercado Libre</h1></div>
        <Badge className="bg-yellow-400 text-slate-900 border-none">{scannedDestinations.length}</Badge>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-slate-900 text-white">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-24 h-24 bg-yellow-400 rounded-[2rem] flex items-center justify-center text-slate-900 mx-auto shadow-2xl"><Camera size={48} /></div>
              <div className="space-y-1"><h2 className="text-2xl font-black italic uppercase tracking-tighter">Escanear Etiquetas</h2><p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Fotografie las etiquetas para cargar la ruta</p></div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={onFileChange} />
              <Button className="w-full h-20 bg-yellow-400 hover:bg-yellow-50 text-slate-900 font-black text-xl rounded-2xl shadow-xl" onClick={handleOpenScanner}>INICIAR CAMARA</Button>
            </CardContent>
          </Card>

          {scannedDestinations.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {scannedDestinations.map((dest, i) => (
                  <div key={i} className="p-4 bg-white rounded-2xl border flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 font-black text-xs">{i + 1}</div><div><p className="text-xs font-black text-slate-800 uppercase leading-none">{dest.recipient.name}</p><p className="text-[9px] text-slate-400 font-medium mt-1 truncate max-w-[150px]">{dest.address.street} {dest.address.number}</p></div></div>
                    {dest.lat ? <CheckCircle2 className="text-green-500" size={16} /> : <AlertTriangle className="text-red-400" size={16} />}
                  </div>
                ))}
              </div>

              <div className="p-6 bg-blue-600 rounded-[2rem] shadow-2xl space-y-4">
                <div className="flex items-center justify-between text-white"><div><p className="text-[10px] font-black uppercase opacity-60">Ruta Optimizada</p><p className="text-xl font-black italic tracking-tighter">{scannedDestinations.length} ENTREGAS</p></div><Navigation size={32} className="opacity-30" /></div>
                <Button className="w-full h-16 bg-white text-blue-600 hover:bg-blue-50 font-black text-lg rounded-2xl shadow-xl" onClick={handleStartReparto} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />}COMENZAR REPARTO</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95">
          <div className="relative"><div className="w-40 h-40 bg-yellow-100 rounded-[3rem] flex items-center justify-center text-yellow-600 animate-pulse"><ShoppingBag size={80} className="fill-current" /></div><div className="absolute inset-0 border-4 border-yellow-400 border-dashed rounded-[3rem] animate-spin duration-[3000ms]"></div></div>
          <div className="space-y-1"><h3 className="text-2xl font-black italic uppercase tracking-tighter">Analizando Paquete</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">IA + GPS: Localizando Destino...</p></div>
        </div>
      )}

      {step === 3 && currentLabel && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="text-center space-y-1">{currentLabel.lat ? <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" /> : <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />}<h3 className="text-2xl font-black italic uppercase text-slate-900 leading-none">{currentLabel.lat ? 'Localizado OK' : 'Direccion Ambigua'}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Revision de Datos Extraidos</p></div>

          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8"><div className="flex justify-between items-start"><div><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Destinatario</p><CardTitle className="text-xl font-black uppercase italic tracking-tighter leading-tight">{currentLabel.recipient.name}</CardTitle></div><Badge className={cn("text-white border-none px-3 font-black text-[10px]", currentLabel.lat ? "bg-green-600" : "bg-amber-500")}>{currentLabel.lat ? 'GPS OK' : 'SIN GPS'}</Badge></div></CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3"><p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><MapPin size={12} /> Direccion de Entrega</p><div className="p-5 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-1"><p className="text-lg font-black text-slate-800 leading-tight">{currentLabel.address.street} {currentLabel.address.number}</p><p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">{currentLabel.address.barrio && `${currentLabel.address.barrio}, `}{currentLabel.address.city}, {currentLabel.address.province}</p><div className="flex items-center gap-2 mt-2">{currentLabel.lat && <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-black text-[8px] h-4"><Crosshair size={10} className="mr-1" /> COORDENADAS VINCULADAS</Badge>}</div></div></div>
            </CardContent>
            <CardFooter className="p-8 bg-slate-50 flex gap-3"><Button variant="outline" className="flex-1 rounded-2xl h-16 font-black text-slate-500 uppercase text-xs" onClick={() => setStep(1)}>CANCELAR</Button><Button className="flex-[2] rounded-2xl h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg shadow-xl" onClick={saveCurrentLabel}>GUARDAR DESTINO <ChevronRight className="ml-2" /></Button></CardFooter>
          </Card>
        </div>
      )}

      {isProcessing && <div className="hidden" />}
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
