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
  Crosshair, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Info, MapPin, Camera, Image as ImageIcon, LayoutGrid, Building2, User, DollarSign, Activity, TrendingUp, Zap, Scale
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
  "Ford": ["Cargo 1723", "Cargo 1933"],
  "Otro": ["Personalizado"]
};

const SEMI_BRANDS = ["Helvética", "Lambert", "Montenegro", "Salto", "Sola y Brusa", "Random", "Otro"];

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", " San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

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
    axles: 2, vehicleType: "Camión Rígido", 
    grossCombinedWeightKg: 45000, unladenWeightKg: 15000, capacityKg: 30000,
    volumeM3: 0,
    dimensions: { length: 0, width: 0, height: 0 }, bodyType: "furgon",
    grossWeight: 0, fuelType: "Diesel", tankLiters: 0, odometerKm: 0,
    avgConsumption: 32, status: "available",
    ownershipType: 'company',
    haulingType: 'standard',
    location: { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 },
    avatarUrl: "",
    semiTrailer: {
      plate: "",
      brand: "",
      model: "",
      year: new Date().getFullYear(),
      type: "plataforma",
      axles: 3
    },
    bitren: {
      type: 'type_a',
      firstSemiPlate: "",
      secondSemiPlate: "",
      totalAxles: 9,
      brand: "",
      model: "",
      year: new Date().getFullYear()
    },
    costs: INITIAL_COSTS
  });

  const truckRef = useMemo(() => 
    truckId && db ? doc(db, "trucks", truckId) : null
  , [db, truckId]);

  const { data: existingTruck, loading: loadingExisting } = useDoc<TruckType>(truckRef);

  const driversQuery = useMemo(() => 
    db ? query(collection(db, "drivers"), orderBy("lastName")) : null
  , [db]);

  const { data: drivers } = useCollection<Driver>(driversQuery);

  const fuelExpensesQuery = useMemo(() => {
    if (!db || !truckId) return null;
    return query(
      collection(db, "global_expenses"), 
      where("truckId", "==", truckId), 
      where("category", "==", "fuel")
    );
  }, [db, truckId]);

  const { data: fuelExpenses } = useCollection<Expense>(fuelExpensesQuery);

  useEffect(() => {
    if (existingTruck) {
      setFormData({
        ...existingTruck,
        location: existingTruck.location || { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 },
        odometerKm: existingTruck.odometerKm || 0,
        avatarUrl: existingTruck.avatarUrl || "",
        ownershipType: existingTruck.ownershipType || 'company',
        haulingType: existingTruck.haulingType || 'standard',
        assignedDriverId: existingTruck.assignedDriverId || "",
        semiTrailer: existingTruck.semiTrailer || { plate: "", brand: "", model: "", year: new Date().getFullYear(), type: "plataforma", axles: 3 },
        bitren: existingTruck.bitren || { type: 'type_a', firstSemiPlate: "", secondSemiPlate: "", totalAxles: 9, brand: "", model: "", year: new Date().getFullYear() },
        costs: existingTruck.costs || INITIAL_COSTS,
        grossCombinedWeightKg: existingTruck.grossCombinedWeightKg || 45000,
        unladenWeightKg: existingTruck.unladenWeightKg || 15000,
        capacityKg: existingTruck.capacityKg || 30000
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

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleGetLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          location: { ...prev.location!, lat: pos.coords.latitude, lng: pos.coords.longitude, country: "Argentina" }
        }));
        toast({ title: "GPS: Ubicación obtenida" });
      }, () => {
        toast({ variant: "destructive", title: "Error GPS", description: "No se pudo obtener la ubicación." });
      });
    }
  };

  const handleNumericChange = (field: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: isNaN(val) ? 0 : val }));
  };

  const handleCostChange = (block: keyof TruckCosts, field: string, value: string, subField?: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setFormData(prev => {
      const currentCosts = prev.costs || INITIAL_COSTS;
      const updatedCosts = JSON.parse(JSON.stringify(currentCosts));
      
      if (subField) {
        if (!updatedCosts[block][field]) updatedCosts[block][field] = {};
        updatedCosts[block][field][subField] = isNaN(val) ? 0 : val;
      } else {
        updatedCosts[block][field] = isNaN(val) ? 0 : val;
      }
      
      return { ...prev, costs: updatedCosts };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingAvatar(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        setFormData(prev => ({ ...prev, avatarUrl: compressed }));
        setIsProcessingAvatar(false);
        toast({ title: "Imagen de unidad optimizada" });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      if (truckId) {
        await updateDoc(doc(db, "trucks", truckId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Unidad Actualizada", description: `Los cambios en ${formData.plate} han sido guardados.` });
      } else {
        const newRef = doc(collection(db, "trucks"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Alta de Unidad Exitosa" });
      }
      router.push('/flota');
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al guardar los datos" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculations = useMemo(() => {
    if (!formData.costs) return { fixedPerKm: 0, oilPerKm: 0, tiresPerKm: 0, fuelPerKm: 0, totalPerKm: 0 };
    
    const costs = formData.costs;
    const kmMensuales = costs.operational.estimatedMonthlyKm || 1;
    
    const sumFixed = Object.values(costs.fixed).reduce((a, b) => a + (b as number), 0);
    const fixedPerKm = sumFixed / kmMensuales;
    
    const oilPerKm = (costs.variable.preventiveMaintenance?.cost || 0) / (costs.variable.preventiveMaintenance?.frequencyKm || 1);
    const tiresPerKm = (costs.variable.tires?.costFullSet || 0) / (costs.variable.tires?.lifeSpanKm || 1);
    const reservePerKm = costs.variable.unforeseenReservePerKm || 0;

    let fuelPerKm = 0;
    if (fuelExpenses && fuelExpenses.length > 0) {
      const validTickets = fuelExpenses.filter(e => !!e.pricePerLiter && e.pricePerLiter > 0);
      if (validTickets.length > 0) {
        const avgPrice = validTickets.reduce((acc, e) => acc + (e.pricePerLiter || 0), 0) / validTickets.length;
        fuelPerKm = (avgPrice * (formData.avgConsumption || 32)) / 100;
      }
    }
    
    const totalPerKm = fixedPerKm + oilPerKm + tiresPerKm + reservePerKm + fuelPerKm;
    
    return { fixedPerKm, oilPerKm, tiresPerKm, reservePerKm, fuelPerKm, totalPerKm };
  }, [formData.costs, formData.avgConsumption, fuelExpenses]);

  if (loadingExisting && truckId) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cargando ficha técnica...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{truckId ? 'Editar Unidad' : 'Nueva Unidad de Flota'}</h1>
            <p className="text-sm text-slate-500">Gestión de especificaciones técnicas, documentación y costos.</p>
          </div>
        </div>
        {formData.plate && (
          <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100 hidden sm:flex">
            {formData.plate}
          </Badge>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm mx-4">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Identificación", icon: Info },
            { id: 2, label: "Arrastre", icon: Truck },
            { id: 3, label: "Pesos y GPS", icon: MapPin },
            { id: 4, label: "Costos", icon: DollarSign }
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
                step > s.id ? "bg-green-50 text-white" : step === s.id ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 text-slate-300 border"
              )}>
                {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
              </div>
              <span className={cn("text-[9px] uppercase font-bold text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>
                {s.label}
              </span>
              {s.id < 4 && <div className={cn("absolute top-4.5 left-1/2 w-full h-[1px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in duration-300 mx-4">
        {step === 1 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Identificación y Titularidad</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
                  <Avatar className="w-32 h-32 border-4 border-white shadow-xl rounded-2xl">
                    <AvatarImage src={formData.avatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-blue-100 text-blue-600 rounded-2xl">
                      <Truck size={48} />
                    </AvatarFallback>
                  </Avatar>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  <Button variant="outline" type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="bg-white" disabled={isProcessingAvatar}>
                    {isProcessingAvatar ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera size={14} className="mr-2" />} 
                    {formData.avatarUrl ? 'Cambiar Foto' : 'Subir Foto'}
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Patente / Matrícula</Label>
                    <Input placeholder="AE-123-BC" value={formData.plate ?? ''} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Titularidad del Vehículo</Label>
                    <Select value={formData.ownershipType} onValueChange={(v: OwnershipType) => setFormData({...formData, ownershipType: v})}>
                      <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Propio (Empresa)</SelectItem>
                        <SelectItem value="third_party">Tercero (Chofer / Propietario)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Chofer Asignado</Label>
                    <Select value={formData.assignedDriverId} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar chofer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {drivers?.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.lastName}, {d.firstName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Marca</Label>
                      <Select value={formData.brand} onValueChange={v => setFormData({...formData, brand: v, model: ""})}>
                        <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(BRANDS).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={formData.model} onValueChange={v => setFormData({...formData, model: v})} disabled={!formData.brand}>
                        <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
                        <SelectContent>
                          {formData.brand && (BRANDS as any)[formData.brand]?.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Configuración de Arrastre</CardTitle>
                <CardDescription>Defina si la unidad opera con semirremolque standard o en modo Bitrén.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    type="button"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all",
                      formData.haulingType === 'standard' ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-500 border-slate-100"
                    )}
                    onClick={() => {
                      setFormData({...formData, haulingType: 'standard', grossCombinedWeightKg: 45000});
                    }}
                  >
                    <Layers size={32} />
                    <span className="font-black uppercase text-xs">Semirremolque Standard (45tn)</span>
                  </button>
                  <button 
                    type="button"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all",
                      formData.haulingType === 'bitren' ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-500 border-slate-100"
                    )}
                    onClick={() => {
                      setFormData({...formData, haulingType: 'bitren', grossCombinedWeightKg: 60000});
                    }}
                  >
                    <div className="flex gap-1"><Layers size={24} /><Layers size={24} /></div>
                    <span className="font-black uppercase text-xs">Unidad Bitrén (60/75tn)</span>
                  </button>
                </div>

                {formData.haulingType === 'standard' ? (
                  <div className="p-6 bg-slate-50 rounded-2xl space-y-4 animate-in fade-in">
                    <h3 className="text-sm font-bold flex items-center gap-2"><LayoutGrid size={16}/> Datos Semirremolque</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Patente Semi</Label>
                        <Input className="bg-white" value={formData.semiTrailer?.plate} onChange={e => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, plate: e.target.value.toUpperCase()}})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Marca</Label>
                        <Select value={formData.semiTrailer?.brand} onValueChange={v => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, brand: v}})}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{SEMI_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Ejes</Label>
                        <Input className="bg-white" type="number" value={formData.semiTrailer?.axles} onChange={e => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, axles: parseInt(e.target.value) || 0}})} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-start">
                       <h3 className="text-sm font-bold flex items-center gap-2 text-blue-800"><Zap size={16}/> Configuración Bitrén (Res. 1196/2025)</h3>
                       <Badge className="bg-blue-600 text-[10px]">Alta Capacidad</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-blue-600">Tipo de Bitrén</Label>
                          <Select value={formData.bitren?.type} onValueChange={(v: any) => {
                            setFormData({
                              ...formData, 
                              bitren: {...formData.bitren!, type: v},
                              grossCombinedWeightKg: v === 'type_a' ? 60000 : 75000
                            });
                          }}>
                             <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="type_a">Tipo A (hasta 22,40m / 60tn)</SelectItem>
                                <SelectItem value="type_b">Tipo B (hasta 30,25m / 75tn)</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-blue-600">Cantidad de Ejes Totales</Label>
                          <Input className="bg-white" type="number" value={formData.bitren?.totalAxles} onChange={e => setFormData({...formData, bitren: {...formData.bitren!, totalAxles: parseInt(e.target.value) || 0}})} />
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1 p-3 bg-white rounded-xl border">
                          <Label className="text-[9px] uppercase font-black text-slate-400">Patente 1er Semi (Enganche Tractor)</Label>
                          <Input className="h-8 font-mono font-bold" value={formData.bitren?.firstSemiPlate} onChange={e => setFormData({...formData, bitren: {...formData.bitren!, firstSemiPlate: e.target.value.toUpperCase()}})} />
                       </div>
                       <div className="space-y-1 p-3 bg-white rounded-xl border">
                          <Label className="text-[9px] uppercase font-black text-slate-400">Patente 2do Semi (Enganche Final)</Label>
                          <Input className="h-8 font-mono font-bold" value={formData.bitren?.secondSemiPlate} onChange={e => setFormData({...formData, bitren: {...formData.bitren!, secondSemiPlate: e.target.value.toUpperCase()}})} />
                       </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Control de Pesos y Ubicación Base</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-6 shadow-xl">
                  <div className="flex items-center gap-2 text-blue-400 font-bold uppercase text-[10px] tracking-widest border-b border-white/10 pb-2">
                    <Scale size={16} /> Parámetros de Pesaje Legal
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <Label className="text-white/50 text-[10px] uppercase font-black">PBTC Máximo (Kilogramos)</Label>
                      <Input 
                        type="number" 
                        className="bg-white/5 border-white/10 text-white font-mono text-2xl h-14"
                        value={formData.grossCombinedWeightKg ?? 0} 
                        onChange={e => handleNumericChange('grossCombinedWeightKg', e.target.value)} 
                      />
                      <p className="text-[8px] text-blue-400 italic font-bold">Peso Máximo Combinado Autorizado (Camión + Carga)</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/50 text-[10px] uppercase font-black">Tara del Vehículo (Kilogramos)</Label>
                      <Input 
                        type="number" 
                        className="bg-white/5 border-white/10 text-white font-mono text-2xl h-14"
                        value={formData.unladenWeightKg ?? 0} 
                        onChange={e => handleNumericChange('unladenWeightKg', e.target.value)} 
                      />
                      <p className="text-[8px] text-white/30 italic">Peso del camión vacío y con tanques llenos.</p>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
                       <div className="text-[10px] uppercase font-bold text-blue-400">Capacidad de Carga Útil Calc.</div>
                       <div className="text-3xl font-black italic text-green-400">
                         {(formData.capacityKg || 0).toLocaleString()} <span className="text-sm uppercase font-normal opacity-50">KG</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 border rounded-2xl space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Gauge size={14}/> Telemetría y GPS Base
                     </p>
                     <div className="space-y-2">
                        <Label>Kilometraje (Odómetro)</Label>
                        <Input type="number" className="bg-white" value={formData.odometerKm ?? 0} onChange={e => handleNumericChange('odometerKm', e.target.value)} />
                     </div>
                     <div className="space-y-2">
                        <Label>Consumo Objetivo (L/100km)</Label>
                        <Input type="number" className="bg-white" value={formData.avgConsumption ?? 32} onChange={e => handleNumericChange('avgConsumption', e.target.value)} />
                     </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Provincia Base</Label>
                      <Select value={formData.location?.province} onValueChange={v => setFormData({...formData, location: {...formData.location!, province: v, country: "Argentina"}})}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>{PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Localidad</Label>
                      <Input value={formData.location?.city ?? ''} onChange={e => setFormData({...formData, location: {...formData.location!, city: e.target.value}})} />
                    </div>
                    <Button variant="outline" type="button" className="w-full text-xs font-bold" onClick={handleGetLocation}>
                      <Crosshair size={14} className="mr-2" /> CAPTURAR POSICIÓN BASE
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative rounded-3xl">
               <div className="absolute top-0 right-0 p-4 opacity-5"><Layers size={120}/></div>
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm font-black flex items-center gap-2 text-blue-400 uppercase italic">
                   <Gauge size={20} /> Análisis de Costos Proyectados
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-6 relative">
                  <div className="text-center py-4">
                     <p className="text-5xl font-black italic text-green-400">${calculations.totalPerKm.toFixed(2)}</p>
                     <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest mt-1">Costo Teórico Total por Kilómetro</p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div>
                       <p className="text-[8px] text-white/40 uppercase font-black">Fijos (KM)</p>
                       <p className="text-xs font-bold text-blue-300">${calculations.fixedPerKm.toFixed(2)}</p>
                     </div>
                     <div>
                       <p className="text-[8px] text-white/40 uppercase font-black">Mantenimiento (KM)</p>
                       <p className="text-xs font-bold text-orange-300">${calculations.oilPerKm.toFixed(2)}</p>
                     </div>
                     <div>
                       <p className="text-[8px] text-white/40 uppercase font-black">Neumáticos (KM)</p>
                       <p className="text-xs font-bold text-purple-300">${calculations.tiresPerKm.toFixed(2)}</p>
                     </div>
                     <div>
                       <p className="text-[8px] text-white/40 uppercase font-black">Combustible (KM)</p>
                       <p className="text-xs font-bold text-green-300">${calculations.fuelPerKm.toFixed(2)}</p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="space-y-6">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b py-4">
                    <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                      <TrendingUp size={16}/> Gastos Variables
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-4">
                       <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest border-b pb-1">Mantenimiento Preventivo (Filtros/Aceite)</p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Costo del Service</Label>
                            <Input type="number" value={formData.costs?.variable.preventiveMaintenance?.cost || ''} onChange={e => handleCostChange('variable', 'preventiveMaintenance', e.target.value, 'cost')} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Frecuencia (KM)</Label>
                            <Input type="number" value={formData.costs?.variable.preventiveMaintenance?.frequencyKm || ''} onChange={e => handleCostChange('variable', 'preventiveMaintenance', e.target.value, 'frequencyKm')} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest border-b pb-1">Neumáticos (Costo por Set)</p>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Costo Total Set</Label>
                            <Input type="number" value={formData.costs?.variable.tires?.costFullSet || ''} onChange={e => handleCostChange('variable', 'tires', e.target.value, 'costFullSet')} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Vida Útil (KM)</Label>
                            <Input type="number" value={formData.costs?.variable.tires?.lifeSpanKm || ''} onChange={e => handleCostChange('variable', 'tires', e.target.value, 'lifeSpanKm')} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Reserva p/ Imprevistos (por KM)</Label>
                      <Input type="number" value={formData.costs?.variable.unforeseenReservePerKm || ''} onChange={e => handleCostChange('variable', 'unforeseenReservePerKm', e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-slate-50">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm flex items-center gap-2"><Activity size={16}/> Meta Mensual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Kilómetros Mensuales Proyectados</Label>
                        <Input 
                          type="number" 
                          className="bg-white h-10 font-bold"
                          value={formData.costs?.operational.estimatedMonthlyKm || ''} 
                          onChange={e => handleCostChange('operational', 'estimatedMonthlyKm', e.target.value)}
                        />
                        <p className="text-[9px] text-slate-400 italic">Dato vital para prorratear costos fijos sobre el kilometraje.</p>
                    </div>
                  </CardContent>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft size={16} className="mr-1" /> Volver
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} className="bg-blue-600 min-w-[120px] font-bold">
                Siguiente <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px] font-bold" disabled={isSubmitting || isProcessingAvatar}>
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
