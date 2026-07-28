'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
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
  Gauge, Box, Anchor, Layers, 
  Crosshair, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Info, MapPin, Camera, Image as ImageIcon, LayoutGrid, Building2, User, DollarSign, Activity, TrendingUp, Zap, Scale, Trash2, Plus, UserCheck, X
} from "lucide-react";
import { Truck as TruckType, Driver, OwnershipType, TruckCosts } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";

interface TruckFormWizardProps {
  truckId?: string;
}

const INITIAL_COSTS: TruckCosts = {
  fixed: {
    salaryWithSocial: 0,
    insuranceTotal: 0,
    patenteMonthly: 0,
    satelliteGps: 0,
    garageAdmin: 0,
    taxesHabilitations: 0,
    amortization: 0,
  },
  variable: {
    preventiveMaintenance: { cost: 0, frequencyKm: 20000 },
    tires: { costFullSet: 0, lifeSpanKm: 100000 },
    unforeseenReservePerKm: 0,
  },
  operational: {
    estimatedMonthlyKm: 10000,
  }
};

export default function TruckFormWizard({ truckId }: TruckFormWizardProps) {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<TruckType>>({
    plate: "", chassis: "", brand: "", model: "", year: new Date().getFullYear(),
    axles: 2, grossCombinedWeightKg: 45000, unladenWeightKg: 15000, capacityKg: 30000,
    odometerKm: 0, avgConsumption: 32, status: "available",
    ownershipType: 'company', haulingType: 'standard',
    location: { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 },
    avatarUrl: "", assignedCompanionIds: [],
    costs: INITIAL_COSTS
  });

  const truckRef = useMemo(() => truckId && db ? doc(db, "trucks", truckId) : null, [db, truckId]);
  const { data: existingTruck, loading: loadingExisting } = useDoc<TruckType>(truckRef);

  const driversQuery = useMemo(() => db ? query(collection(db, "drivers"), orderBy("lastName")) : null, [db]);
  const { data: allStaff } = useCollection<Driver>(driversQuery);

  const driversOnly = useMemo(() => allStaff?.filter(s => s.role === 'driver' || !s.role) || [], [allStaff]);
  const companionsOnly = useMemo(() => allStaff?.filter(s => s.role === 'companion') || [], [allStaff]);

  useEffect(() => {
    if (existingTruck) {
      setFormData({
        ...existingTruck,
        costs: existingTruck.costs || INITIAL_COSTS
      });
    }
  }, [existingTruck]);

  useEffect(() => {
    const pbtc = formData.grossCombinedWeightKg || 0;
    const tara = formData.unladenWeightKg || 0;
    const capacity = Math.max(0, pbtc - tara);
    if (capacity !== formData.capacityKg) {
      setFormData(prev => ({ ...prev, capacityKg: capacity }));
    }
  }, [formData.grossCombinedWeightKg, formData.unladenWeightKg]);

  const handleBack = () => setStep(prev => Math.max(1, prev - 1));
  const handleNext = () => setStep(prev => Math.min(4, prev + 1));

  const handleCostChange = (block: keyof TruckCosts, field: string, value: string, subField?: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setFormData(prev => {
      const currentCosts = prev.costs || INITIAL_COSTS;
      const updatedCosts = JSON.parse(JSON.stringify(currentCosts));
      if (subField) updatedCosts[block][field][subField] = isNaN(val) ? 0 : val;
      else updatedCosts[block][field] = isNaN(val) ? 0 : val;
      return { ...prev, costs: updatedCosts };
    });
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingAvatar(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        setFormData(prev => ({ ...prev, avatarUrl: compressed }));
        setIsProcessingAvatar(false);
      };
      reader.readAsDataURL(file);
    }
  };

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
    if (!db) return;
    setIsSubmitting(true);
    try {
      if (truckId) {
        await updateDoc(doc(db, "trucks", truckId), { ...formData, updatedAt: serverTimestamp() });
        toast({ title: "Unidad Actualizada" });
      } else {
        const newRef = doc(collection(db, "trucks"));
        await setDoc(newRef, { ...formData, id: newRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast({ title: "Alta Exitosa" });
      }
      router.push('/flota');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedKmCost = useMemo(() => {
    const c = formData.costs || INITIAL_COSTS;
    const fixedTotal = Object.values(c.fixed).reduce((a, b) => a + (b as number), 0);
    const monthlyKm = c.operational.estimatedMonthlyKm || 1;
    
    const fixedPerKm = fixedTotal / monthlyKm;
    const variablePerKm = (c.variable.preventiveMaintenance.cost / (c.variable.preventiveMaintenance.frequencyKm || 1)) +
                          (c.variable.tires.costFullSet / (c.variable.tires.lifeSpanKm || 1)) +
                          c.variable.unforeseenReservePerKm;
    
    return {
      fixed: fixedPerKm,
      variable: variablePerKm,
      total: fixedPerKm + variablePerKm
    };
  }, [formData.costs]);

  if (loadingExisting && truckId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
             <h1 className="text-2xl font-bold">Nueva Unidad de Flota</h1>
             <p className="text-xs text-slate-500">Gestión de especificaciones técnicas, documentación y costos.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
         {[
            { id: 1, label: "Identificación", icon: Info },
            { id: 2, label: "Arrastre", icon: Truck },
            { id: 3, label: "Pesos y GPS", icon: Scale },
            { id: 4, label: "Costos", icon: DollarSign }
          ].map(s => (
            <div key={s.id} className={cn("flex flex-col items-center gap-1 flex-1", step === s.id ? "text-blue-600" : "text-slate-400")}>
               <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", step >= s.id ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white")}>
                 {step > s.id ? <CheckCircle2 size={16} /> : <s.icon size={16} />}
               </div>
               <span className="text-[9px] font-bold uppercase">{s.label}</span>
            </div>
          ))}
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Identificación del Vehículo</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed rounded-2xl space-y-4">
                  <Avatar className="w-24 h-24 border-2 border-white shadow-md rounded-xl">
                    <AvatarImage src={formData.avatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-blue-50 text-blue-600 rounded-xl"><Truck size={40} /></AvatarFallback>
                  </Avatar>
                  <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={onAvatarChange} />
                  <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={isProcessingAvatar}>
                    {isProcessingAvatar ? <Loader2 className="animate-spin w-4 h-4" /> : <Camera size={14} className="mr-2" />} SUBIR FOTO
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1"><Label>Patente / Dominio</Label><Input value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} /></div>
                  <div className="space-y-1"><Label>Marca / Modelo</Label><Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="text-blue-600" /> Personal de Cabina</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="space-y-2">
                    <Label>Chofer Profesional (Tractor)</Label>
                    <Select value={formData.assignedDriverId || 'none'} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                       <SelectTrigger><SelectValue placeholder="Elegir Chofer" /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {driversOnly.map(d => <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-3">
                    <Label>Acompañantes / Ayudantes</Label>
                    <Select onValueChange={handleAddCompanion}>
                       <SelectTrigger><SelectValue placeholder="Agregar Acompañante..." /></SelectTrigger>
                       <SelectContent>
                          {companionsOnly.map(d => <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>)}
                       </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {formData.assignedCompanionIds?.map(cid => {
                         const dr = companionsOnly.find(c => c.id === cid);
                         return (
                           <Badge key={cid} variant="secondary" className="pl-2 pr-1 py-1 gap-2 bg-blue-50 text-blue-700 border-blue-100">
                             {dr ? `${dr.lastName}, ${dr.firstName[0]}.` : cid}
                             <button onClick={() => removeCompanion(cid)} className="hover:text-red-500"><X size={12} /></button>
                           </Badge>
                         );
                       })}
                    </div>
                 </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Configuración de Arrastre</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  className={cn("p-6 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all", formData.haulingType === 'standard' ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-400 border-slate-100")}
                  onClick={() => setFormData({...formData, haulingType: 'standard', grossCombinedWeightKg: 45000})}
                >
                  <Truck size={32} />
                  <span className="font-black text-[10px] uppercase">Standard (45 TN)</span>
                </button>
                <button 
                  className={cn("p-6 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all", formData.haulingType === 'bitren' ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-400 border-slate-100")}
                  onClick={() => setFormData({...formData, haulingType: 'bitren', grossCombinedWeightKg: 60000})}
                >
                  <Zap size={32} />
                  <span className="font-black text-[10px] uppercase">Bitrén (60/75 TN)</span>
                </button>
              </div>
              {formData.haulingType === 'bitren' && (
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl space-y-6 animate-in fade-in">
                  <div className="flex justify-between items-start">
                     <h3 className="text-sm font-bold flex items-center gap-2 text-blue-800"><Zap size={16}/> Configuración Bitrén (Res. 1196/2025)</h3>
                     <Badge className="bg-blue-600 text-[10px]">Alta Capacidad</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-blue-400">Patente 1er Semi</Label>
                      <Input className="bg-white" value={formData.bitren?.firstSemiPlate} onChange={e => setFormData({...formData, bitren: {...(formData.bitren || {} as any), firstSemiPlate: e.target.value.toUpperCase()}})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-blue-400">Patente 2do Semi</Label>
                      <Input className="bg-white" value={formData.bitren?.secondSemiPlate} onChange={e => setFormData({...formData, bitren: {...(formData.bitren || {} as any), secondSemiPlate: e.target.value.toUpperCase()}})} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Balance Legal de Pesos (Argentina)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                 <Label className="text-xs uppercase font-bold text-slate-400">PBTC Máx (kg)</Label>
                 <Input type="number" value={formData.grossCombinedWeightKg} onChange={e => setFormData({...formData, grossCombinedWeightKg: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                 <Label className="text-xs uppercase font-bold text-slate-400">Tara Real (kg)</Label>
                 <Input type="number" value={formData.unladenWeightKg} onChange={e => setFormData({...formData, unladenWeightKg: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="md:col-span-2 p-6 bg-green-50 border border-green-100 rounded-3xl text-center">
                 <p className="text-[10px] uppercase font-black text-green-700 tracking-widest mb-1">Capacidad de Carga Útil</p>
                 <p className="text-4xl font-black italic text-green-600">{(formData.capacityKg || 0).toLocaleString()} <span className="text-sm font-normal opacity-50 uppercase">kg</span></p>
              </div>
              <div className="md:col-span-2 space-y-2 pt-4">
                 <Label>Consumo Promedio (L/100km)</Label>
                 <Input type="number" value={formData.avgConsumption} onChange={e => setFormData({...formData, avgConsumption: parseFloat(e.target.value) || 32})} />
                 <p className="text-[10px] text-slate-400 italic">Este valor se utiliza para la asignación inteligente de viajes largos.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-3xl">
               <CardHeader className="pb-2 border-b border-white/5 bg-white/5">
                  <CardTitle className="text-xs uppercase font-black text-blue-400 tracking-widest">Análisis de Costos por KM</CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="text-center md:text-left">
                        <p className="text-4xl font-black italic text-green-400">${calculatedKmCost.total.toFixed(2)}</p>
                        <p className="text-[10px] uppercase font-bold text-white/30">Costo Teórico por Kilómetro</p>
                     </div>
                     <div className="grid grid-cols-2 gap-8">
                        <div>
                           <p className="text-lg font-black text-blue-400">${calculatedKmCost.fixed.toFixed(2)}</p>
                           <p className="text-[9px] uppercase font-bold text-white/20">Fijos</p>
                        </div>
                        <div>
                           <p className="text-lg font-black text-amber-400">${calculatedKmCost.variable.toFixed(2)}</p>
                           <p className="text-[9px] uppercase font-bold text-white/20">Variables</p>
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                    <Building2 size={16} className="text-blue-600" /> Gastos Fijos Mensuales
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Sueldo + Cargas (Chofer)</Label>
                    <Input type="number" value={formData.costs?.fixed.salaryWithSocial || ''} onChange={e => handleCostChange('fixed', 'salaryWithSocial', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Seguro Total Unidad</Label>
                    <Input type="number" value={formData.costs?.fixed.insuranceTotal || ''} onChange={e => handleCostChange('fixed', 'insuranceTotal', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Patente (Cuota Mensual)</Label>
                    <Input type="number" value={formData.costs?.fixed.patenteMonthly || ''} onChange={e => handleCostChange('fixed', 'patenteMonthly', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Impuestos y Habilitaciones</Label>
                    <Input type="number" value={formData.costs?.fixed.taxesHabilitations || ''} onChange={e => handleCostChange('fixed', 'taxesHabilitations', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Amortización / Reserva</Label>
                    <Input type="number" value={formData.costs?.fixed.amortization || ''} onChange={e => handleCostChange('fixed', 'amortization', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">GPS y Satelital</Label>
                    <Input type="number" value={formData.costs?.fixed.satelliteGps || ''} onChange={e => handleCostChange('fixed', 'satelliteGps', e.target.value)} />
                  </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                    <TrendingUp size={16} className="text-blue-600" /> Gastos Variables y Meta
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Service (Costo)</Label>
                      <Input type="number" value={formData.costs?.variable.preventiveMaintenance?.cost || ''} onChange={e => handleCostChange('variable', 'preventiveMaintenance', e.target.value, 'cost')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Frecuencia (KM)</Label>
                      <Input type="number" value={formData.costs?.variable.preventiveMaintenance?.frequencyKm || ''} onChange={e => handleCostChange('variable', 'preventiveMaintenance', e.target.value, 'frequencyKm')} />
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Meta KM Mensual Proyectada</Label>
                    <Input type="number" value={formData.costs?.operational.estimatedMonthlyKm || ''} onChange={e => handleCostChange('operational', 'estimatedMonthlyKm', e.target.value)} />
                    <p className="text-[9px] text-slate-400 italic">Dato vital para prorratear costos fijos sobre el kilometraje.</p>
                  </div>
                </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
             <ChevronLeft size={16} className="mr-1" /> VOLVER
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} className="bg-blue-600">SIGUIENTE <ChevronRight size={16} className="ml-1" /></Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                {truckId ? 'GUARDAR CAMBIOS' : 'HABILITAR UNIDAD'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}