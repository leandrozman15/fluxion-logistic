
'use client';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, setDoc, query, orderBy, updateDoc, limit, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Package, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Calendar, Clock, DollarSign, Truck, 
  Info, AlertTriangle, FileText, Zap, Plus, Trash2, Repeat, MoveRight, CheckCircle2, ChevronRight, ChevronLeft, LayoutGrid, UserCheck, Edit, TrendingUp, CreditCard
} from "lucide-react";
import { Load, Client, Hub, LoadLegStop, LoadDocument, LoadDocType, Truck as TruckType, Driver, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse } from "date-fns";
import { calculateRouteDetails } from "@/services/google-maps";

const SERVICE_TYPES = [
  { id: 'standard', label: 'Carga General', icon: Package },
  { id: 'FTL', label: 'Carga Completa (FTL)', icon: Truck },
  { id: 'reefer', label: 'Refrigerado', icon: Package },
  { id: 'dangerous', label: 'Carga Peligrosa', icon: AlertTriangle },
];

interface LoadFormWizardProps {
  loadId?: string;
}

export default function LoadFormWizard({ loadId }: LoadFormWizardProps) {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNumber, setIsLoadingNumber] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Stop Modal State
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [activeLeg, setActiveLeg] = useState<'outbound' | 'return'>('outbound');
  const [editingStop, setEditingStop] = useState<Partial<LoadLegStop>>({
    id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "",
    description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: []
  });

  // Remito Sub-modal state
  const [newDoc, setNewDoc] = useState<Partial<LoadDocument>>({ type: 'remito', number: '', hasCot: false, cotNumber: '', despachoNumber: '', sealNumber: '' });

  const [formData, setFormData] = useState<Partial<Load>>({
    orderNumber: "",
    serviceType: 'standard',
    clientName: "",
    invoiceNumber: "",
    isRoundTrip: false,
    pickupDate: format(new Date(), "yyyy-MM-dd"),
    pickupTime: "08:00",
    estimatedArrivalDate: format(new Date(), "yyyy-MM-dd"),
    estimatedArrivalTime: "18:00",
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "" },
    returnDestination: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "" },
    outboundStops: [],
    returnStops: [],
    basePrice: 0, 
    totalAmount: 0,
    status: "pending",
    budget: { initialAdvance: 0, totalBudget: 0, driverCommission: 0, otherInternalCosts: 0, categories: {} },
    tracking: {
      currentLat: 0,
      currentLng: 0,
      currentSpeed: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      distanceTraveledKm: 0,
      distanceRemainingKm: 0,
      timeOnRouteMinutes: 0,
      timeStoppedMinutes: 0,
      lastUpdateAt: null,
      history: [],
      alerts: []
    }
  });

  const loadRef = useMemo(() => loadId && db ? doc(db, "loads", loadId) : null, [db, loadId]);
  const { data: existingLoad, loading: loadingExisting } = useDoc<Load>(loadRef);

  const tenantRef = useMemo(() => (db && tenantId) ? doc(db, "tenants", tenantId) : null, [db, tenantId]);
  const { data: tenant } = useDoc<Tenant>(tenantRef);

  // LOGICA PARA NÚMERO CONSECUTIVO
  useEffect(() => {
    async function fetchNextOrderNumber() {
      if (loadId || !db) return;
      
      setIsLoadingNumber(true);
      try {
        const q = query(collection(db, "loads"), orderBy("orderNumber", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        
        let nextNumber = 1;
        const currentYear = new Date().getFullYear();

        if (!querySnapshot.empty) {
          const lastLoad = querySnapshot.docs[0].data() as Load;
          const parts = lastLoad.orderNumber.split("-");
          if (parts.length === 3) {
            const lastSeq = parseInt(parts[2]);
            if (!isNaN(lastSeq)) {
              nextNumber = lastSeq + 1;
            }
          }
        }

        const paddedNumber = String(nextNumber).padStart(4, '0');
        setFormData(prev => ({
          ...prev,
          orderNumber: `FL-${currentYear}-${paddedNumber}`
        }));
      } catch (e) {
        console.error("Error fetching order number sequence:", e);
      } finally {
        setIsLoadingNumber(false);
      }
    }

    if (!loadId) fetchNextOrderNumber();
  }, [db, loadId]);

  useEffect(() => {
    if (existingLoad) {
      setFormData({
        ...existingLoad,
        pickupDate: existingLoad.pickupDate || format(new Date(), "yyyy-MM-dd"),
        pickupTime: existingLoad.pickupTime || "08:00",
        outboundStops: existingLoad.outboundStops || [],
        returnStops: existingLoad.returnStops || [],
        returnDestination: existingLoad.returnDestination || { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "" },
        budget: existingLoad.budget || { initialAdvance: 0, totalBudget: 0, driverCommission: 0, otherInternalCosts: 0, categories: {} }
      });
    }
  }, [existingLoad]);

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const hubsQuery = useMemo(() => db ? query(collection(db, "hubs"), orderBy("name")) : null, [db]);
  const trucksQuery = useMemo(() => db ? query(collection(db, "trucks"), orderBy("plate")) : null, [db]);
  const driversQuery = useMemo(() => db ? query(collection(db, "drivers"), orderBy("lastName")) : null, [db]);

  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const locationsList = useMemo(() => {
    const list: any[] = [];
    hubs?.forEach(h => list.push({ id: h.id, name: `[SEDE] ${h.name}`, type: 'hub', data: h }));
    clients?.forEach(c => list.push({ id: c.id, name: `[CLIENTE] ${c.name}`, type: 'client', data: c }));
    return list;
  }, [hubs, clients]);

  const selectedTruck = useMemo(() => trucks?.find(t => t.id === formData.assignedTruckId), [trucks, formData.assignedTruckId]);

  const handleTruckSelect = (id: string) => {
    const truck = trucks?.find(t => t.id === id);
    if (!truck) return;
    setFormData(prev => ({
      ...prev,
      assignedTruckId: id,
      assignedDriverId: truck.assignedDriverId && truck.assignedDriverId !== 'none' ? truck.assignedDriverId : prev.assignedDriverId
    }));
    if (truck.assignedDriverId && truck.assignedDriverId !== 'none') {
      toast({ title: "Chofer Vinculado", description: "Se ha asignado automáticamente el chofer de esta unidad." });
    }
  };

  const handleCalculateArrival = async (isOutbound: boolean) => {
    const dateStr = isOutbound ? formData.pickupDate : formData.returnPickupDate;
    const timeStr = isOutbound ? formData.pickupTime : formData.returnPickupTime;
    const stops = isOutbound ? formData.outboundStops : formData.returnStops;
    
    const origin = isOutbound 
      ? formData.origin 
      : (formData.outboundStops?.[formData.outboundStops?.length - 1] || formData.origin);
    
    const destination = isOutbound 
      ? (formData.outboundStops?.[formData.outboundStops?.length - 1]) 
      : (formData.returnDestination);

    if (!dateStr || !timeStr || !origin?.address || !destination?.address) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Asegúrese de cargar salida y al menos un punto de destino." });
      return;
    }

    const apiKey = tenant?.settings?.mapApiKey;
    
    if (!apiKey || tenant?.settings?.mapProvider !== 'google') {
      const startDateTime = parse(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", new Date());
      const endDateTime = addMinutes(startDateTime, 480); 
      if (isOutbound) {
        setFormData(prev => ({ ...prev, estimatedArrivalDate: format(endDateTime, "yyyy-MM-dd"), estimatedArrivalTime: format(endDateTime, "HH:mm") }));
      } else {
        setFormData(prev => ({ ...prev, returnEstimatedArrivalDate: format(endDateTime, "yyyy-MM-dd"), returnEstimatedArrivalTime: format(endDateTime, "HH:mm") }));
      }
      toast({ 
        title: "ETA (Cálculo Manual)", 
        description: "Se aplicó un tiempo fijo de 8hs por falta de API Key en Ajustes.",
        variant: "default" 
      });
      return;
    }

    setIsCalculating(true);
    try {
      const itineraryAddresses = isOutbound 
        ? [origin.address, ...(stops?.map(s => s.address) || [])]
        : [origin.address, ...(stops?.map(s => s.address) || []), destination.address];

      const result = await calculateRouteDetails(itineraryAddresses, apiKey);

      if (result) {
        const startDateTime = parse(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", new Date());
        const totalMinutes = result.durationMinutes + (stops?.length || 0) * 30;
        const endDateTime = addMinutes(startDateTime, totalMinutes); 
        
        if (isOutbound) {
          setFormData(prev => ({ 
            ...prev, 
            estimatedArrivalDate: format(endDateTime, "yyyy-MM-dd"), 
            estimatedArrivalTime: format(endDateTime, "HH:mm"),
            tracking: {
              ...(prev.tracking || {} as any),
              distanceRemainingKm: result.distanceKm,
              distanceTraveledKm: 0
            }
          }));
        } else {
          setFormData(prev => ({ ...prev, returnEstimatedArrivalDate: format(endDateTime, "yyyy-MM-dd"), returnEstimatedArrivalTime: format(endDateTime, "HH:mm") }));
        }
        toast({ title: "Google Maps: Éxito", description: `Ruta de ${result.distanceKm} km calculada. Resumen: ${result.summary}` });
      } else {
        throw new Error("No se pudo obtener una respuesta válida de Google Maps.");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en cálculo Real", description: e.message });
    } finally {
      setIsCalculating(false);
    }
  };

  const buildFullAddress = (data: any) => {
    if (!data) return "";
    if (typeof data.address === 'string') {
      const parts = [data.address, data.city, data.province].filter(Boolean);
      return parts.join(", ");
    }
    if (data.address && typeof data.address === 'object') {
      const { street, number, floor, barrio, city, province } = data.address;
      const streetPart = `${street || ""} ${number || ""}`.trim();
      const parts = [streetPart, floor ? `Piso ${floor}` : null, barrio ? `Zona: ${barrio}` : null, city, province].filter(Boolean);
      return parts.join(", ");
    }
    return "";
  };

  const handleOriginSelect = (id: string) => {
    const selection = locationsList.find(l => l.id === id);
    if (!selection) return;
    const locData = selection.data;
    setFormData(prev => ({
      ...prev,
      origin: {
        ...prev.origin!,
        id: selection.id,
        name: locData.name,
        address: buildFullAddress(locData),
        province: locData.province || locData.address?.province || "",
        city: locData.city || locData.address?.city || "",
        country: locData.country || locData.address?.country || "Argentina",
        phone: locData.phone || locData.mainContact?.phone || "",
        contact: locData.mainContact?.name || "",
        lat: locData.lat || locData.address?.lat,
        lng: locData.lng || locData.address?.lng,
      }
    }));
  };

  const handleReturnDestSelect = (id: string) => {
    const selection = locationsList.find(l => l.id === id);
    if (!selection) return;
    const locData = selection.data;
    setFormData(prev => ({
      ...prev,
      returnDestination: {
        ...prev.returnDestination!,
        id: selection.id,
        name: locData.name,
        address: buildFullAddress(locData),
        province: locData.province || locData.address?.province || "",
        city: locData.city || locData.address?.city || "",
        country: locData.country || locData.address?.country || "Argentina",
        phone: locData.phone || locData.mainContact?.phone || "",
        contact: locData.mainContact?.name || "",
        lat: locData.lat || locData.address?.lat,
        lng: locData.lng || locData.address?.lng,
      }
    }));
  };

  const handleStopLocationSelect = (id: string) => {
    const selection = locationsList.find(l => l.id === id);
    if (!selection) return;
    const locData = selection.data;
    setEditingStop(prev => ({
      ...prev,
      locationId: selection.id,
      name: locData.name,
      address: buildFullAddress(locData),
      province: locData.province || locData.address?.province || "",
      city: locData.city || locData.address?.city || "",
      country: locData.country || locData.address?.country || "Argentina",
      contact: locData.mainContact?.name || "",
      phone: locData.phone || locData.mainContact?.phone || "",
      lat: locData.lat || locData.address?.lat,
      lng: locData.lng || locData.address?.lng,
    }));
  };

  const addRemitoToStop = () => {
    if (!newDoc.number) return;
    const docObj: LoadDocument = {
      id: Math.random().toString(36).substring(7),
      type: newDoc.type as LoadDocType,
      number: newDoc.number,
      hasCot: newDoc.hasCot,
      cotNumber: newDoc.cotNumber,
      despachoNumber: newDoc.despachoNumber,
      sealNumber: newDoc.sealNumber,
      uploadedAt: new Date().toISOString(),
      leg: activeLeg
    };
    setEditingStop(prev => ({ ...prev, documents: [...(prev.documents || []), docObj] }));
    setNewDoc({ type: 'remito', number: '', hasCot: false, cotNumber: '', despachoNumber: '', sealNumber: '' });
  };

  const saveStop = () => {
    if (!editingStop.name || !editingStop.address) {
      toast({ variant: "destructive", title: "Faltan datos", description: "El destino y la dirección son obligatorios." });
      return;
    }
    const stop = { ...editingStop, id: editingStop.id || Math.random().toString(36).substring(7) } as LoadLegStop;
    const field = activeLeg === 'outbound' ? 'outboundStops' : 'returnStops';
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []).filter(s => s.id !== stop.id), stop]
    }));
    setIsStopModalOpen(false);
    setEditingStop({ id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "", description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: [] });
  };

  const removeStop = (leg: 'outbound' | 'return', id: string) => {
    const field = leg === 'outbound' ? 'outboundStops' : 'returnStops';
    setFormData(prev => ({ ...prev, [field]: (prev[field] || []).filter(s => s.id !== id) }));
  };

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      if (loadId) {
        await updateDoc(doc(db, "loads", loadId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Operación Actualizada", description: `Flete ${formData.orderNumber} guardado.` });
      } else {
        const newRef = doc(collection(db, "loads"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Carga Registrada", description: `Orden ${formData.orderNumber} creada.` });
      }
      router.push('/cargas');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalWeight = useMemo(() => {
    const outbound = formData.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0;
    const retour = formData.returnStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0;
    return outbound + retour;
  }, [formData]);

  const projectedInternalCosts = useMemo(() => {
    const advance = formData.budget?.initialAdvance || 0;
    const commission = formData.budget?.driverCommission || 0;
    const other = formData.budget?.otherInternalCosts || 0;
    return advance + commission + other;
  }, [formData.budget]);

  const projectedMargin = (formData.totalAmount || 0) - projectedInternalCosts;

  if (loadId && loadingExisting) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{loadId ? 'Editar Operación' : 'Nueva Operación Logística'}</h1>
            <p className="text-sm text-slate-500">Gestión de fletes multi-destino nacional.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoadingNumber && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100 hidden sm:flex">
            {formData.orderNumber || 'GENERANDO...'}
          </Badge>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm mx-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[500px]">
          {[
            { id: 1, label: "Gerais", icon: Info },
            { id: 2, label: "Logística Ida", icon: MoveRight },
            { id: 3, label: "Vuelta (Retorno)", icon: Repeat },
            { id: 4, label: "Financiero", icon: DollarSign },
            { id: 5, label: "Finalizar", icon: CheckCircle2 }
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
                step > s.id ? "bg-green-500 text-white" : step === s.id ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 text-slate-300 border"
              )}>
                {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
              </div>
              <span className={cn("text-[9px] uppercase font-bold text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>
                {s.label}
              </span>
              {s.id < 5 && <div className={cn("absolute top-4.5 left-1/2 w-full h-[1px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in duration-300 mx-4">
        {step === 1 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Configuración Inicial y Recursos</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <Label>Tipo de Servicio</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SERVICE_TYPES.map(type => (
                      <button 
                        key={type.id} 
                        className={cn(
                          "flex flex-col items-center justify-center min-h-[80px] gap-2 p-3 rounded-xl border transition-all text-center",
                          formData.serviceType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                        )}
                        onClick={() => setFormData({...formData, serviceType: type.id as any})}
                      >
                        <type.icon size={20} />
                        <span className="text-[10px] uppercase font-black">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                      <Truck size={16} /> Vehículo y Equipo
                    </div>
                    <div className="space-y-2">
                      <Label>Unidad Tractora (Camión)</Label>
                      <Select value={formData.assignedTruckId ?? ''} onValueChange={handleTruckSelect}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar camión" /></SelectTrigger>
                        <SelectContent>
                          {trucks?.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.plate} - {t.brand} {t.model}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                      <UserCheck size={16} /> Personal Asignado
                    </div>
                    <div className="space-y-2">
                      <Label>Chofer Responsable</Label>
                      <Select value={formData.assignedDriverId ?? ''} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar chofer" /></SelectTrigger>
                        <SelectContent>
                          {drivers?.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                      <Clock size={16} /> Programación de Salida (Ida)
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">Fecha Salida</Label>
                        <Input type="date" value={formData.pickupDate ?? ''} onChange={e => setFormData({...formData, pickupDate: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase">Hora Salida</Label>
                        <Input type="time" value={formData.pickupTime ?? ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                        <Repeat size={16} /> Viaje de Retorno
                      </div>
                      <Switch checked={formData.isRoundTrip ?? false} onCheckedChange={v => setFormData({...formData, isRoundTrip: v})} />
                    </div>
                    {formData.isRoundTrip ? (
                      <div className="space-y-4 animate-in fade-in">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase">Fecha Inicio Retorno</Label>
                            <Input type="date" value={formData.returnPickupDate ?? ''} onChange={e => setFormData({...formData, returnPickupDate: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase">Hora Inicio Retorno</Label>
                            <Input type="time" value={formData.returnPickupTime ?? ''} onChange={e => setFormData({...formData, returnPickupTime: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Habilite el retorno si el camión cargará mercadería de vuelta.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Logística de Ida</CardTitle>
              <CardDescription>Establezca el punto de carga inicial y todos los puntos de descarga.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-blue-600" /> Punto de Carga Inicial (Origen)
                </div>
                <Select onValueChange={handleOriginSelect} value={formData.origin?.id ?? ''}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar origen (Sede/Cliente)" /></SelectTrigger>
                  <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                </Select>
                {formData.origin?.name && (
                  <div className="p-3 bg-white border rounded-lg space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Dirección Completa Origen</div>
                    <div className="text-xs font-bold text-slate-600">{formData.origin.address ?? ''}</div>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button 
                    size="sm" 
                    className="bg-blue-600 w-full" 
                    onClick={() => { 
                      setActiveLeg('outbound'); 
                      setEditingStop({ id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "", description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: [] }); 
                      setIsStopModalOpen(true); 
                    }}
                  >
                    <Plus size={14} className="mr-1" /> Agregar Destino de Carga
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase font-bold text-slate-400">Hoja de Ruta: Ida (Entregas)</Label>
                {formData.outboundStops?.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-xs text-slate-400 italic">No hay destinos agregados.</div>
                ) : (
                  formData.outboundStops?.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm group">
                       <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">{idx + 1}</div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{stop.name ?? ''}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-medium leading-tight">{stop.address ?? ''}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setActiveLeg('outbound'); setEditingStop(stop); setIsStopModalOpen(true); }}><Edit size={16}/></Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeStop('outbound', stop.id)}><Trash2 size={16}/></Button>
                       </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-6 border-t space-y-4">
                 <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                    <Clock size={16} /> Cálculo de Llegada Estimada (Ida)
                 </div>
                 <Button variant="outline" size="sm" className="w-full text-[10px] font-bold h-10 border-blue-200 text-blue-600" onClick={() => handleCalculateArrival(true)} disabled={isCalculating || formData.outboundStops?.length === 0}>
                    {isCalculating ? <Loader2 size={12} className="animate-spin mr-1" /> : <Zap size={12} className="mr-1" />}
                    Calcular ETA Ida (Google Maps)
                 </Button>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-green-600 font-bold">ETA Fecha Llegada</Label>
                      <Input type="date" value={formData.estimatedArrivalDate ?? ''} onChange={e => setFormData({...formData, estimatedArrivalDate: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-green-600 font-bold">ETA Hora Llegada</Label>
                      <Input type="time" value={formData.estimatedArrivalTime ?? ''} onChange={e => setFormData({...formData, estimatedArrivalTime: e.target.value})} />
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            {!formData.isRoundTrip ? (
               <CardContent className="py-20 text-center space-y-4">
                  <Repeat className="w-12 h-12 mx-auto text-slate-200" />
                  <p className="text-slate-400 italic">Viaje solo de ida. Habilite "Viaje de Retorno" en el paso 1 si desea cargar mercadería de vuelta.</p>
                  <Button variant="outline" onClick={() => setStep(4)}>Saltar Paso <ArrowRight size={14} className="ml-2" /></Button>
               </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Logística de Vuelta (Retorno)</CardTitle>
                  <CardDescription>Cargue los puntos de recolección y el destino final de la mercadería de retorno.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-xs uppercase font-bold text-slate-400">Puntos de Recolección en Ruta (Vuelta)</Label>
                    
                    <Button 
                      size="sm" 
                      className="bg-orange-600 w-full" 
                      onClick={() => { 
                        setActiveLeg('return'); 
                        setEditingStop({ id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "", description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: [] }); 
                        setIsStopModalOpen(true); 
                      }}
                    >
                      <Plus size={14} className="mr-1" /> Agregar Parada Retorno
                    </Button>

                    {formData.returnStops?.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-slate-400 italic text-xs">Sin paradas de retorno registradas.</div>
                    ) : (
                      formData.returnStops?.map((stop, idx) => (
                        <div key={stop.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm group border-l-4 border-l-orange-500">
                           <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">{idx + 1}</div>
                              <div>
                                <p className="font-bold text-sm text-slate-800">{stop.name ?? ''}</p>
                                <p className="text-[10px] text-slate-500 uppercase font-medium leading-tight">{stop.address ?? ''}</p>
                              </div>
                           </div>
                           <div className="flex gap-2">
                             <Button variant="ghost" size="icon" onClick={() => { setActiveLeg('return'); setEditingStop(stop); setIsStopModalOpen(true); }}><Edit size={16}/></Button>
                             <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeStop('return', stop.id)}><Trash2 size={16}/></Button>
                           </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 border-dashed space-y-4 mt-8">
                    <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-widest">
                      <div className="w-2 h-2 rounded-full bg-orange-600" /> Punto de Descarga Final (Retorno)
                    </div>
                    <Select onValueChange={handleReturnDestSelect} value={formData.returnDestination?.id ?? ''}>
                      <SelectTrigger className="bg-white border-orange-200"><SelectValue placeholder="Seleccionar destino final (Sede/Cliente)" /></SelectTrigger>
                      <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="pt-6 border-t space-y-4">
                    <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase">
                        <Clock size={16} /> Cálculo de Llegada Final (Retorno)
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-[10px] font-bold h-10 border-orange-200 text-orange-600" onClick={() => handleCalculateArrival(false)} disabled={isCalculating || !formData.returnDestination?.name}>
                        {isCalculating ? <Loader2 size={12} className="animate-spin mr-1" /> : <Zap size={12} className="mr-1" />}
                        Calcular ETA Retorno (Google Maps)
                    </Button>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-green-600 font-bold">ETA Llegada Final</Label>
                          <Input type="date" value={formData.returnEstimatedArrivalDate ?? ''} onChange={e => setFormData({...formData, returnEstimatedArrivalDate: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase text-green-600 font-bold">ETA Hora Final</Label>
                          <Input type="time" value={formData.returnEstimatedArrivalTime ?? ''} onChange={e => setFormData({...formData, returnEstimatedArrivalTime: e.target.value})} />
                        </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="text-blue-600" />
                  <CardTitle>Ingresos y Facturación al Cliente</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Total Facturado al Cliente (ARS)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      type="number" 
                      className="pl-9 text-lg font-bold text-green-600"
                      value={formData.totalAmount ?? 0} 
                      onChange={e => setFormData({...formData, totalAmount: parseFloat(e.target.value) || 0})} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>N° de Factura / Ref. Contable</Label>
                  <Input 
                    placeholder="Ej: FAC-A-0001-00004321" 
                    value={formData.invoiceNumber ?? ''} 
                    onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-l-4 border-l-blue-600">
              <CardHeader>
                <div className="flex items-center gap-2 text-blue-600 font-bold">
                  <TrendingUp size={20} />
                  <CardTitle>Costos de Operación Interna</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-slate-500">Anticipo Viáticos Chofer</Label>
                    <Input 
                      type="number" 
                      value={formData.budget?.initialAdvance ?? 0} 
                      onChange={e => setFormData({...formData, budget: {...formData.budget!, initialAdvance: parseFloat(e.target.value) || 0}})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-slate-500">Comisión Chofer / Viaje</Label>
                    <Input 
                      type="number" 
                      value={formData.budget?.driverCommission ?? 0} 
                      onChange={e => setFormData({...formData, budget: {...formData.budget!, driverCommission: parseFloat(e.target.value) || 0}})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-slate-500">Otros Costos Operativos Est.</Label>
                    <Input 
                      type="number" 
                      value={formData.budget?.otherInternalCosts ?? 0} 
                      onChange={e => setFormData({...formData, budget: {...formData.budget!, otherInternalCosts: parseFloat(e.target.value) || 0}})} 
                    />
                  </div>
                </div>

                <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                   <div className="text-center sm:text-left">
                      <p className="text-[10px] uppercase font-black text-slate-400">Total Costos Internos</p>
                      <p className="text-xl font-bold text-red-600">${projectedInternalCosts.toLocaleString()}</p>
                   </div>
                   <div className="text-center sm:text-right p-4 bg-green-50 rounded-xl border border-green-100 min-w-[200px]">
                      <p className="text-[10px] uppercase font-black text-green-600">Margen Bruto Proyectado</p>
                      <p className="text-2xl font-black text-green-700">${projectedMargin.toLocaleString()}</p>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 5 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Resumen y Finalización</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                     <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Carga Útil Acumulada</p>
                     <p className="text-3xl font-black italic">{totalWeight.toLocaleString()} <span className="text-sm font-normal opacity-50 uppercase">Kg</span></p>
                  </div>
                  <div className="text-center sm:text-right">
                     <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Utilidad Estimada</p>
                     <p className="text-3xl font-black text-green-400">${projectedMargin.toLocaleString()}</p>
                  </div>
               </div>
               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Zap className="text-blue-600 mt-1 shrink-0" size={18} />
                  <p className="text-xs text-blue-700 leading-relaxed">Al confirmar, se generará la hoja de ruta digital para el conductor. Asegúrese de que todos los remitos estén cargados correctamente para evitar demoras en la fiscalización de ruta.</p>
               </div>
            </CardContent>
            <CardFooter className="flex justify-end"><Button onClick={handleSubmit} className="bg-green-600 w-full sm:w-auto" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} {loadId ? 'Guardar Cambios' : 'Registrar Operación Completa'}</Button></CardFooter>
          </Card>
        )}
      </div>

      <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeLeg === 'outbound' ? <MoveRight className="text-blue-600" /> : <Repeat className="text-orange-600" />}
              {editingStop.id ? 'Editar Parada' : `Nuevo Punto de Destino (${activeLeg === 'outbound' ? 'Ida' : 'Vuelta'})`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-xl border border-dashed">
              <div className="space-y-2">
                <Label>Seleccionar Ubicación</Label>
                <Select onValueChange={handleStopLocationSelect} value={editingStop.locationId ?? ''}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sede o Cliente" /></SelectTrigger>
                  <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Identificador</Label>
                  <Input placeholder="Ej: Depósito ACME" value={editingStop.name ?? ''} onChange={e => setEditingStop({...editingStop, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Dirección de Entrega (Completa)</Label>
                  <Input placeholder="Se completa automáticamente al seleccionar" value={editingStop.address ?? ''} onChange={e => setEditingStop({...editingStop, address: e.target.value})} />
                </div>
              </div>
            </div>

            <Card className="border-accent/10 shadow-none bg-accent/5">
              <CardHeader className="py-3"><CardTitle className="text-sm">Mercadería y Remitos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Descripción</Label><Input className="bg-white" value={editingStop.description ?? ''} onChange={e => setEditingStop({...editingStop, description: e.target.value})} /></div>
                   <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Peso (Kg)</Label><Input className="bg-white" type="number" value={editingStop.weightKg ?? 0} onChange={e => setEditingStop({...editingStop, weightKg: parseFloat(e.target.value) || 0})} /></div>
                   <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Bultos</Label><Input className="bg-white" type="number" value={editingStop.units ?? 0} onChange={e => setEditingStop({...editingStop, units: parseInt(e.target.value) || 0})} /></div>
                </div>

                <div className="p-4 bg-white rounded-xl border space-y-4">
                  <Label className="text-blue-600 font-bold text-[10px] uppercase flex items-center gap-2"><FileText size={14}/> Carga de Remitos y Seguridad</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <Input className="h-8 text-xs" placeholder="N° Remito" value={newDoc.number ?? ''} onChange={e => setNewDoc({...newDoc, number: e.target.value})} />
                    <Input className="h-8 text-xs" placeholder="N° Precinto" value={newDoc.sealNumber ?? ''} onChange={e => setNewDoc({...newDoc, sealNumber: e.target.value})} />
                    <Input className="h-8 text-xs" placeholder="Despacho (SIM)" value={newDoc.despachoNumber ?? ''} onChange={e => setNewDoc({...newDoc, despachoNumber: e.target.value})} />
                    <div className="flex items-center gap-2 px-2 bg-slate-50 border rounded h-8">
                       <Switch checked={newDoc.hasCot ?? false} onCheckedChange={v => setNewDoc({...newDoc, hasCot: v})} />
                       <span className="text-[9px] font-bold uppercase">COT</span>
                    </div>
                    <Button size="sm" className="h-8 bg-blue-600" onClick={addRemitoToStop} disabled={!newDoc.number}><Plus size={14}/></Button>
                  </div>
                  {editingStop.documents && editingStop.documents.length > 0 && (
                    <div className="space-y-1 pt-2">
                       {editingStop.documents.map(doc => (
                         <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-[10px] font-bold">
                            <div className="flex gap-2">
                               <span className="text-slate-700">R: {doc.number ?? ''}</span>
                               {doc.sealNumber && <Badge variant="outline" className="h-3 text-[7px] border-orange-200 text-orange-600 bg-orange-50">PREC: {doc.sealNumber}</Badge>}
                               {doc.hasCot && <Badge className="h-3 text-[7px] bg-green-500 border-none">COT OK</Badge>}
                               {doc.despachoNumber && <Badge variant="outline" className="h-3 text-[7px] border-blue-200 text-blue-600">SIM: {doc.despachoNumber ?? ''}</Badge>}
                            </div>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => setEditingStop({...editingStop, documents: editingStop.documents?.filter(d => d.id !== doc.id)}) }><Trash2 size={10}/></Button>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsStopModalOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 w-full sm:w-auto" onClick={saveStop}>Guardar Parada en Hoja de Ruta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => setStep(prev => prev - 1)} disabled={step === 1 || isSubmitting}><ChevronLeft size={16} /> Volver</Button>
          <div className="flex gap-2">
            {step < 5 ? (
              <Button onClick={() => setStep(prev => prev + 1)} className="bg-blue-600 min-w-[120px]">Siguiente <ChevronRight size={16}/></Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[120px]" disabled={isSubmitting}>Finalizar <Save size={16}/></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
