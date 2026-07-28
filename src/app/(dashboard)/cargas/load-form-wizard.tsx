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
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Package, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Calendar, Clock, DollarSign, Truck, 
  Info, AlertTriangle, FileText, Zap, Plus, Trash2, Repeat, MoveRight, CheckCircle2, ChevronRight, ChevronLeft, LayoutGrid, UserCheck, Edit, TrendingUp, CreditCard, Anchor, Scale, ListOrdered, ShieldCheck, Ship, ScanBarcode
} from "lucide-react";
import { Load, Client, Hub, LoadLegStop, LoadDocument, LoadDocType, Truck as TruckType, Driver, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse } from "date-fns";

const SERVICE_TYPES = [
  { id: 'standard', label: 'Carga General', icon: Package },
  { id: 'FTL', label: 'Carga Completa (FTL)', icon: Truck },
  { id: 'customs', label: 'Puerto / Contenedor', icon: Ship },
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

  // Stop Modal State
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [activeLeg, setActiveLeg] = useState<'outbound' | 'return'>('outbound');
  const [editingStop, setEditingStop] = useState<Partial<LoadLegStop>>({
    id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "",
    description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: [], dockName: ""
  });

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
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "", dockName: "" },
    returnDestination: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "", dockName: "" },
    outboundStops: [],
    returnStops: [],
    basePrice: 0, 
    totalAmount: 0,
    status: "pending",
    international: {
      operationType: 'import',
      exitCustoms: "",
      entryCustoms: "",
      declarationNumber: "",
      micDtaNumber: "",
      containerNumber: "",
      sealNumber: "",
      transportDocType: 'CP',
      transportDocNumber: "",
      fobValueUsd: 0,
      freightValueUsd: 0,
      insuranceValueUsd: 0,
      cifValueUsd: 0,
      importDutiesUsd: 0,
      customsIvaUsd: 0,
      totalCustomsCostsUsd: 0,
      isMalvinaPresented: false
    },
    budget: { initialAdvance: 0, totalBudget: 0, driverCommission: 0, otherInternalCosts: 0, categories: {} },
    tracking: {
      currentLat: 0, currentLng: 0, currentSpeed: 0, avgSpeed: 0, maxSpeed: 0,
      distanceTraveledKm: 0, distanceRemainingKm: 0,
      timeOnRouteMinutes: 0, timeStoppedMinutes: 0, lastUpdateAt: null,
      history: [], alerts: []
    }
  });

  const loadRef = useMemo(() => loadId && db ? doc(db, "loads", loadId) : null, [db, loadId]);
  const { data: existingLoad, loading: loadingExisting } = useDoc<Load>(loadRef);

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
            if (!isNaN(lastSeq)) nextNumber = lastSeq + 1;
          }
        }
        const paddedNumber = String(nextNumber).padStart(4, '0');
        setFormData(prev => ({ ...prev, orderNumber: `FL-${currentYear}-${paddedNumber}` }));
      } catch (e) {
        console.error(e);
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
        returnDestination: existingLoad.returnDestination || { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "", dockName: "" },
        budget: existingLoad.budget || { initialAdvance: 0, totalBudget: 0, driverCommission: 0, otherInternalCosts: 0, categories: {} },
        international: existingLoad.international || formData.international
      });
    }
  }, [existingLoad]);

  const trucksQuery = useMemo(() => db ? query(collection(db, "trucks"), orderBy("plate")) : null, [db]);
  const driversQuery = useMemo(() => db ? query(collection(db, "drivers"), orderBy("lastName")) : null, [db]);
  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const hubsQuery = useMemo(() => db ? query(collection(db, "hubs"), orderBy("name")) : null, [db]);

  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);

  const locationsList = useMemo(() => {
    const list: any[] = [];
    hubs?.forEach(h => list.push({ id: h.id, name: `[SEDE] ${h.name}`, type: 'hub', data: h }));
    clients?.forEach(c => list.push({ id: c.id, name: `[CLIENTE] ${c.name}`, type: 'client', data: c }));
    return list;
  }, [hubs, clients]);

  const selectedTruck = useMemo(() => trucks?.find(t => t.id === formData.assignedTruckId), [trucks, formData.assignedTruckId]);

  const currentTotalWeight = useMemo(() => {
    const outbound = formData.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0;
    const retour = formData.returnStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0;
    return outbound + retour;
  }, [formData.outboundStops, formData.returnStops]);

  const isWeightLimitExceeded = useMemo(() => {
    if (!selectedTruck) return false;
    return currentTotalWeight > (selectedTruck.capacityKg || 0);
  }, [selectedTruck, currentTotalWeight]);

  const handleTruckSelect = (id: string) => {
    const truck = trucks?.find(t => t.id === id);
    if (!truck) return;
    if (currentTotalWeight > (truck.capacityKg || 0)) {
       toast({ variant: "destructive", title: "Límite Excedido", description: `Unidad no apta para ${currentTotalWeight}kg.` });
    }
    setFormData(prev => ({
      ...prev,
      assignedTruckId: id,
      assignedDriverId: truck.assignedDriverId && truck.assignedDriverId !== 'none' ? truck.assignedDriverId : prev.assignedDriverId
    }));
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
        address: locData.address?.street ? `${locData.address.street} ${locData.address.number}, ${locData.address.city}` : (locData.address || ""),
        province: locData.province || locData.address?.province || "",
        city: locData.city || locData.address?.city || "",
        country: locData.country || locData.address?.country || "Argentina",
        phone: locData.phone || locData.mainContact?.phone || "",
        contact: locData.mainContact?.name || "",
        lat: locData.lat || locData.address?.lat,
        lng: locData.lng || locData.address?.lng,
        dockName: ""
      }
    }));
  };

  const saveStop = () => {
    if (!editingStop.name || !editingStop.address) {
      toast({ variant: "destructive", title: "Faltan datos" });
      return;
    }
    const stop = { ...editingStop, id: editingStop.id || Math.random().toString(36).substring(7) } as LoadLegStop;
    const field = activeLeg === 'outbound' ? 'outboundStops' : 'returnStops';
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []).filter(s => s.id !== stop.id), stop] }));
    setIsStopModalOpen(false);
    setEditingStop({ id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "", description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: [], dockName: "" });
  };

  const handleSubmit = async () => {
    if (!db) return;
    if (isWeightLimitExceeded) {
       toast({ variant: "destructive", title: "Sobrepeso Detectado", description: "No puede despachar una unidad excedida." });
       return;
    }
    setIsSubmitting(true);
    try {
      if (loadId) {
        await updateDoc(doc(db, "loads", loadId), { ...formData, updatedAt: serverTimestamp() });
        toast({ title: "Orden Actualizada" });
      } else {
        const newRef = doc(collection(db, "loads"));
        await setDoc(newRef, { ...formData, id: newRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast({ title: "Flete Registrado" });
      }
      router.push('/cargas');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadId && loadingExisting) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{loadId ? 'Editar Flete' : 'Nueva Operación'}</h1>
            <p className="text-sm text-slate-500">Gestión de pesos y hoja de ruta.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100 hidden sm:flex">
          {formData.orderNumber || '...'}
        </Badge>
      </div>

      <div className="bg-white p-4 rounded-3xl border shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-[600px]">
          {[
            { id: 1, label: "Recursos", icon: Truck },
            { id: 2, label: "Hoja Ruta", icon: ListOrdered },
            { id: 3, label: "Retorno", icon: Repeat },
            { id: 4, label: "Puerto / Comex", icon: Ship },
            { id: 5, label: "Seguridad", icon: ShieldCheck }
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
                step > s.id ? "bg-green-50 text-white border-green-600 shadow-sm" : step === s.id ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 text-slate-300 border"
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

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
               <CardHeader><CardTitle>Tipo de Operación</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {SERVICE_TYPES.map(type => (
                    <button 
                      key={type.id}
                      onClick={() => setFormData({...formData, serviceType: type.id as any})}
                      className={cn(
                        "p-4 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all",
                        formData.serviceType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:border-blue-200"
                      )}
                    >
                      <type.icon size={24} />
                      <span className="text-[10px] font-black uppercase text-center leading-tight">{type.label}</span>
                    </button>
                  ))}
               </CardContent>
            </Card>

            <Card className={cn(
              "border-none shadow-xl transition-all duration-300",
              isWeightLimitExceeded ? "bg-red-600 text-white" : "bg-slate-900 text-white"
            )}>
               <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                        <Scale size={32} className={cn(isWeightLimitExceeded ? "text-white animate-pulse" : "text-blue-400")} />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Peso Bruto Estimado</p>
                        <p className="text-4xl font-black italic">{currentTotalWeight.toLocaleString()} <span className="text-sm font-normal opacity-50">KG</span></p>
                     </div>
                  </div>
                  {selectedTruck && (
                    <div className="text-center md:text-right space-y-1">
                       <p className="text-[10px] uppercase font-bold opacity-50">Carga Máxima Unidad</p>
                       <p className={cn("text-2xl font-black italic", isWeightLimitExceeded ? "text-white underline decoration-wavy" : "text-green-400")}>
                         {selectedTruck.capacityKg.toLocaleString()} KG
                       </p>
                    </div>
                  )}
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Asignación de Activos</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Unidad de Tracción</Label>
                  <Select value={formData.assignedTruckId ?? ''} onValueChange={handleTruckSelect}>
                    <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Elegir Camión" /></SelectTrigger>
                    <SelectContent>
                      {trucks?.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.plate} ({(t.capacityKg/1000).toFixed(1)}tn útil)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsable de Cabina</Label>
                  <Select value={formData.assignedDriverId ?? ''} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                    <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Elegir Chofer" /></SelectTrigger>
                    <SelectContent>
                      {drivers?.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Logística de Ida</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed space-y-4">
                <Label className="text-xs font-black uppercase text-blue-600">Origen / Despacho</Label>
                <Select onValueChange={handleOriginSelect} value={formData.origin?.id ?? ''}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sede o Planta de Carga" /></SelectTrigger>
                  <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-black uppercase text-slate-400">Puntos de Entrega</Label>
                  <Button size="sm" className="bg-blue-600 rounded-full" onClick={() => { setActiveLeg('outbound'); setIsStopModalOpen(true); }}>
                    <Plus size={14} className="mr-1" /> AGREGAR PARADA
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.outboundStops?.map((stop, idx) => (
                    <div key={stop.id} className="p-4 bg-white border rounded-2xl shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                          <div><p className="font-bold text-sm">{stop.name}</p><p className="text-[10px] text-slate-400">{stop.weightKg} KG • {stop.address}</p></div>
                       </div>
                       <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setFormData(prev => ({ ...prev, outboundStops: (prev.outboundStops || []).filter(s => s.id !== stop.id) }))}>
                         <Trash2 size={16} />
                       </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
             <CardHeader>
               <CardTitle className="flex items-center gap-2"><Ship className="text-blue-600" /> Operativa Aduanera / Puerto</CardTitle>
               <CardDescription>Cargue los datos del contenedor y documentación de exportación/importación.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="flex items-center gap-2"><ScanBarcode size={14} className="text-blue-500" /> N° de Contenedor</Label>
                      <Input placeholder="Ej: MEDU 123456-7" value={formData.international?.containerNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, containerNumber: e.target.value.toUpperCase()}})} />
                   </div>
                   <div className="space-y-2">
                      <Label>N° de Precinto</Label>
                      <Input placeholder="Ej: 009876" value={formData.international?.sealNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, sealNumber: e.target.value}})} />
                   </div>
                   <div className="space-y-2">
                      <Label>Terminal / Puerto</Label>
                      <Input placeholder="Ej: Terminal 4 - Puerto Buenos Aires" value={formData.international?.exitCustoms || ''} onChange={e => setFormData({...formData, international: {...formData.international!, exitCustoms: e.target.value}})} />
                   </div>
                   <div className="space-y-2">
                      <Label>N° de MIC / DTA / CRT</Label>
                      <Input placeholder="Doc. Transporte Internacional" value={formData.international?.micDtaNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, micDtaNumber: e.target.value.toUpperCase()}})} />
                   </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                   <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase mb-2">
                      <FileText size={14} /> Control de Manifiesto
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">N° Operación Aduana</Label>
                        <Input className="bg-white" value={formData.international?.declarationNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, declarationNumber: e.target.value}})} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px] uppercase font-bold text-slate-400">Tipo de Documento</Label>
                         <Select value={formData.international?.transportDocType || 'CP'} onValueChange={(v: any) => setFormData({...formData, international: {...formData.international!, transportDocType: v}})}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                               <SelectItem value="CP">Carta de Porte</SelectItem>
                               <SelectItem value="BL">Bill of Lading (BL)</SelectItem>
                               <SelectItem value="CRT">CRT Internacional</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
             <CardHeader className="bg-slate-900 text-white">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase italic">
                   <ShieldCheck className="text-blue-400" /> Control Técnico y Vial
                </CardTitle>
             </CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-slate-400">Balance de Pesos</p>
                      <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
                         <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500">Carga Declarada:</span>
                            <span className="text-lg font-black text-slate-800">{currentTotalWeight.toLocaleString()} KG</span>
                         </div>
                         {selectedTruck && (
                           <>
                            <div className="flex justify-between items-center border-t pt-4">
                                <span className="text-xs font-bold text-slate-500">Carga Máxima:</span>
                                <span className="text-lg font-black text-green-600">{selectedTruck.capacityKg.toLocaleString()} KG</span>
                            </div>
                            <Progress value={Math.min(100, (currentTotalWeight / selectedTruck.capacityKg) * 100)} className={cn("h-2", isWeightLimitExceeded ? "bg-red-200" : "bg-slate-200")} />
                           </>
                         )}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-slate-400">Recursos Confirmados</p>
                      <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
                         <div className="flex items-center gap-3"><Truck className="text-blue-600" /> <span className="text-xs font-black uppercase">{selectedTruck?.plate || 'SIN UNIDAD'}</span></div>
                         <div className="flex items-center gap-3 border-t pt-4"><UserCheck className="text-blue-600" /> <span className="text-xs font-black uppercase">Personal Habilitado</span></div>
                      </div>
                   </div>
                </div>

                {isWeightLimitExceeded && (
                  <div className="p-6 bg-red-50 border-2 border-red-200 rounded-3xl flex items-start gap-4">
                     <AlertTriangle className="text-red-600 shrink-0" size={24} />
                     <div>
                        <h4 className="text-red-700 font-black uppercase text-sm">ALERTA: SOBREPESO CRÍTICO</h4>
                        <p className="text-xs text-red-600 font-bold">La carga excede el límite legal de la unidad. El despacho está bloqueado.</p>
                     </div>
                  </div>
                )}
             </CardContent>
             <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                <Button onClick={handleSubmit} className={cn("h-14 px-10 rounded-2xl font-black text-lg", isWeightLimitExceeded ? "bg-slate-300" : "bg-green-600 shadow-xl")} disabled={isSubmitting || isWeightLimitExceeded}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} EMITIR ORDEN
                </Button>
             </CardFooter>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => setStep(prev => prev - 1)} disabled={step === 1 || isSubmitting}>
             <ChevronLeft className="mr-1" size={16} /> VOLVER
          </Button>
          {step < 5 ? (
            <Button onClick={() => setStep(prev => prev + 1)} className="bg-blue-600">SIGUIENTE <ChevronRight size={16} /></Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting || isWeightLimitExceeded}>EMITIR ORDEN <Save size={16} className="ml-2" /></Button>
          )}
        </div>
      </div>

      <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Nueva Parada de Entrega</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ubicación</Label>
                  <Select onValueChange={v => {
                    const sel = locationsList.find(l => l.id === v);
                    if (sel) setEditingStop({...editingStop, name: sel.data.name, address: sel.data.address?.street ? `${sel.data.address.street} ${sel.data.address.number}, ${sel.data.address.city}` : sel.data.address, lat: sel.data.address?.lat || sel.data.lat, lng: sel.data.address?.lng || sel.data.lng });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                    <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Peso Carga (KG)</Label>
                  <Input type="number" value={editingStop.weightKg} onChange={e => setEditingStop({...editingStop, weightKg: parseFloat(e.target.value) || 0})} />
                </div>
             </div>
             <div className="space-y-2"><Label>Dirección Final</Label><Input value={editingStop.address} onChange={e => setEditingStop({...editingStop, address: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={saveStop} className="bg-blue-600 w-full rounded-xl">ASIGNAR A RUTA</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
