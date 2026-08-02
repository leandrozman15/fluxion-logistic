'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useUser } from "@/firebase";
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
  Truck, ArrowLeft, Save, Loader2, 
  Scale, CheckCircle2, ChevronRight, ChevronLeft, Info, Camera, DollarSign, Zap, Gauge, Fuel,
  ShieldCheck, Wrench, RefreshCw, Smartphone, TrendingUp, User, X, Users
} from "lucide-react";
import { Truck as TruckType, TruckCosts, Driver } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";
import { logSystemEvent } from "@/lib/audit-service";

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
  const { user } = useUser();
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
    avatarUrl: "", assignedDriverId: "none", assignedCompanionIds: [],
    costs: INITIAL_COSTS
  });

  const truckRef = useMemo(() => (truckId && db && tenantId) ? doc(db, "tenants", tenantId, "trucks", truckId) : null, [db, tenantId, truckId]);
  const { data: existingTruck, loading: loadingExisting } = useDoc<TruckType>(truckRef);

  const driversQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "drivers"), orderBy("lastName")) : null, [db, tenantId]);
  const { data: allPersonnel } = useCollection<Driver>(driversQuery);

  const driversOnly = useMemo(() => allPersonnel?.filter(p => p.role === 'driver' || !p.role) || [], [allPersonnel]);
  const companionsOnly = useMemo(() => allPersonnel?.filter(p => p.role === 'companion') || [], [allPersonnel]);

  useEffect(() => {
    if (existingTruck) {
      setFormData({ 
        ...existingTruck, 
        costs: existingTruck.costs || INITIAL_COSTS,
        assignedDriverId: existingTruck.assignedDriverId || "none",
        assignedCompanionIds: existingTruck.assignedCompanionIds || []
      });
    }
  }, [existingTruck]);

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && tenantId) {
      setIsProcessingAvatar(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressed = await compressImage(base64);
          const fileName = `truck_${Date.now()}.jpg`;
          const storagePath = `tenants/${tenantId}/fleet/${formData.plate || 'temp'}/avatar_${fileName}`;
          const url = await uploadBase64(storagePath, compressed);
          setFormData(prev => ({ ...prev, avatarUrl: url }));
          
          if (user) {
            await logSystemEvent(db, tenantId, user, 'document_upload', 'truck', formData.plate || 'unknown', { fileType: 'avatar' });
          }
          toast({ title: "Foto guardada" });
        } catch (err) {
          toast({ variant: "destructive", title: "Error al subir foto" });
        } finally {
          setIsProcessingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => setStep(s => Math.min(5, s + 1));
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleAddCompanion = (id: string) => {
    if (id === 'none') return;
    const current = formData.assignedCompanionIds || [];
    if (!current.includes(id)) {
      setFormData({ ...formData, assignedCompanionIds: [...current, id] });
    }
  };

  const removeCompanion = (id: string) => {
    setFormData({ ...formData, assignedCompanionIds: (formData.assignedCompanionIds || []).filter(cid => cid !== id) });
  };

  const handleSubmit = async () => {
    if (!db || !tenantId || !formData.plate) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "El dominio de la unidad es obligatorio." });
      return;
    }
    setIsSubmitting(true);
    try {
      const finalCapacity = (formData.grossCombinedWeightKg || 0) - (formData.unladenWeightKg || 0);
      
      // Sanitización para evitar undefined en Firestore
      const cleanData: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined) cleanData[key] = value;
      });

      cleanData.capacityKg = finalCapacity;
      cleanData.updatedAt = serverTimestamp();

      if (truckId) {
        await updateDoc(doc(db, "tenants", tenantId, "trucks", truckId), cleanData);
        if (user) await logSystemEvent(db, tenantId, user, 'update', 'truck', truckId, { plate: formData.plate });
      } else {
        const newRef = doc(collection(db, "tenants", tenantId, "trucks"));
        cleanData.id = newRef.id;
        cleanData.createdAt = serverTimestamp();
        await setDoc(newRef, cleanData);
        if (user) await logSystemEvent(db, tenantId, user, 'create', 'truck', newRef.id, { plate: formData.plate });
      }
      toast({ title: "Ficha Técnica Guardada", description: `La unidad ${formData.plate} ha sido actualizada.` });
      router.push('/flota');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && truckId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center gap-4 pt-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Ficha Técnica de Camión</h1>
          <p className="text-sm text-slate-500 font-medium">Configuración de activos, pesos y parámetros de costos.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between overflow-x-auto gap-4">
         {[
           { id: 1, label: "Identidad / Personal", icon: Info },
           { id: 2, label: "Pesos/Técnica", icon: Scale },
           { id: 3, label: "Operación", icon: Zap },
           { id: 4, label: "Costos Fijos", icon: DollarSign },
           { id: 5, label: "Variables", icon: TrendingUp }
         ].map(s => (
           <div key={s.id} className={cn("flex flex-col items-center gap-1.5 flex-1 relative min-w-[100px]")}>
             <div className={cn(
               "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all", 
               step === s.id ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-110" : 
               step > s.id ? "bg-green-50 text-white border-green-500" : "bg-white text-slate-300 border-slate-100"
             )}>
               {step > s.id ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
             </div>
             <span className={cn("text-[9px] font-black uppercase text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>{s.label}</span>
             {s.id < 5 && <div className={cn("absolute top-5 left-1/2 w-full h-[2px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
           </div>
         ))}
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        {step === 1 && (
          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
               <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Truck size={18} className="text-blue-400"/> 1. Identificación de la Unidad</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-8 p-8">
                  <div className="md:col-span-4 flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed rounded-[2rem]">
                     <Avatar className="w-40 h-40 rounded-[2rem] border-4 border-white shadow-2xl relative">
                        <AvatarImage src={formData.avatarUrl} className="object-cover" />
                        <AvatarFallback className="bg-blue-100 text-blue-600"><Truck size={48} /></AvatarFallback>
                        {isProcessingAvatar && <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-[2rem]"><Loader2 className="animate-spin text-blue-600" /></div>}
                     </Avatar>
                     <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={onAvatarChange} />
                     <Button variant="outline" className="w-full rounded-xl h-11 font-bold text-xs uppercase" onClick={() => avatarInputRef.current?.click()} disabled={isProcessingAvatar}>
                       <Camera size={16} className="mr-2 text-blue-500" /> Capturar Imagen
                     </Button>
                  </div>
                  <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dominio / Patente</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-black text-2xl uppercase tracking-tighter" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} /></div>
                     <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Año de Fabricación</Label><Input type="number" className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value) || 0})} /></div>
                     <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Marca del Tractor</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                     <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Modelo / Versión</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} /></div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Titularidad</Label>
                        <Select value={formData.ownershipType} onValueChange={(v: any) => setFormData({...formData, ownershipType: v})}>
                           <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                           <SelectContent><SelectItem value="company">Propiedad Empresa (Directa)</SelectItem><SelectItem value="third_party">Unidad Tercerizada / Contratada</SelectItem></SelectContent>
                        </Select>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
               <CardHeader className="bg-blue-600 text-white p-6"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Users size={18}/> Asignación Permanente de Personal</CardTitle></CardHeader>
               <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Chofer Principal Asignado</Label>
                        <Select value={formData.assignedDriverId} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                           <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                              <SelectValue placeholder="Elegir Chofer..." />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="none">Sin Chofer Fijo</SelectItem>
                              {driversOnly.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                        <p className="text-[9px] text-slate-400 font-bold uppercase italic">Este chofer será sugerido automáticamente al despachar la unidad.</p>
                     </div>

                     <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Acompañantes / Ayudantes Fijos</Label>
                        <Select onValueChange={handleAddCompanion}>
                           <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                              <SelectValue placeholder="Agregar Ayudante..." />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="none">Seleccionar...</SelectItem>
                              {companionsOnly.map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                           {(formData.assignedCompanionIds || []).map(cid => {
                             const p = companionsOnly.find(x => x.id === cid);
                             return (
                               <Badge key={cid} variant="secondary" className="pl-2 pr-1 py-1 gap-2 bg-blue-50 text-blue-700 border-blue-100">
                                 {p ? `${p.lastName}, ${p.firstName[0]}.` : cid}
                                 <button onClick={() => removeCompanion(cid)} className="hover:text-red-500"><X size={12}/></button>
                               </Badge>
                             );
                           })}
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-blue-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Scale size={18}/> 2. Parámetros Técnicos y de Carga</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">PBTC Máximo (KG)</Label><Input type="number" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl" value={formData.grossCombinedWeightKg} onChange={e => setFormData({...formData, grossCombinedWeightKg: parseInt(e.target.value) || 0})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tara Real (KG)</Label><Input type="number" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl" value={formData.unladenWeightKg} onChange={e => setFormData({...formData, unladenWeightKg: parseInt(e.target.value) || 0})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ejes del Tractor</Label><Input type="number" className="h-12 bg-slate-50 border-none rounded-xl" value={formData.axles} onChange={e => setFormData({...formData, axles: parseInt(e.target.value) || 2})} /></div>
                </div>

                <div className="p-8 bg-green-50 border-2 border-green-100 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-4 text-green-700">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg"><Scale size={32} /></div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase tracking-widest">Carga Útil Habilitada (Estimada)</p>
                         <p className="text-4xl font-black italic tracking-tighter">{((formData.grossCombinedWeightKg || 0) - (formData.unladenWeightKg || 0)).toLocaleString()} KG</p>
                      </div>
                   </div>
                   <Badge className="bg-green-600 text-white font-black uppercase italic px-6 py-2 rounded-xl text-xs">Cumple Normativa Vial</Badge>
                </div>
             </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Zap size={18} className="text-blue-400"/> 3. Parámetros de Operación Directa</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
                      <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Monitoreo de Uso</p>
                      <div className="space-y-1.5">
                         <Label className="text-[9px] font-black uppercase text-slate-400">Odómetro Actual (KM)</Label>
                         <div className="relative"><Gauge size={16} className="absolute left-3 top-3 text-slate-300"/><Input type="number" className="h-12 pl-10 font-mono font-black text-xl" value={formData.odometerKm} onChange={e => setFormData({...formData, odometerKm: parseInt(e.target.value) || 0})} /></div>
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[9px] font-black uppercase text-slate-400">Consumo Promedio (L/100km)</Label>
                         <div className="relative"><Fuel size={16} className="absolute left-3 top-3 text-slate-300"/><Input type="number" className="h-12 pl-10 font-bold" value={formData.avgConsumption} onChange={e => setFormData({...formData, avgConsumption: parseFloat(e.target.value) || 32})} /></div>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><DollarSign size={18}/> 4. Auditoría de Gastos Fijos Mensuales</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Sueldo + Cargas Sociales Chofer (ARS)</Label><Input type="number" className="h-11 bg-slate-50 border-none rounded-xl" value={formData.costs?.fixed.salaryWithSocial} onChange={e => setFormData({...formData, costs: {...formData.costs!, fixed: {...formData.costs!.fixed, salaryWithSocial: parseFloat(e.target.value) || 0}}})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Seguro Total Mensual</Label><Input type="number" className="h-11 bg-slate-50 border-none rounded-xl" value={formData.costs?.fixed.insuranceTotal} onChange={e => setFormData({...formData, costs: {...formData.costs!, fixed: {...formData.costs!.fixed, insuranceTotal: parseFloat(e.target.value) || 0}}})} /></div>
                </div>
             </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-green-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><TrendingUp size={18}/> 5. Costos Variables y Amortización</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
                      <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Mantenimiento y Lubricación</p>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase">Costo Service</Label><Input type="number" className="bg-white" value={formData.costs?.variable.preventiveMaintenance.cost} onChange={e => setFormData({...formData, costs: {...formData.costs!, variable: {...formData.costs!.variable, preventiveMaintenance: {...formData.costs!.variable.preventiveMaintenance, cost: parseFloat(e.target.value) || 0}}}})} /></div>
                      </div>
                   </div>
                </div>

                <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-6">
                   <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 h-16 px-16 rounded-2xl font-black text-lg shadow-2xl transition-all active:scale-95">
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} FINALIZAR AUDITORÍA
                   </Button>
                </div>
             </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>VOLVER</Button>
          {step < 5 ? (
            <Button onClick={handleNext} className="bg-blue-600">SIGUIENTE PASO <ChevronRight className="ml-1" size={16} /></Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
