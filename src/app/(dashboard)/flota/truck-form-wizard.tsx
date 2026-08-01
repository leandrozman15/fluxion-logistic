
'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, updateDoc, setDoc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Truck, ArrowLeft, ArrowRight, Save, Loader2, 
  Scale, Box, Anchor, Layers, 
  Crosshair, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Info, MapPin, Camera, Image as ImageIcon, LayoutGrid, Building2, User, DollarSign, Activity, TrendingUp, Zap, Trash2, Plus, UserCheck, X, Wrench, LifeBuoy, Gauge, Fuel
} from "lucide-react";
import { Truck as TruckType, Driver, OwnershipType, TruckCosts } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";

interface TruckFormWizardProps {
  truckId?: string;
}

const INITIAL_COSTS: TruckCosts = {
  fixed: { salaryWithSocial: 0, insuranceTotal: 0, patenteMonthly: 0, satelliteGps: 0, garageAdmin: 0, taxesHabilitations: 0, amortization: 0 },
  variable: { preventiveMaintenance: { cost: 0, frequencyKm: 20000 }, tires: { costFullSet: 0, lifeSpanKm: 100000 }, unforeseenReservePerKm: 0 },
  operational: { estimatedMonthlyKm: 10000 }
};

export default function TruckFormWizard({ truckId }: TruckFormWizardProps) {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<TruckType>>({
    plate: "", brand: "", model: "", year: new Date().getFullYear(),
    axles: 2, grossCombinedWeightKg: 45000, unladenWeightKg: 15000, capacityKg: 30000,
    odometerKm: 0, avgConsumption: 32, status: "available",
    ownershipType: 'company', haulingType: 'standard',
    location: { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 },
    avatarUrl: "", assignedCompanionIds: [],
    costs: INITIAL_COSTS
  });

  const truckRef = useMemo(() => (truckId && db && tenantId) ? doc(db, "tenants", tenantId, "trucks", truckId) : null, [db, tenantId, truckId]);
  const { data: existingTruck, loading: loadingExisting } = useDoc<TruckType>(truckRef);

  useEffect(() => {
    if (existingTruck) {
      setFormData({ 
        ...existingTruck, 
        costs: existingTruck.costs || INITIAL_COSTS 
      });
    }
  }, [existingTruck]);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.plate) return toast({ variant: "destructive", title: "Faltan datos", description: "La patente es obligatoria." });
      if (!formData.brand) return toast({ variant: "destructive", title: "Faltan datos", description: "La marca es obligatoria." });
    }
    setStep(s => Math.min(4, s + 1));
  };

  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && tenantId) {
      setIsProcessingAvatar(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressed = await compressImage(base64);
          const storagePath = `tenants/${tenantId}/fleet/${formData.plate || 'temp'}/avatar.jpg`;
          const url = await uploadBase64(storagePath, compressed);
          setFormData(prev => ({ ...prev, avatarUrl: url }));
          toast({ title: "Foto de unidad guardada" });
        } catch (err) {
          toast({ variant: "destructive", title: "Error al subir foto" });
        } finally {
          setIsProcessingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!db || !tenantId || !formData.plate) return toast({ variant: "destructive", title: "Faltan datos" });
    setIsSubmitting(true);
    try {
      if (truckId) {
        await updateDoc(doc(db, "tenants", tenantId, "trucks", truckId), { ...formData, updatedAt: serverTimestamp() });
      } else {
        const newRef = doc(collection(db, "tenants", tenantId, "trucks"));
        await setDoc(newRef, { ...formData, id: newRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      toast({ title: "Cambios guardados", description: `La unidad ${formData.plate} ha sido registrada.` });
      router.push('/flota');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && truckId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center gap-4 pt-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{truckId ? 'Editar Unidad' : 'Alta de Camión'}</h1>
          <p className="text-sm text-slate-500">Gestión de activos y parámetros operativos.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex justify-between shadow-sm">
         {[
           { id: 1, label: "Identidad", icon: Info },
           { id: 2, label: "Técnica", icon: Scale },
           { id: 3, label: "Operación", icon: Zap },
           { id: 4, label: "Costos", icon: DollarSign }
         ].map(s => (
           <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
             <div className={cn(
               "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
               step > s.id ? "bg-green-600 text-white" : step === s.id ? "bg-blue-600 text-white shadow-lg" : "bg-slate-100 text-slate-400"
             )}>
               {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
             </div>
             <span className={cn("text-[9px] font-black uppercase", step === s.id ? "text-blue-600" : "text-slate-400")}>{s.label}</span>
             {s.id < 4 && <div className={cn("absolute top-4.5 left-1/2 w-full h-[1px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
           </div>
         ))}
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Identificación de la Unidad</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
              <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed rounded-2xl">
                 <Avatar className="w-32 h-32 rounded-xl border-2 border-white shadow-lg">
                   <AvatarImage src={formData.avatarUrl} className="object-cover" />
                   <AvatarFallback className="bg-blue-50 text-blue-600"><Truck size={48} /></AvatarFallback>
                 </Avatar>
                 <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={onAvatarChange} />
                 <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={isProcessingAvatar} className="rounded-xl">
                   {isProcessingAvatar ? <Loader2 className="animate-spin mr-2" /> : <Camera size={14} className="mr-2" />} 
                   {formData.avatarUrl ? 'Cambiar Foto' : 'Subir Foto'}
                 </Button>
              </div>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Patente / Dominio</Label>
                    <Input className="font-mono font-black text-lg h-12" placeholder="Ej: AA123BB" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Marca</Label>
                      <Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Modelo</Label>
                      <Input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Año de Fabricación</Label>
                    <Input type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value) || 2024})} />
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Configuración Técnica y Pesos</CardTitle></CardHeader>
            <CardContent className="space-y-8 p-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">N° de Ejes (Tractor)</Label>
                    <Input type="number" value={formData.axles} onChange={e => setFormData({...formData, axles: parseInt(e.target.value) || 2})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">PBTC Máximo (KG)</Label>
                    <Input type="number" placeholder="Ej: 45000" value={formData.grossCombinedWeightKg} onChange={e => setFormData({...formData, grossCombinedWeightKg: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tara Unidad (KG)</Label>
                    <Input type="number" placeholder="Ej: 15000" value={formData.unladenWeightKg} onChange={e => setFormData({...formData, unladenWeightKg: parseInt(e.target.value) || 0})} />
                  </div>
               </div>

               <div className="p-6 bg-green-50 border-2 border-green-100 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <Scale size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase text-green-700 tracking-widest">Carga Útil Calculada</p>
                        <p className="text-3xl font-black italic text-green-600">
                          {((formData.grossCombinedWeightKg || 0) - (formData.unladenWeightKg || 0)).toLocaleString()} KG
                        </p>
                     </div>
                  </div>
                  <Badge className="bg-green-600 uppercase italic font-black">Habilitado</Badge>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Parámetros Operativos</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
               <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Odómetro Actual (KM)</Label>
                    <div className="relative">
                       <Gauge className="absolute left-3 top-2.5 text-slate-400" size={18} />
                       <Input type="number" className="pl-10 font-bold h-11" value={formData.odometerKm} onChange={e => setFormData({...formData, odometerKm: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Consumo Promedio (L/100km)</Label>
                    <div className="relative">
                       <Fuel className="absolute left-3 top-2.5 text-slate-400" size={18} />
                       <Input type="number" className="pl-10 h-11" value={formData.avgConsumption} onChange={e => setFormData({...formData, avgConsumption: parseFloat(e.target.value) || 32})} />
                    </div>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tipo de Propiedad</Label>
                    <Select value={formData.ownershipType} onValueChange={(v: any) => setFormData({...formData, ownershipType: v})}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Propiedad Empresa</SelectItem>
                        <SelectItem value="third_party">Tercero / Fletero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Estado Inicial</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="maintenance">En Taller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
               <CardHeader><CardTitle>Estructura de Costos Fijos</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Seguro Total Mensual (ARS)</Label>
                    <Input type="number" value={formData.costs?.fixed.insuranceTotal} onChange={e => setFormData({...formData, costs: {...formData.costs!, fixed: {...formData.costs!.fixed, insuranceTotal: parseFloat(e.target.value) || 0}}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Sueldo + Cargas Sociales (ARS)</Label>
                    <Input type="number" value={formData.costs?.fixed.salaryWithSocial} onChange={e => setFormData({...formData, costs: {...formData.costs!, fixed: {...formData.costs!.fixed, salaryWithSocial: parseFloat(e.target.value) || 0}}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Rastreo Satelital / GPS (ARS)</Label>
                    <Input type="number" value={formData.costs?.fixed.satelliteGps} onChange={e => setFormData({...formData, costs: {...formData.costs!, fixed: {...formData.costs!.fixed, satelliteGps: parseFloat(e.target.value) || 0}}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Gasto Estacionamiento/Admin (ARS)</Label>
                    <Input type="number" value={formData.costs?.fixed.garageAdmin} onChange={e => setFormData({...formData, costs: {...formData.costs!, fixed: {...formData.costs!.fixed, garageAdmin: parseFloat(e.target.value) || 0}}})} />
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-none shadow-xl rounded-3xl overflow-hidden">
               <CardHeader className="bg-white/5 border-b border-white/5 p-6">
                 <CardTitle className="text-sm uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <DollarSign size={18} /> Resumen Financiero Proyectado
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-1 text-center md:text-left">
                     <p className="text-[10px] uppercase font-bold text-white/40 tracking-[0.2em]">Carga de Datos Completa</p>
                     <p className="text-sm font-medium leading-relaxed max-w-sm text-white/60 italic">
                       Al finalizar, el sistema calculará automáticamente el índice de rentabilidad por KM basado en la media móvil de combustible auditado.
                     </p>
                  </div>
                  <Button onClick={handleSubmit} className="h-16 px-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl rounded-2xl shadow-2xl shadow-blue-900/40" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                    FINALIZAR FICHA
                  </Button>
               </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting} className="font-bold">
            <ChevronLeft size={16} className="mr-1" /> VOLVER
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} className="bg-blue-600 font-bold px-8">
                SIGUIENTE <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 font-bold px-8 shadow-lg shadow-green-100" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                GUARDAR UNIDAD
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

