
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
  Thermometer, Anchor, CheckCircle2, ChevronRight, ChevronLeft, Building2, Globe, FileText, Zap, Plus, Trash2
} from "lucide-react";
import { Load, Truck as TruckType, Driver, Client, LoadDocument } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

const ADUANAS = ["Ezeiza", "Puerto Buenos Aires", "Santos (BR)", "Paso de los Libres", "Uruguaiana (BR)", "Mendoza (Los Andes)"];

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
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", country: "Argentina", zip: "", instructions: "" },
    destination: { name: "", phone: "", contact: "", address: "", province: "CABA", country: "Argentina", zip: "", instructions: "" },
    pickupDate: "", pickupTimeFrom: "08:00", pickupTimeTo: "17:00",
    deliveryLimitDate: "", deliveryTimeFrom: "08:00", deliveryTimeTo: "17:00",
    description: "", classification: "Mercancías Generales", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet",
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

  useEffect(() => {
    if (formData.serviceType === 'customs' && formData.international) {
      const fob = formData.international.fobValueUsd || 0;
      const flete = formData.international.freightValueUsd || 0;
      const seguro = formData.international.insuranceValueUsd || 0;
      const cif = fob + flete + seguro;
      const duties = cif * 0.15;
      const iva = (cif + duties) * 0.21;
      
      setFormData(prev => ({
        ...prev,
        international: {
          ...prev.international!,
          cifValueUsd: cif,
          importDutiesUsd: duties,
          customsIvaUsd: iva,
          totalCustomsCostsUsd: duties + iva
        }
      }));
    }
  }, [formData.international?.fobValueUsd, formData.international?.freightValueUsd, formData.international?.insuranceValueUsd, formData.serviceType]);

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const { data: clients } = useCollection<Client>(clientsQuery);

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
      uploadedAt: new Date().toISOString()
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
            { id: 2, label: "Carga / Remitos", icon: Package },
            { id: 3, label: "Aduana", icon: Globe },
            { id: 4, label: "Financeiro", icon: DollarSign },
            { id: 5, label: "Asignación", icon: Truck }
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

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Configuración Inicial</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label>Cliente / Dador de Carga</Label>
                  <Select value={formData.clientId} onValueChange={v => {
                    const c = clients?.find(cl => cl.id === v);
                    setFormData({...formData, clientId: v, clientName: c?.name || ""});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <Label>Tipo de Servicio</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {SERVICE_TYPES.map(type => (
                      <button 
                        key={type.id} 
                        type="button" 
                        className={cn(
                          "flex flex-col items-center justify-center h-16 gap-1 p-2 rounded-lg border transition-all",
                          formData.serviceType === type.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                        )}
                        onClick={() => setFormData({...formData, serviceType: type.id as any})}
                      >
                        <type.icon size={16} />
                        <span className="text-[7px] uppercase font-bold leading-tight">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Detalle de la Mercadería</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-4">
                     <Label>Descripción General</Label>
                     <Textarea 
                      placeholder="Ej: Pallets de productos alimenticios con cadena de frío..."
                      value={formData.description || ''} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                     />
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Peso Total (Kg)</Label><Input type="number" value={formData.weightKg || ''} onChange={e => setFormData({...formData, weightKg: parseFloat(e.target.value) || 0})} /></div>
                        <div className="space-y-1"><Label>Volumen Total (m³)</Label><Input type="number" value={formData.volumeM3 || ''} onChange={e => setFormData({...formData, volumeM3: parseFloat(e.target.value) || 0})} /></div>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <Label className="text-blue-600 font-bold flex items-center gap-2"><FileText size={14} /> Documentación Legal</Label>
                       <Badge variant="outline" className="text-[10px] uppercase">{formData.documents?.length || 0} Cargados</Badge>
                     </div>
                     
                     <div className="p-4 bg-slate-50 rounded-xl border border-dashed space-y-4">
                       <div className="grid grid-cols-1 gap-3">
                         <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                               <Label className="text-[10px] uppercase font-bold">N° Remito</Label>
                               <Input 
                                placeholder="0001-000456" 
                                className="bg-white h-8 text-sm" 
                                value={remitoNumber}
                                onChange={e => setRemitoNumber(e.target.value)}
                               />
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[10px] uppercase font-bold">N° Despacho</Label>
                               <Input 
                                placeholder="SIM / Otros" 
                                className="bg-white h-8 text-sm" 
                                value={remitoDespacho}
                                onChange={e => setRemitoDespacho(e.target.value)}
                               />
                            </div>
                         </div>
                         <Input 
                          placeholder="Detalle de carga (ej: 2 pallets)" 
                          className="bg-white h-8 text-sm"
                          value={remitoDetail}
                          onChange={e => setRemitoDetail(e.target.value)}
                         />
                         <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <div className="flex items-center gap-2">
                               <Switch checked={remitoHasCot} onCheckedChange={setRemitoHasCot} />
                               <Label className="text-[10px] uppercase font-bold">¿Lleva COT?</Label>
                            </div>
                            {remitoHasCot && (
                               <Input 
                                placeholder="N° COT" 
                                className="h-7 w-32 text-[10px]" 
                                value={remitoCotNumber}
                                onChange={e => setRemitoCotNumber(e.target.value)}
                               />
                            )}
                         </div>
                         <Button type="button" size="sm" className="h-8 bg-blue-600" onClick={addRemito} disabled={!remitoNumber}>
                           <Plus size={14} className="mr-1" /> Agregar Documento
                         </Button>
                       </div>
                     </div>

                     <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {formData.documents?.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-white border rounded-lg group hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[10px] font-bold text-slate-900 truncate">N° {doc.number}</p>
                                    {doc.hasCot && <Badge className="h-3 text-[7px] bg-green-500 border-none">COT: {doc.cotNumber}</Badge>}
                                </div>
                                <p className="text-[9px] text-slate-500 truncate">{doc.notes || 'Sin detalle'}</p>
                                {doc.despachoNumber && <p className="text-[8px] text-blue-500 font-bold uppercase truncate">Despacho: {doc.despachoNumber}</p>}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeRemito(doc.id)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ))}
                        {(!formData.documents || formData.documents.length === 0) && (
                          <p className="text-center py-6 text-xs text-slate-400 italic">No hay documentos agregados todavía.</p>
                        )}
                     </div>
                   </div>
                 </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Anchor className="text-blue-600" /> Trámites de Aduana</CardTitle>
              <CardDescription>Obligatorio para fletes internacionales (RG 5756/2025).</CardDescription>
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
                   <Label className="text-[10px] uppercase font-bold">Aduana Salida</Label>
                   <Select value={formData.international?.exitCustoms} onValueChange={v => setFormData({...formData, international: {...formData.international!, exitCustoms: v}})}>
                     <SelectTrigger><SelectValue /></SelectTrigger>
                     <SelectContent>{ADUANAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <Label className="text-[10px] uppercase font-bold">N° Declaración (SIM)</Label>
                   <Input value={formData.international?.declarationNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, declarationNumber: e.target.value}})} />
                 </div>
               </div>

               <div className="p-4 bg-slate-50 border border-dashed rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-blue-700 font-bold flex items-center gap-2"><FileText size={14} /> Manifiesto MIC/DTA</Label>
                    <Badge variant="outline" className="bg-green-50 text-green-700">Protocolo ATIT</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input placeholder="Número MIC/DTA" value={formData.international?.micDtaNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, micDtaNumber: e.target.value}})} />
                    <Input type="date" value={formData.international?.micDtaExpiry || ''} onChange={e => setFormData({...formData, international: {...formData.international!, micDtaExpiry: e.target.value}})} />
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-white rounded border">
                    <Switch checked={formData.international?.isMalvinaPresented} onCheckedChange={v => setFormData({...formData, international: {...formData.international!, isMalvinaPresented: v}})} />
                    <span className="text-xs font-medium">Presentado en Sistema MALVINA</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="space-y-1"><Label className="text-[10px] uppercase">Contenedor</Label><Input value={formData.international?.containerNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, containerNumber: e.target.value}})} /></div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase">Precinto/Sello</Label><Input value={formData.international?.sealNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, sealNumber: e.target.value}})} /></div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">Doc Transp.</Label>
                    <Select value={formData.international?.transportDocType} onValueChange={v => setFormData({...formData, international: {...formData.international!, transportDocType: v as any}})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BL">Bill of Lading</SelectItem>
                        <SelectItem value="CP">Carta Porte</SelectItem>
                        <SelectItem value="AWB">Air Waybill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase">N° Doc</Label><Input value={formData.international?.transportDocNumber || ''} onChange={e => setFormData({...formData, international: {...formData.international!, transportDocNumber: e.target.value}})} /></div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-900 text-white">
              <div className="flex justify-between items-center">
                <CardTitle>Aspecto Financeiro</CardTitle>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-white/50">Total Aduanero (USD)</p>
                  <p className="text-2xl font-bold text-green-400">${formData.international?.totalCustomsCostsUsd?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                 <Label className="text-blue-600 font-bold flex items-center gap-2"><DollarSign size={14} /> Valor FOB (USD)</Label>
                 <Input type="number" value={formData.international?.fobValueUsd || ''} onChange={e => setFormData({...formData, international: {...formData.international!, fobValueUsd: parseFloat(e.target.value) || 0}})} />
              </div>
              <div className="space-y-4">
                 <Label className="text-slate-500 font-bold">Flete (USD)</Label>
                 <Input type="number" value={formData.international?.freightValueUsd || ''} onChange={e => setFormData({...formData, international: {...formData.international!, freightValueUsd: parseFloat(e.target.value) || 0}})} />
              </div>
              <div className="space-y-4">
                 <Label className="text-slate-500 font-bold">Seguro (USD)</Label>
                 <Input type="number" value={formData.international?.insuranceValueUsd || ''} onChange={e => setFormData({...formData, international: {...formData.international!, insuranceValueUsd: parseFloat(e.target.value) || 0}})} />
              </div>
              
              <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border">
                 <div className="space-y-1">
                   <p className="text-[9px] uppercase font-bold text-slate-400">Valor CIF</p>
                   <p className="font-bold">${formData.international?.cifValueUsd?.toFixed(2) || '0.00'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[9px] uppercase font-bold text-slate-400">Direitos (15%)</p>
                   <p className="font-bold text-red-500">${formData.international?.importDutiesUsd?.toFixed(2) || '0.00'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[9px] uppercase font-bold text-slate-400">IVA (21%)</p>
                   <p className="font-bold text-red-500">${formData.international?.customsIvaUsd?.toFixed(2) || '0.00'}</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[9px] uppercase font-bold text-slate-400">Custo Total USD</p>
                   <p className="font-bold text-green-600">${formData.international?.totalCustomsCostsUsd?.toFixed(2) || '0.00'}</p>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Asignación de Unidad</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                  <Zap className="text-blue-600 mt-1" size={18} />
                  <div>
                    <p className="text-xs font-bold text-blue-900">Verificación de Cumplimiento Internacional</p>
                    <p className="text-[10px] text-blue-700">El sistema solo mostrará camiones con documentación vigente y motoristas habilitados para cruce de frontera.</p>
                  </div>
               </div>
            </CardContent>
            <CardFooter className="flex justify-end">
               <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                 Confirmar y Registrar Carga
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
            {step < 5 ? (
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
