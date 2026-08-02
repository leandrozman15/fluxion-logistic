
'use client';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, setDoc, query, orderBy, updateDoc, limit, getDocs, where, writeBatch } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Package, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Calendar, Clock, DollarSign, Truck, 
  Info, AlertTriangle, FileText, Zap, Plus, Trash2, Repeat, MoveRight, CheckCircle2, ChevronRight, ChevronLeft, LayoutGrid, UserCheck, Edit, TrendingUp, CreditCard, Anchor, Scale, ListOrdered, ShieldCheck, Ship, ScanBarcode, X, Receipt, Files, HandCoins, Landmark, ShoppingBag
} from "lucide-react";
import { Load, Client, Hub, LoadLegStop, LoadDocument, LoadDocType, Truck as TruckType, Driver, Tenant, PendingRemito } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { logSystemEvent } from "@/lib/audit-service";

const SERVICE_TYPES = [
  { id: 'standard', label: 'Carga General', icon: Package },
  { id: 'FTL', label: 'Carga Completa (FTL)', icon: Truck },
  { id: 'meli', label: 'Mercado Libre', icon: ShoppingBag },
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
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedRemitoIds, setSelectedRemitoIds] = useState<string[]>([]);
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
    isRoundTrip: false,
    pickupDate: format(new Date(), "yyyy-MM-dd"),
    pickupTime: "08:00",
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "", dockName: "" },
    returnDestination: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "", dockName: "" },
    outboundStops: [],
    returnStops: [],
    assignedCompanionIds: [],
    totalAmount: 0,
    status: "pending",
    international: { containerNumber: "", sealNumber: "" },
    budget: { initialAdvance: 0, totalBudget: 0, categories: {} },
    tracking: { currentLat: 0, currentLng: 0, currentSpeed: 0, avgSpeed: 0, maxSpeed: 0, distanceTraveledKm: 0, distanceRemainingKm: 0, timeOnRouteMinutes: 0, timeStoppedMinutes: 0, lastUpdateAt: null, history: [], alerts: [] }
  });

  const handleBack = () => setStep(prev => Math.max(1, prev - 1));
  
  const handleNext = () => {
    if (step === 1) {
      if (!formData.assignedTruckId) return toast({ variant: "destructive", title: "Asignación Requerida", description: "Debe seleccionar un Camión para el flete." });
      if (!formData.assignedDriverId || formData.assignedDriverId === 'none') return toast({ variant: "destructive", title: "Asignación Requerida", description: "Debe asignar un Chofer Profesional." });
    }
    if (step === 2) {
      if (!formData.origin?.id) return toast({ variant: "destructive", title: "Datos de Salida", description: "Debe elegir un Punto de Origen." });
      if (!formData.pickupDate) return toast({ variant: "destructive", title: "Datos de Salida", description: "La fecha de carga es obligatoria." });
    }
    setStep(prev => Math.min(5, prev + 1));
  };

  const loadRef = useMemo(() => loadId && db && tenantId ? doc(db, "tenants", tenantId, "loads", loadId) : null, [db, tenantId, loadId]);
  const { data: existingLoad, loading: loadingExisting } = useDoc<Load>(loadRef);

  useEffect(() => {
    if (existingLoad) {
      setFormData({
        ...existingLoad,
        outboundStops: existingLoad.outboundStops || [],
        returnStops: existingLoad.returnStops || [],
        assignedCompanionIds: existingLoad.assignedCompanionIds || [],
        budget: existingLoad.budget || { initialAdvance: 0, totalBudget: 0, categories: {} }
      });
      const remitoIds: string[] = [];
      existingLoad.outboundStops?.forEach(s => {
        s.documents?.forEach(d => {
          if (d.pendingRemitoId) remitoIds.push(d.pendingRemitoId);
        });
      });
      setSelectedRemitoIds(remitoIds);
    }
  }, [existingLoad]);

  const trucksQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "trucks"), orderBy("plate")) : null, [db, tenantId]);
  const driversQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "drivers"), orderBy("lastName")) : null, [db, tenantId]);
  const clientsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "clients"), orderBy("name")) : null, [db, tenantId]);
  const hubsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "hubs"), orderBy("name")) : null, [db, tenantId]);
  const remitosQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "pending_remitos"), where("status", "in", ["pending", "dispatched"])) : null, [db, tenantId]);

  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const { data: personnel } = useCollection<Driver>(driversQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: allRemitos } = useCollection<PendingRemito>(remitosQuery);

  const remitos = useMemo(() => {
    return allRemitos?.filter(r => r.status === 'pending' || r.loadId === loadId) || [];
  }, [allRemitos, loadId]);

  const driversOnly = useMemo(() => personnel?.filter(d => d.role === 'driver' || !d.role) || [], [personnel]);
  const companionsOnly = useMemo(() => personnel?.filter(d => d.role === 'companion') || [], [personnel]);

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
    
    // AUTO-COMPLETAR CHOFER Y ACOMPAÑANTES BASADO EN ASIGNACIÓN DE CAMIÓN
    setFormData(prev => ({
      ...prev,
      assignedTruckId: id,
      assignedDriverId: truck.assignedDriverId && truck.assignedDriverId !== 'none' ? truck.assignedDriverId : prev.assignedDriverId,
      assignedCompanionIds: truck.assignedCompanionIds && truck.assignedCompanionIds.length > 0 
        ? truck.assignedCompanionIds 
        : prev.assignedCompanionIds
    }));
    
    if (truck.assignedDriverId && truck.assignedDriverId !== 'none') {
      toast({ title: "Asignación Automática", description: "Se han cargado los recursos vinculados a la unidad." });
    }
  };

  const handleAddCompanion = (id: string) => {
    if (id === 'none') return;
    const current = formData.assignedCompanionIds || [];
    if (!current.includes(id)) {
      setFormData(prev => ({ ...prev, assignedCompanionIds: [...current, id] }));
    }
  };

  const removeCompanion = (cid: string) => {
    setFormData(prev => ({ 
      ...prev, 
      assignedCompanionIds: (prev.assignedCompanionIds || []).filter(id => id !== cid) 
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

  const handleToggleRemito = (remitoId: string) => {
    const isSelected = selectedRemitoIds.includes(remitoId);
    const remito = remitos?.find(r => r.id === remitoId);
    
    if (!remito) return;

    if (isSelected) {
      setSelectedRemitoIds(prev => prev.filter(id => id !== remitoId));
      setFormData(prev => ({
        ...prev,
        outboundStops: prev.outboundStops?.filter(s => !s.documents.some(d => d.pendingRemitoId === remitoId))
      }));
    } else {
      setSelectedRemitoIds(prev => [...prev, remitoId]);
      
      const newStop: LoadLegStop = {
        id: Math.random().toString(36).substring(7),
        name: remito.clientName,
        address: remito.address,
        province: remito.province || "",
        city: remito.city || "",
        country: "Argentina",
        contact: "",
        phone: "",
        lat: remito.lat,
        lng: remito.lng,
        description: `Entrega Remito #${remito.number}`,
        weightKg: remito.weightKg,
        volumeM3: remito.volumeM3 || 0,
        units: remito.items?.reduce((acc, i) => acc + i.quantity, 0) || 1,
        unitType: "Bultos",
        documents: [{
          id: Math.random().toString(36).substring(7),
          type: 'remito',
          number: remito.number,
          pendingRemitoId: remito.id,
          cotNumber: remito.cotNumber,
          fileUrl: remito.fileUrl,
          uploadedAt: new Date().toISOString(),
          leg: 'outbound'
        }]
      };

      setFormData(prev => ({
        ...prev,
        outboundStops: [...(prev.outboundStops || []), newStop]
      }));
    }
  };

  const saveStop = () => {
    const stop = { ...editingStop, id: editingStop.id || Math.random().toString(36).substring(7) } as LoadLegStop;
    const field = activeLeg === 'outbound' ? 'outboundStops' : 'returnStops';
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []).filter(s => s.id !== stop.id), stop] }));
    setIsStopModalOpen(false);
    setEditingStop({ id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "", description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: [], dockName: "" });
  };

  const handleSubmit = async () => {
    if (!db || !tenantId) return;
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      let finalLoadId = loadId;
      let finalOrderNumber = formData.orderNumber;

      if (!finalOrderNumber) {
        const loadsSnap = await getDocs(query(collection(db, "tenants", tenantId, "loads"), orderBy("orderNumber", "desc"), limit(1)));
        let nextSeq = 1;
        if (!loadsSnap.empty) {
          const lastOrderStr = (loadsSnap.docs[0].data() as Load).orderNumber;
          const parts = lastOrderStr.split("-");
          const lastNum = parseInt(parts[parts.length - 1]);
          if (!isNaN(lastNum)) nextSeq = lastNum + 1;
        }
        const prefix = formData.serviceType === 'meli' ? 'ML' : 'FL';
        finalOrderNumber = `${prefix}-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
      }
      
      const cleanFormData = {
        ...formData,
        orderNumber: finalOrderNumber,
        clientName: formData.clientName || (formData.serviceType === 'meli' ? "Mercado Libre" : (formData.outboundStops?.[0]?.name || "Reparto Multi-Remito")),
        updatedAt: serverTimestamp()
      };

      if (!loadId) {
        const newRef = doc(collection(db, "tenants", tenantId, "loads"));
        finalLoadId = newRef.id;
        batch.set(newRef, { ...cleanFormData, id: finalLoadId, createdAt: serverTimestamp() });
        if (user) await logSystemEvent(db, tenantId, user, 'create', 'load', finalLoadId, { orderNumber: finalOrderNumber });
      } else {
        batch.update(doc(db, "tenants", tenantId, "loads", loadId), cleanFormData);
        if (user) await logSystemEvent(db, tenantId, user, 'update', 'load', loadId, { orderNumber: finalOrderNumber });
      }

      for (const rid of selectedRemitoIds) {
        batch.update(doc(db, "tenants", tenantId, "pending_remitos", rid), {
          status: 'dispatched',
          loadId: finalLoadId,
          dispatchedDate: formData.pickupDate,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      toast({ title: "Flete Guardado", description: `Orden ${finalOrderNumber} emitida con éxito.` });
      router.push('/cargas');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al guardar", description: e.message });
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
            <p className="text-sm text-slate-500">Gestión de pesos e itinerario COMEX.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Label className="text-[10px] font-black uppercase text-slate-400">N° Orden:</Label>
           <Input 
             className="w-40 font-mono font-black h-9 text-blue-600 bg-blue-50 border-blue-100" 
             placeholder="Auto-Generar" 
             value={formData.orderNumber ?? ''} 
             onChange={e => setFormData({...formData, orderNumber: e.target.value.toUpperCase()})}
           />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-[600px]">
          {[
            { id: 1, label: "Recursos", icon: Truck },
            { id: 2, label: "Hoja Ruta", icon: ListOrdered },
            { id: 3, label: "Retorno", icon: Repeat },
            { id: 4, label: "Puerto / Comex", icon: Ship },
            { id: 5, label: "Cierre", icon: ShieldCheck }
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
                step > s.id ? "bg-green-50 text-white" : step === s.id ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 text-slate-300 border"
              )}>
                {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
              </div>
              <span className={cn("text-[9px] font-black uppercase text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>
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
               <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {SERVICE_TYPES.map(type => (
                    <button key={type.id} onClick={() => setFormData({...formData, serviceType: type.id as any})} className={cn("p-4 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all", formData.serviceType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-400 border-slate-100 hover:border-blue-200")}><type.icon size={24} /><span className="text-[10px] font-black uppercase text-center leading-tight">{type.label}</span></button>
                  ))}
               </CardContent>
            </Card>

            <Card className={cn("border-none shadow-xl transition-all duration-300", isWeightLimitExceeded ? "bg-red-600 text-white" : "bg-slate-900 text-white")}>
               <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center"><Scale size={32} className={cn(isWeightLimitExceeded ? "text-white animate-pulse" : "text-blue-400")} /></div>
                     <div className="space-y-1"><p className="text-[10px] uppercase font-bold opacity-50 tracking-widest">Peso Bruto Estimado</p><p className="text-4xl font-black italic">{currentTotalWeight.toLocaleString()} <span className="text-sm font-normal opacity-50">KG</span></p></div>
                  </div>
                  {selectedTruck && <div className="text-center md:text-right space-y-1"><p className="text-[10px] uppercase font-bold opacity-50">Carga Máxima Unidad</p><p className={cn("text-2xl font-black italic", isWeightLimitExceeded ? "text-white underline decoration-wavy" : "text-green-400")}>{selectedTruck.capacityKg.toLocaleString()} KG</p></div>}
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Asignación de Activos y Personal</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Unidad de Tracción</Label>
                    <Select value={formData.assignedTruckId ?? ''} onValueChange={handleTruckSelect}>
                      <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Elegir Camión" /></SelectTrigger>
                      <SelectContent>{trucks?.map(t => <SelectItem key={t.id} value={t.id}>{t.plate} ({(t.capacityKg/1000).toFixed(1)}tn útil)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Chofer Profesional</Label>
                    <Select value={formData.assignedDriverId ?? ''} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                      <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Elegir Chofer" /></SelectTrigger>
                      <SelectContent>{driversOnly.map(d => <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t">
                  <Label>Acompañantes / Ayudantes</Label>
                  <Select onValueChange={handleAddCompanion}>
                    <SelectTrigger className="bg-white h-12"><SelectValue placeholder="Agregar Acompañante..." /></SelectTrigger>
                    <SelectContent>{companionsOnly.map(d => <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {formData.assignedCompanionIds?.map(cid => {
                      const dr = companionsOnly.find(c => c.id === cid);
                      return (<Badge key={cid} variant="secondary" className="pl-2 pr-1 py-1 gap-2 bg-blue-50 text-blue-700 border-blue-100">{dr ? `${dr.lastName}, ${dr.firstName[0]}.` : cid}<button onClick={() => removeCompanion(cid)} className="hover:text-red-500"><X size={12} /></button></Badge>);
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader className="bg-slate-900 text-white py-4"><CardTitle className="text-sm flex items-center gap-2"><MapPin size={16} className="text-blue-400" /> 1. Origen / Despacho</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-blue-600">Punto de Presentación</Label>
                    <Select onValueChange={handleOriginSelect} value={formData.origin?.id ?? ''}>
                      <SelectTrigger className="bg-slate-50 h-12 rounded-xl"><SelectValue placeholder="Elegir Sede o Planta de Carga" /></SelectTrigger>
                      <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-400">Fecha Carga</Label><Input type="date" value={formData.pickupDate ?? ''} onChange={e => setFormData({...formData, pickupDate: e.target.value})} /></div>
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-400">Hora</Label><Input type="time" value={formData.pickupTime ?? ''} onChange={e => setFormData({...formData, pickupTime: e.target.value})} /></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between py-4 border-b">
                  <CardTitle className="text-sm flex items-center gap-2"><ListOrdered size={16} className="text-blue-600" /> 2. Secuencia de Entregas</CardTitle>
                  <Button size="sm" className="bg-blue-600 rounded-full h-8" onClick={() => { setActiveLeg('outbound'); setIsStopModalOpen(true); }}><Plus size={14} className="mr-1" /> PARADA MANUAL</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {formData.outboundStops?.length === 0 ? (
                      <div className="p-20 text-center text-slate-300 italic text-xs font-bold uppercase tracking-widest">
                        {formData.serviceType === 'meli' 
                          ? "Canal Mercado Libre: El chofer escaneará los bultos en destino." 
                          : "No hay destinos asignados. Seleccione remitos o cargue una parada manual."}
                      </div>
                    ) : (
                      formData.outboundStops?.map((stop, idx) => (
                        <div key={stop.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs border shadow-inner">{idx + 1}</div>
                            <div>
                               <p className="font-black text-sm text-slate-800 uppercase leading-none">{stop.name}</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1"><MapPin size={10}/> {stop.address}</p>
                               <div className="flex gap-1.5 mt-1">
                                  {stop.documents.map(doc => (
                                    <Badge key={doc.id} variant="outline" className="bg-blue-50 text-blue-700 text-[7px] h-3 px-1 border-blue-200">REM {doc.number}</Badge>
                                  ))}
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="text-right"><p className="text-xs font-black text-slate-900">{stop.weightKg.toLocaleString()} KG</p><p className="text-[8px] text-slate-400 uppercase font-black">Carga Declarada</p></div>
                             <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => {
                               const rid = stop.documents[0]?.pendingRemitoId;
                               if (rid) setSelectedRemitoIds(prev => prev.filter(id => id !== rid));
                               setFormData(prev => ({ ...prev, outboundStops: (prev.outboundStops || []).filter(s => s.id !== stop.id) }));
                             }}><Trash2 size={16} /></Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm overflow-hidden h-fit">
                <CardHeader className="bg-indigo-600 text-white py-4">
                  <CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2"><Receipt size={16} /> Remitos Disponibles</CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                  <div className="divide-y divide-slate-100">
                    {remitos?.length === 0 ? (
                      <div className="p-10 text-center space-y-2">
                        <Files size={32} className="mx-auto text-slate-200" />
                        <p className="text-[10px] font-black text-slate-300 uppercase italic">Buzón de remitos vacío</p>
                      </div>
                    ) : (
                      remitos?.map(remito => (
                        <div 
                          key={remito.id} 
                          className={cn("p-4 flex items-start gap-3 cursor-pointer hover:bg-indigo-50/50 transition-colors", selectedRemitoIds.includes(remito.id) && "bg-indigo-50")}
                          onClick={() => handleToggleRemito(remito.id)}
                        >
                          <Checkbox checked={selectedRemitoIds.includes(remito.id)} className="mt-1" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-900 uppercase leading-none">REM {remito.number}</p>
                            <p className="text-[10px] font-black text-indigo-700 truncate mt-1 uppercase">{remito.clientName}</p>
                            <div className="flex items-center justify-between mt-2">
                               <p className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[100px] flex items-center gap-1"><MapPin size={8}/> {remito.city}</p>
                               <Badge className="bg-slate-900 text-white border-none text-[8px] h-3 px-1">{remito.weightKg} KG</Badge>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t py-3 flex justify-between">
                   <p className="text-[9px] font-black uppercase text-slate-400 italic">Vincular remitos para automatizar destinos</p>
                </CardFooter>
              </Card>

              <div className="p-5 bg-blue-50 border-2 border-blue-100 rounded-3xl flex items-start gap-4">
                 <Zap size={24} className="text-blue-600 shrink-0 mt-1" />
                 <div className="space-y-1">
                    <p className="text-xs font-black text-blue-800 uppercase italic">Planificación Inteligente</p>
                    <p className="text-[10px] text-blue-600 leading-relaxed font-medium">Al seleccionar remitos del buzón, el sistema calcula automáticamente el peso bruto y vincula la documentación para el chofer.</p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
           <Card className="border-none shadow-sm">
             <CardHeader><CardTitle>Retorno / Fin de Jornada</CardTitle></CardHeader>
             <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-orange-50/50 border border-orange-100 rounded-2xl"><div className="space-y-0.5"><Label className="text-xs font-black uppercase text-orange-700">Viaje de Ida y Vuelta</Label><p className="text-[10px] text-orange-600 font-bold uppercase">Habilitar paradas de recolección en el retorno</p></div><Switch checked={formData.isRoundTrip ?? false} onCheckedChange={v => setFormData({...formData, isRoundTrip: v})} /></div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><Label className="text-xs font-black uppercase text-slate-400">Recolecciones de Retorno</Label><Button size="sm" variant="outline" className="text-orange-600 border-orange-200 rounded-full" onClick={() => { setActiveLeg('return'); setIsStopModalOpen(true); }}><Plus size={14} className="mr-1" /> AGREGAR RETORNO</Button></div>
                  <div className="space-y-3">
                    {formData.returnStops?.map((stop, idx) => (
                      <div key={stop.id} className="p-4 bg-white border border-orange-100 rounded-2xl shadow-sm flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div><div><p className="font-bold text-sm">{stop.name}</p><p className="text-[10px] text-slate-400">{stop.weightKg} KG • {stop.address}</p></div></div><Button variant="ghost" size="icon" className="text-red-500" onClick={() => setFormData(prev => ({ ...prev, returnStops: (prev.returnStops || []).filter(s => s.id !== stop.id) }))}><Trash2 size={16} /></Button></div>
                    ))}
                  </div>
                </div>
             </CardContent>
           </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Ship className="text-blue-600" /> Operativa Aduanera / Puerto</CardTitle><CardDescription>Datos del contenedor y documentación.</CardDescription></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><Label className="flex items-center gap-2"><ScanBarcode size={14} className="text-blue-500" /> N° de Contenedor</Label><Input placeholder="Ej: MEDU 123456-7" value={formData.international?.containerNumber ?? ''} onChange={e => setFormData({...formData, international: {...formData.international!, containerNumber: e.target.value.toUpperCase()}})} /></div><div className="space-y-2"><Label>N° de Precinto</Label><Input placeholder="Ej: 009876" value={formData.international?.sealNumber ?? ''} onChange={e => setFormData({...formData, international: {...formData.international!, sealNumber: e.target.value}})} /></div></CardContent></Card>
        )}

        {step === 5 && (
          <div className="space-y-6">
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
                        <span className="text-lg font-black text-slate-800">{(currentTotalWeight || 0).toLocaleString()} KG</span>
                      </div>
                      {selectedTruck && (
                        <>
                          <div className="flex justify-between items-center border-t pt-4">
                            <span className="text-xs font-bold text-slate-500">Carga Máxima:</span>
                            <span className="text-lg font-black text-green-600">{(selectedTruck.capacityKg || 0).toLocaleString()} KG</span>
                          </div>
                          <Progress value={Math.min(100, (currentTotalWeight / (selectedTruck.capacityKg || 1)) * 100)} className={cn("h-2", isWeightLimitExceeded ? "bg-red-200" : "bg-slate-200")} />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-slate-400">Gestión Financiera de Viaje</p>
                    <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-3xl space-y-4">
                       <div className="space-y-2">
                          <Label className="text-xs font-bold text-blue-700 flex items-center gap-2">
                             <HandCoins size={14} /> Anticipo Otorgado (Efectivo/Caja)
                          </Label>
                          <div className="relative">
                             <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-blue-400" />
                             <Input 
                                type="number" 
                                className="pl-9 h-12 bg-white border-blue-200 font-black text-lg text-blue-900 rounded-xl"
                                placeholder="0"
                                value={formData.budget?.initialAdvance ?? 0}
                                onChange={e => setFormData({
                                  ...formData, 
                                  budget: {
                                    ...(formData.budget || { initialAdvance: 0, totalBudget: 0, categories: {} }),
                                    initialAdvance: parseFloat(e.target.value) || 0
                                  }
                                })}
                             />
                          </div>
                          <p className="text-[9px] text-blue-400 italic">Este monto se descontará automáticamente en la rendición final del viaje.</p>
                       </div>
                       
                       <div className="pt-2 border-t border-blue-100">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase">
                             <Landmark size={12} /> Proyección Contable
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 border-t flex justify-end">
                <Button onClick={handleSubmit} className={cn("h-14 px-10 rounded-2xl font-black text-lg", isWeightLimitExceeded ? "bg-slate-300" : "bg-green-600 shadow-xl")} disabled={isSubmitting || isWeightLimitExceeded}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                  {loadId ? 'GUARDAR CAMBIOS' : 'EMITIR ORDEN'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
            <ChevronLeft size={16} className="mr-1" /> VOLVER
          </Button>
          {step < 5 ? (
            <Button onClick={handleNext} className="bg-blue-600">
              SIGUIENTE <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting || isWeightLimitExceeded}>
              EMITIR ORDEN <Save size={16} className="ml-2" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Nueva Parada Manual</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Ubicación</Label><Select onValueChange={v => { const sel = locationsList.find(l => l.id === v); if (sel) setEditingStop({...editingStop, name: sel.data.name, address: sel.data.address?.street ? `${sel.data.address.street} ${sel.data.address.number}, ${sel.data.address.city}` : sel.data.address, lat: sel.data.address?.lat || sel.data.lat, lng: sel.data.address?.lng || sel.data.lng }); }}><SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger><SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Peso Carga (KG)</Label><Input type="number" value={editingStop.weightKg ?? 0} onChange={e => setEditingStop({...editingStop, weightKg: parseFloat(e.target.value) || 0})} /></div></div><div className="space-y-2"><Label>Dirección Final</Label><Input value={editingStop.address ?? ''} onChange={e => setEditingStop({...editingStop, address: e.target.value})} /></div></div>
          <DialogFooter><Button onClick={saveStop} className="bg-blue-600 w-full rounded-xl">ASIGNAR A RUTA</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
