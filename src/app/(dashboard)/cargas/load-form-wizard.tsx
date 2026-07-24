
'use client';

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc, updateDoc, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Package, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Calendar, Clock, DollarSign, Truck, 
  Users, Info, AlertTriangle, ShieldCheck, 
  Thermometer, Droplets, Anchor, CheckCircle2, ChevronRight, ChevronLeft
} from "lucide-react";
import { Load, Truck as TruckType, Driver } from "@/app/lib/types";
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
  { id: 'LTL', label: 'Carga Fraccionada (LTL)', icon: Anchor },
  { id: 'reefer', label: 'Refrigerado', icon: Thermometer },
  { id: 'dangerous', label: 'Carga Peligrosa', icon: AlertTriangle },
  { id: 'oversized', label: 'Sobredimensionada', icon: Info },
  { id: 'customs', label: 'Aduana (Imp/Exp)', icon: ShieldCheck },
];

export default function LoadFormWizard() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Load>>({
    orderNumber: `FL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    serviceType: 'standard',
    clientName: "",
    origin: { name: "", phone: "", contact: "", address: "", province: "Buenos Aires", zip: "", instructions: "" },
    destination: { name: "", phone: "", contact: "", address: "", province: "CABA", zip: "", instructions: "" },
    pickupDate: "", pickupTimeFrom: "08:00", pickupTimeTo: "17:00",
    deliveryLimitDate: "", deliveryTimeFrom: "08:00", deliveryTimeTo: "17:00",
    description: "", classification: "Mercancías Generales", weightKg: 0, volumeM3: 0, units: 0, unitType: "Pallet",
    basePrice: 0, 
    additionalCosts: { peajes: 0, parking: 0, handling: 0, viaticos: 0, others: 0 },
    totalTaxes: 0, totalAmount: 0, paymentMethod: "Contado", billingStatus: "pending",
    priority: "medium", status: "pending", specialInstructions: ""
  });

  // Queries for assignment
  const trucksQuery = useMemo(() => db ? query(collection(db, "trucks"), where("status", "==", "available")) : null, [db]);
  const driversQuery = useMemo(() => db ? query(collection(db, "drivers"), where("status", "==", "active")) : null, [db]);
  const { data: availableTrucks } = useCollection<TruckType>(trucksQuery);
  const { data: availableDrivers } = useCollection<Driver>(driversQuery);

  // Auto-calculate Total
  useEffect(() => {
    const base = formData.basePrice || 0;
    const add = formData.additionalCosts || { peajes: 0, parking: 0, handling: 0, viaticos: 0, others: 0 };
    const addTotal = add.peajes + add.parking + add.handling + add.viaticos + add.others;
    const taxes = formData.totalTaxes || 0;
    setFormData(prev => ({ ...prev, totalAmount: base + addTotal + taxes }));
  }, [formData.basePrice, formData.additionalCosts, formData.totalTaxes]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

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

  const handleNumeric = (path: string, val: string, sub?: string) => {
    const num = val === "" ? 0 : parseFloat(val);
    const final = isNaN(num) ? 0 : num;
    if (sub) {
      setFormData(prev => ({
        ...prev,
        [path]: { ...((prev as any)[path] || {}), [sub]: final }
      }));
    } else {
      setFormData(prev => ({ ...prev, [path]: final }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nueva Operación Logística</h1>
            <p className="text-sm text-slate-500">Registro integral de fletes, mercadería y aspectos financieros.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
          {formData.orderNumber}
        </Badge>
      </div>

      {/* Steps Indicator */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Gerais", icon: Info },
            { id: 2, label: "Carga", icon: Package },
            { id: 3, label: "Docs", icon: ShieldCheck },
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

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Datos Generales del Flete</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <Label>Tipo de Servicio</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {SERVICE_TYPES.map(type => (
                    <Button 
                      key={type.id} 
                      type="button" 
                      variant={formData.serviceType === type.id ? "default" : "outline"}
                      className="flex flex-col h-20 gap-1.5 p-2"
                      onClick={() => setFormData({...formData, serviceType: type.id as any})}
                    >
                      <type.icon size={18} />
                      <span className="text-[8px] uppercase font-bold leading-tight">{type.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Origen */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-dashed">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase mb-2">
                    <MapPin size={14} /> Remitente (Origen)
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-slate-400">Razón Social</Label>
                    <Input className="bg-white" value={formData.origin?.name} onChange={e => setFormData({...formData, origin: {...formData.origin!, name: e.target.value}})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Teléfono</Label>
                      <Input className="bg-white" value={formData.origin?.phone} onChange={e => setFormData({...formData, origin: {...formData.origin!, phone: e.target.value}})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Provincia</Label>
                      <Select value={formData.origin?.province} onValueChange={v => setFormData({...formData, origin: {...formData.origin!, province: v}})}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-slate-400">Dirección Completa</Label>
                    <Input className="bg-white" value={formData.origin?.address} onChange={e => setFormData({...formData, origin: {...formData.origin!, address: e.target.value}})} />
                  </div>
                </div>

                {/* Destino */}
                <div className="space-y-4 p-4 bg-blue-50/30 rounded-xl border border-dashed border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-2">
                    <MapPin size={14} /> Destinatario (Destino)
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-slate-400">Razón Social</Label>
                    <Input className="bg-white" value={formData.destination?.name} onChange={e => setFormData({...formData, destination: {...formData.destination!, name: e.target.value}})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Teléfono</Label>
                      <Input className="bg-white" value={formData.destination?.phone} onChange={e => setFormData({...formData, destination: {...formData.destination!, phone: e.target.value}})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Provincia</Label>
                      <Select value={formData.destination?.province} onValueChange={v => setFormData({...formData, destination: {...formData.destination!, province: v}})}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-slate-400">Dirección Completa</Label>
                    <Input className="bg-white" value={formData.destination?.address} onChange={e => setFormData({...formData, destination: {...formData.destination!, address: e.target.value}})} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Detalle de la Carga</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Descripción de la Mercadería</Label>
                    <Textarea placeholder="Ej: Bobinas de acero, Granos, Pallets..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Peso Total (Kg)</Label>
                      <Input type="number" value={formData.weightKg || ''} onChange={e => handleNumeric('weightKg', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Volumen (m³)</Label>
                      <Input type="number" step="0.1" value={formData.volumeM3 || ''} onChange={e => handleNumeric('volumeM3', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-4">
                      <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase">
                        <Info size={14} /> Requisitos del Servicio
                      </div>
                      {formData.serviceType === 'reefer' && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                          <Label className="text-[10px]">Temperatura Requerida (°C)</Label>
                          <Input type="number" className="bg-white h-8" value={formData.reefer?.temp || ''} onChange={e => handleNumeric('reefer', e.target.value, 'temp')} />
                        </div>
                      )}
                      {formData.serviceType === 'dangerous' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                           <Label className="text-[10px]">Clase ONU / Número UN</Label>
                           <Input placeholder="UN 1203" className="bg-white h-8" value={formData.dangerousGoods?.unNumber || ''} onChange={e => setFormData({...formData, dangerousGoods: {...formData.dangerousGoods!, unNumber: e.target.value}})} />
                        </div>
                      )}
                      <p className="text-[10px] text-amber-600 leading-tight">
                        Nota: Al seleccionar servicios especiales, el sistema filtrará automáticamente la flota apta.
                      </p>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Documentación y Trâmites</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label>Documentos Requeridos</Label>
                    <div className="space-y-2">
                       {['Remito / Guía de Despacho', 'Factura de Mercadería', 'Carta de Porte / Manifiesto'].map(doc => (
                         <div key={doc} className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg">
                           <span className="text-sm font-medium">{doc}</span>
                           <Button variant="outline" size="sm" className="h-7 text-[10px]">Adjuntar PDF</Button>
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label>Impuestos y Tasas Asociados (ARS)</Label>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                         <Label className="text-[10px] text-slate-400">IVA (Flete)</Label>
                         <Input type="number" value={formData.totalTaxes || ''} onChange={e => handleNumeric('totalTaxes', e.target.value)} />
                       </div>
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-900 text-white pb-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Aspecto Financiero</CardTitle>
                  <CardDescription className="text-white/60">Controle de faturamento e custos logísticos.</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-white/50">Total del Flete (ARS)</p>
                  <p className="text-3xl font-bold text-green-400">
                    {formData.totalAmount?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="space-y-4">
                 <Label className="font-bold flex items-center gap-2 text-blue-600"><DollarSign size={14} /> Valor Base del Flete</Label>
                 <Input type="number" className="text-lg font-bold" value={formData.basePrice || ''} onChange={e => handleNumeric('basePrice', e.target.value)} />
               </div>
               <div className="md:col-span-2 grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="text-xs uppercase text-slate-400">Peajes / Eixos</Label>
                   <Input type="number" value={formData.additionalCosts?.peajes || ''} onChange={e => handleNumeric('additionalCosts', e.target.value, 'peajes')} />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-xs uppercase text-slate-400">Hospedaje / Viáticos</Label>
                   <Input type="number" value={formData.additionalCosts?.viaticos || ''} onChange={e => handleNumeric('additionalCosts', e.target.value, 'viaticos')} />
                 </div>
               </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t flex justify-between items-center p-6">
               <div className="flex gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">Forma de Pago</Label>
                    <Select value={formData.paymentMethod} onValueChange={v => setFormData({...formData, paymentMethod: v})}>
                      <SelectTrigger className="w-[150px] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['Contado', 'Transferencia', '30 días', '60 días'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
               </div>
            </CardFooter>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Asignación de Unidad y Estado</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <Label className="flex items-center gap-2"><Truck size={14} /> Camión Asignado</Label>
                   <Select value={formData.assignedTruckId} onValueChange={v => setFormData({...formData, assignedTruckId: v})}>
                     <SelectTrigger><SelectValue placeholder="Seleccionar de flota disponible" /></SelectTrigger>
                     <SelectContent>
                       {availableTrucks?.map(t => <SelectItem key={t.id} value={t.id}>{t.plate} - {t.brand} {t.model} ({t.capacityKg/1000}TN)</SelectItem>)}
                     </SelectContent>
                   </Select>
                </div>
                <div className="space-y-4">
                   <Label className="flex items-center gap-2"><Users size={14} /> Conductor Asignado</Label>
                   <Select value={formData.assignedDriverId} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                     <SelectTrigger><SelectValue placeholder="Seleccionar conductor activo" /></SelectTrigger>
                     <SelectContent>
                       {availableDrivers?.map(d => <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName} ({d.licenseClasses.join('/')})</SelectItem>)}
                     </SelectContent>
                   </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Instrucciones Especiales para el Conductor</Label>
                <Textarea placeholder="Ej: Llamar 30 min antes de llegar, el cliente solo recibe por la mañana..." value={formData.specialInstructions} onChange={e => setFormData({...formData, specialInstructions: e.target.value})} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft className="mr-2" size={16} /> Volver
          </Button>
          <div className="flex gap-2">
            {step < 5 ? (
              <Button onClick={handleNext} className="bg-blue-600 min-w-[120px]">
                Siguiente <ChevronRight className="ml-2" size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                Confirmar y Registrar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
