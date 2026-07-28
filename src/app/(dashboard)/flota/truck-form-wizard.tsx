'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { collection, serverTimestamp, doc, updateDoc, setDoc, query, orderBy, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, ArrowLeft, ArrowRight, Save, Loader2, 
  Gauge, Box, Anchor, Layers, 
  Crosshair, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Info, MapPin, Camera, Image as ImageIcon, LayoutGrid, Building2, User, DollarSign, Activity, TrendingUp, Zap, Scale, Trash2, Plus, UserCheck
} from "lucide-react";
import { Truck as TruckType, Driver, OwnershipType, TruckCosts, Expense } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";

interface TruckFormWizardProps {
  truckId?: string;
}

const BRANDS = {
  "Scania": ["R450", "R500", "G410", "P320", "S500"],
  "Volvo": ["FH540", "FMX460", "FH420", "FM330"],
  "Mercedes-Benz": ["Actros 2651", "Axor 2544", "Atego 1722"],
  "Iveco": ["Stralis Hi-Way", "Trakker", "Tector 170E28"],
  "Volkswagen": ["Constellation 19.330", "Delivery 9.170"],
  "Otro": ["Personalizado"]
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleNumericChange = (field: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: isNaN(val) ? 0 : val }));
  };

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
        toast({ title: "Alta de Unidad Exitosa" });
      }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div><h1 className="text-2xl font-bold">Gestión de Unidad</h1></div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
         {[
            { id: 1, label: "Identificación", icon: Info },
            { id: 2, label: "Arrastre", icon: Truck },
            { id: 3, label: "Pesos", icon: Scale },
            { id: 4, label: "Costos", icon: DollarSign }
          ].map(s => (
            <div key={s.id} className={cn("flex flex-col items-center gap-1 flex-1", step === s.id ? "text-blue-600" : "text-slate-400")}>
               <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border", step >= s.id ? "bg-blue-600 text-white border-blue-600" : "bg-white")}>
                 {step > s.id ? <CheckCircle2 size={16} /> : <s.icon size={16} />}
               </div>
               <span className="text-[9px] font-bold uppercase">{s.label}</span>
            </div>
          ))}
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card><CardHeader><CardTitle>Datos Básicos</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Patente</Label><Input value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} /></div><div className="space-y-2"><Label>Chofer</Label><Select value={formData.assignedDriverId || 'none'} onValueChange={v => setFormData({...formData, assignedDriverId: v})}><SelectTrigger><SelectValue placeholder="Elegir" /></SelectTrigger><SelectContent><SelectItem value="none">Sin asignar</SelectItem>{driversOnly.map(d => <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
        )}

        {step === 2 && (
          <Card><CardHeader><CardTitle>Configuración Arrastre</CardTitle></CardHeader><CardContent className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <Button variant={formData.haulingType === 'standard' ? 'default' : 'outline'} onClick={() => setFormData({...formData, haulingType: 'standard', grossCombinedWeightKg: 45000})}>Standard (45tn)</Button>
                <Button variant={formData.haulingType === 'bitren' ? 'default' : 'outline'} onClick={() => setFormData({...formData, haulingType: 'bitren', grossCombinedWeightKg: 60000})}>Bitrén (60/75tn)</Button>
             </div>
             {formData.haulingType === 'bitren' && (
                <div className="p-4 bg-blue-50 rounded-xl space-y-4">
                   <h3 className="text-xs font-bold flex items-center gap-2 text-blue-700"><Zap size={14}/> Configuración Bitrén</h3>
                   <div className="grid grid-cols-2 gap-4"><Input placeholder="Patente 1er Semi" value={formData.bitren?.firstSemiPlate} onChange={e => setFormData({...formData, bitren: {...(formData.bitren || {} as any), firstSemiPlate: e.target.value.toUpperCase()}})} /><Input placeholder="Patente 2do Semi" value={formData.bitren?.secondSemiPlate} onChange={e => setFormData({...formData, bitren: {...(formData.bitren || {} as any), secondSemiPlate: e.target.value.toUpperCase()}})} /></div>
                </div>
             )}
          </CardContent></Card>
        )}

        {step === 3 && (
          <Card><CardHeader><CardTitle>Balance de Pesos Legal</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-6">
             <div className="space-y-2"><Label>PBTC Máx (kg)</Label><Input type="number" value={formData.grossCombinedWeightKg} onChange={e => handleNumericChange('grossCombinedWeightKg', e.target.value)} /></div>
             <div className="space-y-2"><Label>Tara (kg)</Label><Input type="number" value={formData.unladenWeightKg} onChange={e => handleNumericChange('unladenWeightKg', e.target.value)} /></div>
             <div className="col-span-2 p-4 bg-green-50 border border-green-100 rounded-xl"><p className="text-xs font-bold text-green-700 uppercase">Carga Útil Habilitada: {(formData.capacityKg || 0).toLocaleString()} KG</p></div>
          </CardContent></Card>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                    <Building2 size={16}/> Gastos Fijos Mensuales
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                      <Label className="text-[10px] uppercase font-bold text-slate-400">GPS / Satelital</Label>
                      <Input type="number" value={formData.costs?.fixed.satelliteGps || ''} onChange={e => handleCostChange('fixed', 'satelliteGps', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Cochera / Admin</Label>
                      <Input type="number" value={formData.costs?.fixed.garageAdmin || ''} onChange={e => handleCostChange('fixed', 'garageAdmin', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Impuestos y Habilitaciones</Label>
                      <Input type="number" value={formData.costs?.fixed.taxesHabilitations || ''} onChange={e => handleCostChange('fixed', 'taxesHabilitations', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Amortización / Reserva</Label>
                      <Input type="number" value={formData.costs?.fixed.amortization || ''} onChange={e => handleCostChange('fixed', 'amortization', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                    <TrendingUp size={16}/> Gastos Variables y Meta
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Service (Costo)</Label>
                      <Input type="number" value={formData.costs?.variable.preventiveMaintenance?.cost || ''} onChange={e => handleCostChange('variable', 'preventiveMaintenance', e.target.value, 'cost')} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Meta KM Mensual</Label>
                      <Input type="number" value={formData.costs?.operational.estimatedMonthlyKm || ''} onChange={e => handleCostChange('operational', 'estimatedMonthlyKm', e.target.value)} />
                    </div>
                  </div>
                </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 1 || isSubmitting}><ChevronLeft className="mr-1" size={16} /> Volver</Button>
          {step < 4 ? <Button onClick={() => setStep(step + 1)}>Siguiente <ChevronRight className="ml-1" size={16} /></Button> : <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR</Button>}
        </div>
      </div>
    </div>
  );
}
