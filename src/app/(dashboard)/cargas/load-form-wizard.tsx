
'use client';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc, updateDoc, query, where, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Package, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Calendar, Clock, DollarSign, Truck, 
  Users, Info, AlertTriangle, ShieldCheck, 
  Thermometer, Anchor, CheckCircle2, ChevronRight, ChevronLeft, Building2, Globe, FileText, Zap, Plus, Trash2, Repeat, MoveRight
} from "lucide-react";
import { Load, Truck as TruckType, Driver, Client, LoadDocument, Hub } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

const SERVICE_TYPES = [
  { id: 'standard', label: 'Carga General', icon: Package },
  { id: 'FTL', label: 'Carga Completa (FTL)', icon: Truck },
  { id: 'reefer', label: 'Refrigerado', icon: Thermometer },
  { id: 'dangerous', label: 'Carga Peligrosa', icon: AlertTriangle },
  { id: 'customs', label: 'Internacional / Aduana', icon: Globe },
];

export default function LoadFormWizard() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local state for remitos entry
  const [remitoNumber, setRemitoNumber] = useState("");
  const [remitoDetail, setRemitoDetail] = useState("");
  const [remitoHasCot, setRemitoHasCot] = useState(false);
  const [remitoCotNumber, setRemitoCotNumber] = useState("");
  const [remitoDespacho, setRemitoDespacho] = useState("");

  const [formData, setFormData] = useState<Partial<Load>>({
    orderNumber: "",
    serviceType: 'standard',
    clientName: "",
    isRoundTrip: false,
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "" },
    destination: { name: "", phone: "", contact: "", address: "", province: "CABA", country: "Argentina", zip: "", instructions: "" },
    pickupDate: "", pickupTimeFrom: "08:00", pickupTimeTo: "17:00",
    deliveryLimitDate: "", deliveryTimeFrom: "08:00", deliveryTimeTo: "17:00",
    description: "", classification: "Mercancías Generales", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet",
    returnCargoDescription: "", returnCargoWeightKg: 0,
    basePrice: 0, 
    totalTaxes: 0, totalAmount: 0,
    priority: "medium", status: "pending",
    documents: [],
    international: {
      operationType: 'export',
      exitCustoms: "Ezeiza",
      entryCustoms: "Santos (BR)",
      declarationNumber: "",
      micDtaNumber: "",
      containerNumber: "",
      sealNumber: "",
      transportDocType: 'BL',
      transportDocNumber: "",
      fobValueUsd: 0,
      freightValueUsd: 0,
      insuranceValueUsd: 0,
      cifValueUsd: 0,
      importDutiesUsd: 0,
      customsIvaUsd: 0,
      totalCustomsCostsUsd: 0,
      isMalvinaPresented: false
    }
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      orderNumber: `FL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    }));
  }, []);

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const hubsQuery = useMemo(() => db ? query(collection(db, "hubs"), orderBy("name")) : null, [db]);
  
  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);

  const locationsList = useMemo(() => {
    const list: { id: string, name: string, type: 'hub' | 'client', data: any }[] = [];
    hubs?.forEach(h => list.push({ id: h.id, name: `[HUB] ${h.name}`, type: 'hub', data: h }));
    clients?.forEach(c => list.push({ id: c.id, name: `[CLI] ${c.name}`, type: 'client', data: c }));
    return list;
  }, [hubs, clients]);

  const handleLocationSelect = (type: 'origin' | 'destination', id: string) => {
    const selection = locationsList.find(l => l.id === id);
    if (!selection) return;

    const locData = selection.data;
    const update = {
      id: selection.id,
      name: selection.name,
      address: locData.address || `${locData.address.street} ${locData.address.number}`,
      province: locData.province,
      city: locData.city,
      country: locData.country,
      phone: locData.phone || locData.mainContact?.phone || "",
      contact: locData.mainContact?.name || "",
      lat: locData.lat || locData.address?.lat,
      lng: locData.lng || locData.address?.lng,
    };

    setFormData(prev => ({
      ...prev,
      [type]: { ...prev[type], ...update }
    }));
  };

  const addRemito = () => {
    if (!remitoNumber) return;
    const newDoc: LoadDocument = {
      id: Math.random().toString(36).substring(7),
      type: 'remito',
      number: remitoNumber,
      notes: remitoDetail,
      hasCot: remitoHasCot,
      cotNumber: remitoHasCot ? remitoCotNumber : "",
      despachoNumber: remitoDespacho,
      uploadedAt: new Date().toISOString(),
      leg: 'outbound'
    };
    setFormData({
      ...formData,
      documents: [...(formData.documents || []), newDoc]
    });
    setRemitoNumber("");
    setRemitoDetail("");
    setRemitoHasCot(false);
    setRemitoCotNumber("");
    setRemitoDespacho("");
    toast({ title: "Documento agregado" });
  };

  const removeRemito = (id: string) => {
    setFormData({
      ...formData,
      documents: (formData.documents || []).filter(d => d.id !== id)
    });
  };

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const newRef = doc(collection(db, "loads"));
      await setDoc(newRef, {
        ...formData,
        id: newRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Carga Registrada", description: `Orden ${formData.orderNumber} creada.` });
      router.push('/cargas');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nueva Operación Logística</h1>
            <p className="text-sm text-slate-500">Gestión de fletes nacionales e internacionales.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
          {formData.orderNumber || ''}
        </Badge>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Gerais", icon: Info },
            { id: 2, label: "Ruta", icon: MapPin },
            { id: 3, label: "Carga", icon: Package },
            { id: 4, label: "Aduana", icon: Globe },
            { id: 5, label: "Financeiro", icon: DollarSign },
            { id: 6, label: "Asignación", icon: Truck }
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
              {s.id < 6 && <div className={cn("absolute top-4.5 left-1/2 w-full h-[1px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Configuración Inicial</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label>Cliente Principal</Label>
                  <Select value={formData.clientId} onValueChange={v => {
                    const c = clients?.find(cl => cl.id === v);
                    setFormData({...formData, clientId: v, clientName: c?.name || ""});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar dador" /></SelectTrigger>
                    <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <Label>Tipo de Servicio</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {SERVICE_TYPES.map(type => (
                      <button 
                        key={type.id} 
                        type="button" 
                        className={cn(
                          "flex flex-col items-center justify-center min-h-[80px] gap-2 p-2 rounded-xl border transition-all text-center",
                          formData.serviceType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                        )}
                        onClick={() => setFormData({...formData, serviceType: type.id as any})}
                      >
                        <type.icon size={18} />
                        <span className="text-[10px] sm:text-[11px] uppercase font-black leading-tight break-words px-1">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Planificación de Ruta</CardTitle>
              <CardDescription>Defina el origen y destino seleccionando puntos de su red o cargue manualmente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-blue-600" /> Origen de Carga
                  </div>
                  <Select onValueChange={(id) => handleLocationSelect('origin', id)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar sede o cliente" /></SelectTrigger>
                    <SelectContent>
                      {locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-xl border border-dashed">
                    <Input placeholder="Dirección Exacta" value={formData.origin?.address || ""} onChange={e => setFormData({...formData, origin: {...formData.origin!, address: e.target.value}})} />
                    <div className="grid grid-cols-2 gap-2">
                       <Select value={formData.origin?.province} onValueChange={v => setFormData({...formData, origin: {...formData.origin!, province: v}})}>
                         <SelectTrigger><SelectValue placeholder="Provincia" /></SelectTrigger>
                         <SelectContent>{PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                       </Select>
                       <Input placeholder="Ciudad" value={formData.origin?.city || ""} onChange={e => setFormData({...formData, origin: {...formData.origin!, city: e.target.value}})} />
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white border rounded-full items-center justify-center text-slate-300 z-10 shadow-sm">
                   <MoveRight size={20} />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-green-600" /> Destino Final
                  </div>
                  <Select onValueChange={(id) => handleLocationSelect('destination', id)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar sede o cliente" /></SelectTrigger>
                    <SelectContent>
                      {locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-xl border border-dashed">
                    <Input placeholder="Dirección Exacta" value={formData.destination?.address || ""} onChange={e => setFormData({...formData, destination: {...formData.destination!, address: e.target.value}})} />
                    <div className="grid grid-cols-2 gap-2">
                       <Select value={formData.destination?.province} onValueChange={v => setFormData({...formData, destination: {...formData.destination!, province: v}})}>
                         <SelectTrigger><SelectValue placeholder="Provincia" /></SelectTrigger>
                         <SelectContent>{PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                       </Select>
                       <Input placeholder="Ciudad" value={formData.destination?.city || ""} onChange={e => setFormData({...formData, destination: {...formData.destination!, city: e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Repeat className={cn("transition-colors", formData.isRoundTrip ? "text-blue-600" : "text-slate-300")} />
                  <div className="space-y-0.5">
                    <Label>Viaje con Retorno (Round-Trip)</Label>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Habilita la carga de mercadería para la vuelta</p>
                  </div>
                </div>
                <Switch checked={formData.isRoundTrip} onCheckedChange={v => setFormData({...formData, isRoundTrip: v})} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Carga de Ida</CardTitle>
                  <CardDescription>Detalle de la mercadería para el tramo principal.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 uppercase">{formData.origin?.province} → {formData.destination?.province}</Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                     <Label>Descripción Mercadería (Ida)</Label>
                     <Textarea 
                      placeholder="Ej: Pallets de productos alimenticios..."
                      value={formData.description || ''} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                     />
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Peso (Kg)</Label><Input type="number" value={formData.weightKg || ''} onChange={e => setFormData({...formData, weightKg: parseFloat(e.target.value) || 0})} /></div>
                        <div className="space-y-1"><Label>Volumen (m³)</Label><Input type="number" value={formData.volumeM3 || ''} onChange={e => setFormData({...formData, volumeM3: parseFloat(e.target.value) || 0})} /></div>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <Label className="text-blue-600 font-bold flex items-center gap-2"><FileText size={14} /> Documentación de Ida</Label>
                     <div className="p-4 bg-slate-50 rounded-xl border border-dashed space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                           <Input placeholder="N° Remito" className="bg-white h-8 text-sm" value={remitoNumber} onChange={e => setRemitoNumber(e.target.value)} />
                           <Button type="button" size="sm" className="h-8 bg-blue-600" onClick={addRemito} disabled={!remitoNumber}><Plus size={14} /></Button>
                        </div>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                           {formData.documents?.filter(d => d.leg === 'outbound').map(doc => (
                             <div key={doc.id} className="flex items-center justify-between p-2 bg-white border rounded text-[10px]">
                                <span className="font-bold">Remito: {doc.number}</span>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => removeRemito(doc.id)}><Trash2 size={10}/></Button>
                             </div>
                           ))}
                        </div>
                     </div>
                   </div>
                 </div>

                 {formData.isRoundTrip && (
                   <div className="pt-6 border-t space-y-6">
                      <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-widest">
                         <Repeat size={14} /> Mercadería de Retorno (Vuelta)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                           <Label>Descripción de Carga (Vuelta)</Label>
                           <Textarea 
                            placeholder="Ej: Devolución de envases o carga consolidada..."
                            value={formData.returnCargoDescription || ''} 
                            onChange={e => setFormData({...formData, returnCargoDescription: e.target.value})} 
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4 h-fit self-end">
                           <div className="space-y-1"><Label>Peso Vuelta (Kg)</Label><Input type="number" value={formData.returnCargoWeightKg || ''} onChange={e => setFormData({...formData, returnCargoWeightKg: parseFloat(e.target.value) || 0})} /></div>
                           <div className="space-y-1"><Label>Volumen Vuelta (m³)</Label><Input type="number" value={formData.returnCargoVolumeM3 || ''} onChange={e => setFormData({...formData, returnCargoVolumeM3: parseFloat(e.target.value) || 0})} /></div>
                        </div>
                      </div>
                   </div>
                 )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Anchor className="text-blue-600" /> Trámites de Aduana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-1">
                   <Label className="text-[10px] uppercase font-bold">Tipo Operación</Label>
                   <Select value={formData.international?.operationType} onValueChange={v => setFormData({...formData, international: {...formData.international!, operationType: v as any}})}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="export">Exportación</SelectItem>
                       <SelectItem value="import">Importación</SelectItem>
                       <SelectItem value="transit">Trânsito</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <Label className="text-[10px] uppercase font-bold text-slate-400">Aduana Salida</Label>
                   <Input value={formData.international?.exitCustoms} onChange={e => setFormData({...formData, international: {...formData.international!, exitCustoms: e.target.value}})} />
                 </div>
                 <div className="space-y-1">
                   <Label className="text-[10px] uppercase font-bold">N° Declaración (SIM)</Label>
                   <Input value={formData.international?.declarationNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, declarationNumber: e.target.value}})} />
                 </div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-900 text-white">
              <div className="flex justify-between items-center">
                <CardTitle>Aspecto Financeiro</CardTitle>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-white/50">Total Final (ARS)</p>
                  <p className="text-2xl font-bold text-green-400">${formData.totalAmount?.toLocaleString() || '0'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Precio Base / Flete (Ida)</Label>
                    <Input type="number" value={formData.basePrice || ''} onChange={e => setFormData({...formData, basePrice: parseFloat(e.target.value) || 0, totalAmount: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Anticipo para el Chofer (Viáticos)</Label>
                    <Input type="number" value={formData.budget?.initialAdvance || ''} onChange={e => setFormData({...formData, budget: {...formData.budget!, initialAdvance: parseFloat(e.target.value) || 0}})} />
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Asignación de Unidad</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Zap className="text-blue-600 mt-1" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-900">Verificación de Capacidad</p>
                    <p className="text-[10px] text-blue-700">Asegúrese de asignar una unidad que soporte el peso acumulado de {formData.weightKg + (formData.returnCargoWeightKg || 0)} Kg si realiza el retorno cargado.</p>
                  </div>
               </div>
            </CardContent>
            <CardFooter className="flex justify-end">
               <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                 Confirmar y Registrar Flete
               </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : router.back()}>
            <ChevronLeft size={16} className="mr-1" /> Voltar
          </Button>
          <div className="flex gap-2">
            {step < 6 ? (
              <Button onClick={() => setStep(step + 1)} className="bg-blue-600 min-w-[120px]">
                Próximo <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-blue-600 min-w-[120px]" disabled={isSubmitting}>
                Finalizar <ChevronRight size={16} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
