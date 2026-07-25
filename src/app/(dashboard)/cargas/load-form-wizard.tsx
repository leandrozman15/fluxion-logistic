
'use client';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc, query, orderBy } from "firebase/firestore";
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
  Info, AlertTriangle, Globe, FileText, Zap, Plus, Trash2, Repeat, MoveRight, CheckCircle2, ChevronRight, ChevronLeft, Map, Upload
} from "lucide-react";
import { Load, Client, Hub, LoadLegStop, LoadDocument, LoadDocType } from "@/app/lib/types";
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
  { id: 'reefer', label: 'Refrigerado', icon: Package },
  { id: 'dangerous', label: 'Carga Peligrosa', icon: AlertTriangle },
  { id: 'customs', label: 'Internacional / Aduana', icon: Globe },
];

export default function LoadFormWizard() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stop Modal State
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [activeLeg, setActiveLeg] = useState<'outbound' | 'return'>('outbound');
  const [editingStop, setEditingStop] = useState<Partial<LoadLegStop>>({
    id: "", name: "", address: "", province: "Buenos Aires", country: "Argentina", contact: "", phone: "",
    description: "", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet", documents: []
  });

  // Remito Sub-modal state
  const [newDoc, setNewDoc] = useState<Partial<LoadDocument>>({ type: 'remito', number: '', hasCot: false, cotNumber: '', despachoNumber: '' });

  const [formData, setFormData] = useState<Partial<Load>>({
    orderNumber: "",
    serviceType: 'standard',
    clientName: "",
    isRoundTrip: false,
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "" },
    outboundStops: [],
    returnStops: [],
    basePrice: 0, 
    totalAmount: 0,
    status: "pending",
    international: {
      operationType: 'export', exitCustoms: "Ezeiza", entryCustoms: "", declarationNumber: "", micDtaNumber: "",
      containerNumber: "", sealNumber: "", transportDocType: 'BL', transportDocNumber: "",
      fobValueUsd: 0, freightValueUsd: 0, insuranceValueUsd: 0, cifValueUsd: 0,
      importDutiesUsd: 0, customsIvaUsd: 0, totalCustomsCostsUsd: 0, isMalvinaPresented: false
    },
    budget: { initialAdvance: 0, totalBudget: 0, categories: {} }
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
    const list: any[] = [];
    hubs?.forEach(h => list.push({ id: h.id, name: `[HUB] ${h.name}`, type: 'hub', data: h }));
    clients?.forEach(c => list.push({ id: c.id, name: `[CLI] ${c.name}`, type: 'client', data: c }));
    return list;
  }, [hubs, clients]);

  const handleOriginSelect = (id: string) => {
    const selection = locationsList.find(l => l.id === id);
    if (!selection) return;
    const locData = selection.data;
    setFormData(prev => ({
      ...prev,
      origin: {
        ...prev.origin!,
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
      name: selection.name,
      address: locData.address || `${locData.address.street} ${locData.address.number}`,
      province: locData.province,
      city: locData.city,
      country: locData.country,
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
      uploadedAt: new Date().toISOString(),
      leg: activeLeg
    };
    setEditingStop(prev => ({ ...prev, documents: [...(prev.documents || []), docObj] }));
    setNewDoc({ type: 'remito', number: '', hasCot: false, cotNumber: '', despachoNumber: '' });
  };

  const saveStop = () => {
    if (!editingStop.name || !editingStop.address) return;
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

  const totalWeight = useMemo(() => {
    const outbound = formData.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0;
    const retour = formData.returnStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0;
    return outbound + retour;
  }, [formData]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nueva Operación Logística</h1>
            <p className="text-sm text-slate-500">Gestión de fletes con múltiples destinos.</p>
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
            { id: 2, label: "Logística Ida", icon: MoveRight },
            { id: 3, label: "Vuelta (Retorno)", icon: Repeat },
            { id: 4, label: "Aduana", icon: Globe },
            { id: 5, label: "Financeiro", icon: DollarSign },
            { id: 6, label: "Finalizar", icon: CheckCircle2 }
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
              <div className="space-y-4">
                <Label>Tipo de Servicio</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {SERVICE_TYPES.map(type => (
                    <button 
                      key={type.id} 
                      className={cn(
                        "flex flex-col items-center justify-center min-h-[80px] gap-2 p-2 rounded-xl border transition-all text-center",
                        formData.serviceType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                      )}
                      onClick={() => setFormData({...formData, serviceType: type.id as any})}
                    >
                      <type.icon size={18} />
                      <span className="text-[10px] uppercase font-black">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Repeat className={cn("transition-colors", formData.isRoundTrip ? "text-blue-600" : "text-slate-300")} />
                  <div className="space-y-0.5">
                    <Label>Habilitar Viaje de Retorno</Label>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Permite cargar mercadería para la vuelta</p>
                  </div>
                </div>
                <Switch checked={formData.isRoundTrip} onCheckedChange={v => setFormData({...formData, isRoundTrip: v})} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Logística de Ida</CardTitle>
                <CardDescription>Establezca el punto de carga inicial y todos los puntos de descarga.</CardDescription>
              </div>
              <Button size="sm" className="bg-blue-600" onClick={() => { setActiveLeg('outbound'); setIsStopModalOpen(true); }}><Plus size={14} className="mr-1" /> Agregar Destino</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-blue-600" /> Punto de Carga Inicial (Origen)
                </div>
                <Select onValueChange={handleOriginSelect}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar origen (Sede/Cliente)" /></SelectTrigger>
                  <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                </Select>
                {formData.origin?.name && (
                  <div className="text-[10px] font-bold text-slate-500 uppercase px-1">
                    {formData.origin.address}, {formData.origin.province}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase font-bold text-slate-400">Hoja de Ruta: Ida (Entregas)</Label>
                {formData.outboundStops?.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-xs text-slate-400 italic">No hay destinos agregados.</div>
                ) : (
                  formData.outboundStops?.map((stop, idx) => (
                    <div key={stop.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm group">
                       <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">{idx + 1}</div>
                          <div>
                            <p className="font-bold text-sm">{stop.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{stop.address}</p>
                            <div className="flex gap-2 mt-1">
                               <Badge variant="outline" className="text-[8px] h-4 bg-blue-50">{stop.weightKg} Kg</Badge>
                               <Badge variant="secondary" className="text-[8px] h-4">{stop.documents?.length || 0} Remitos</Badge>
                            </div>
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => removeStop('outbound', stop.id)}><Trash2 size={16}/></Button>
                    </div>
                  ))
                )}
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Logística de Vuelta (Retorno)</CardTitle>
                    <CardDescription>Cargue los puntos de recolección y entrega para el tramo de regreso.</CardDescription>
                  </div>
                  <Button size="sm" className="bg-orange-600" onClick={() => { setActiveLeg('return'); setIsStopModalOpen(true); }}><Plus size={14} className="mr-1" /> Agregar Parada Retorno</Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {formData.returnStops?.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed text-slate-400 italic">Sin paradas de retorno registradas.</div>
                  ) : (
                    formData.returnStops?.map((stop, idx) => (
                      <div key={stop.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm group border-l-4 border-l-orange-500">
                         <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs">{idx + 1}</div>
                            <div>
                              <p className="font-bold text-sm">{stop.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase">{stop.address}</p>
                              <div className="flex gap-2 mt-1">
                                 <Badge variant="outline" className="text-[8px] h-4 bg-orange-50">{stop.weightKg} Kg</Badge>
                                 <Badge variant="secondary" className="text-[8px] h-4">{stop.documents?.length || 0} Remitos</Badge>
                              </div>
                            </div>
                         </div>
                         <Button variant="ghost" size="icon" className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => removeStop('return', stop.id)}><Trash2 size={16}/></Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </>
            )}
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="text-blue-600" /> Trámites Internacionales</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Tipo Operación</Label>
                   <Select value={formData.international?.operationType} onValueChange={v => setFormData({...formData, international: {...formData.international!, operationType: v as any}})}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent><SelectItem value="export">Exportación</SelectItem><SelectItem value="import">Importación</SelectItem><SelectItem value="transit">Tránsito</SelectItem></SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Aduana Salida</Label><Input value={formData.international?.exitCustoms} onChange={e => setFormData({...formData, international: {...formData.international!, exitCustoms: e.target.value}})} /></div>
                 <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">N° Declaración (SIM)</Label><Input value={formData.international?.declarationNumber} onChange={e => setFormData({...formData, international: {...formData.international!, declarationNumber: e.target.value}})} /></div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Aspecto Financiero</CardTitle></CardHeader>
            <CardContent className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"><Label>Precio Base / Flete Total (ARS)</Label><Input type="number" value={formData.totalAmount || ''} onChange={e => setFormData({...formData, totalAmount: parseFloat(e.target.value) || 0})} /></div>
                  <div className="space-y-2"><Label>Anticipo Viáticos Chofer</Label><Input type="number" value={formData.budget?.initialAdvance || ''} onChange={e => setFormData({...formData, budget: {...formData.budget!, initialAdvance: parseFloat(e.target.value) || 0}})} /></div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Resumen y Finalización</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="p-6 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Carga Útil Acumulada</p>
                     <p className="text-3xl font-black italic">{totalWeight.toLocaleString()} <span className="text-sm font-normal opacity-50 uppercase">Kg</span></p>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Total Destinos</p>
                     <p className="text-3xl font-black">{(formData.outboundStops?.length || 0) + (formData.returnStops?.length || 0)}</p>
                  </div>
               </div>
               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Zap className="text-blue-600 mt-1" size={18} />
                  <p className="text-xs text-blue-700 leading-relaxed">Al confirmar, se generará la hoja de ruta digital para el conductor. Asegúrese de que todos los remitos estén cargados correctamente para evitar demoras en aduana o fiscalización.</p>
               </div>
            </CardContent>
            <CardFooter className="flex justify-end"><Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Registrar Operación Completa</Button></CardFooter>
          </Card>
        )}
      </div>

      {/* Stop Management Modal */}
      <Dialog open={isStopModalOpen} onOpenChange={setIsStopModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeLeg === 'outbound' ? <MoveRight className="text-blue-600" /> : <Repeat className="text-orange-600" />}
              {editingStop.id ? 'Editar Parada' : `Nuevo Punto de Destino (${activeLeg === 'outbound' ? 'Ida' : 'Vuelta'})`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-dashed">
              <div className="space-y-2">
                <Label>Seleccionar Ubicación</Label>
                <Select onValueChange={handleStopLocationSelect}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sede o Cliente" /></SelectTrigger>
                  <SelectContent>{locationsList.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre Personalizado</Label>
                <Input value={editingStop.name} onChange={e => setEditingStop({...editingStop, name: e.target.value})} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Dirección Entrega</Label>
                <Input value={editingStop.address} onChange={e => setEditingStop({...editingStop, address: e.target.value})} />
              </div>
            </div>

            <Card className="border-accent/10 shadow-none bg-accent/5">
              <CardHeader className="py-3"><CardTitle className="text-sm">Mercadería y Remitos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Descripción</Label><Input className="bg-white" value={editingStop.description} onChange={e => setEditingStop({...editingStop, description: e.target.value})} /></div>
                   <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Peso (Kg)</Label><Input className="bg-white" type="number" value={editingStop.weightKg} onChange={e => setEditingStop({...editingStop, weightKg: parseFloat(e.target.value) || 0})} /></div>
                   <div className="space-y-1"><Label className="text-[10px] font-bold uppercase">Bultos</Label><Input className="bg-white" type="number" value={editingStop.units} onChange={e => setEditingStop({...editingStop, units: parseInt(e.target.value) || 0})} /></div>
                </div>

                <div className="p-4 bg-white rounded-xl border space-y-4">
                  <Label className="text-blue-600 font-bold text-[10px] uppercase flex items-center gap-2"><FileText size={14}/> Carga de Remitos</Label>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <Input className="h-8 text-xs" placeholder="N° Remito" value={newDoc.number} onChange={e => setNewDoc({...newDoc, number: e.target.value})} />
                    <Input className="h-8 text-xs" placeholder="Despacho (SIM)" value={newDoc.despachoNumber} onChange={e => setNewDoc({...newDoc, despachoNumber: e.target.value})} />
                    <div className="flex items-center gap-2 px-2 bg-slate-50 border rounded h-8">
                       <Switch checked={newDoc.hasCot} onCheckedChange={v => setNewDoc({...newDoc, hasCot: v})} />
                       <span className="text-[9px] font-bold uppercase">COT</span>
                    </div>
                    <Button size="sm" className="h-8 bg-blue-600" onClick={addRemitoToStop} disabled={!newDoc.number}><Plus size={14}/></Button>
                  </div>
                  {editingStop.documents && editingStop.documents.length > 0 && (
                    <div className="space-y-1 pt-2">
                       {editingStop.documents.map(doc => (
                         <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-[10px] font-bold">
                            <div className="flex gap-2">
                               <span>Remito: {doc.number}</span>
                               {doc.hasCot && <Badge className="h-3 text-[7px] bg-green-500">COT OK</Badge>}
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

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStopModalOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600" onClick={saveStop}>Guardar Parada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => setStep(prev => prev - 1)} disabled={step === 1 || isSubmitting}><ChevronLeft size={16} /> Volver</Button>
          <div className="flex gap-2">
            {step < 6 ? (
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
