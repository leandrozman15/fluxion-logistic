
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
import { 
  Truck, ArrowLeft, ArrowRight, Save, Loader2, 
  Gauge, Box, Thermometer, Droplets, Anchor, Layers, 
  Crosshair, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, Info, MapPin, Camera, Image as ImageIcon, LayoutGrid, Users, Building2, User
} from "lucide-react";
import { Truck as TruckType, Driver, OwnershipType } from "@/app/lib/types";
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
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

const BODY_TYPES = [
  { id: "furgon", label: "Furgón Cerrado", icon: Box },
  { id: "reefer", label: "Refrigerado", icon: Thermometer },
  { id: "plataforma", label: "Plataforma", icon: Layers },
  { id: "cisterna", label: "Cisterna", icon: Droplets },
  { id: "volquete", label: "Volquete", icon: Anchor },
];

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
    axles: 2, vehicleType: "Camión Rígido", capacityKg: 0, volumeM3: 0,
    dimensions: { length: 0, width: 0, height: 0 }, bodyType: "furgon",
    grossWeight: 0, fuelType: "Diesel", tankLiters: 0, odometerKm: 0,
    avgConsumption: 32, status: "available",
    ownershipType: 'company',
    location: { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 },
    avatarUrl: "",
    semiTrailer: {
      plate: "",
      brand: "",
      model: "",
      year: new Date().getFullYear(),
      type: "plataforma",
      axles: 3
    }
  });

  const truckRef = useMemo(() => 
    truckId && db ? doc(db, "trucks", truckId) : null
  , [db, truckId]);

  const { data: existingTruck, loading: loadingExisting } = useDoc<TruckType>(truckRef);

  const driversQuery = useMemo(() => 
    db ? query(collection(db, "drivers"), orderBy("lastName")) : null
  , [db]);

  const { data: drivers } = useCollection<Driver>(driversQuery);

  useEffect(() => {
    if (existingTruck) {
      setFormData({
        ...existingTruck,
        location: existingTruck.location || { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 },
        odometerKm: existingTruck.odometerKm || 0,
        avatarUrl: existingTruck.avatarUrl || "",
        ownershipType: existingTruck.ownershipType || 'company',
        assignedDriverId: existingTruck.assignedDriverId || "",
        semiTrailer: existingTruck.semiTrailer || { plate: "", brand: "", model: "", year: new Date().getFullYear(), type: "plataforma", axles: 3 }
      });
    }
  }, [existingTruck]);

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
            <p className="text-sm text-slate-500">Gestión de especificaciones técnicas y documentación del vehículo.</p>
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
            { id: 2, label: "Especificaciones", icon: Gauge },
            { id: 3, label: "Ubicación Base", icon: MapPin }
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
              {s.id < 3 && <div className={cn("absolute top-4.5 left-1/2 w-full h-[1px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
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
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold uppercase text-slate-600">Foto de la Unidad</p>
                    <p className="text-[10px] text-slate-400">Identificación visual para el panel</p>
                  </div>
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
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company"><div className="flex items-center gap-2"><Building2 size={14} className="text-blue-600"/> Propio (Empresa)</div></SelectItem>
                        <SelectItem value="third_party"><div className="flex items-center gap-2"><User size={14} className="text-orange-600"/> Tercero (Chofer / Propietario)</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Chofer Asignado</Label>
                    <Select value={formData.assignedDriverId} onValueChange={v => setFormData({...formData, assignedDriverId: v})}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccionar chofer" />
                      </SelectTrigger>
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
              <CardHeader><CardTitle>Unidad Tractora</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-6">
                    <div className="flex items-center gap-2 text-blue-400 font-bold uppercase text-[10px] tracking-widest">
                      <Gauge size={16}/> Estado del Odómetro
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/50 text-[10px] uppercase">Kilometraje Actual (KM)</Label>
                      <Input 
                        type="number" 
                        className="bg-white/5 border-white/10 text-white font-mono text-2xl h-14"
                        value={formData.odometerKm ?? 0} 
                        onChange={e => handleNumericChange('odometerKm', e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/50 text-[10px] uppercase">Consumo Objetivo (L/100km)</Label>
                      <Input 
                        type="number" 
                        className="bg-white/5 border-white/10 text-white"
                        value={formData.avgConsumption ?? 32} 
                        onChange={e => handleNumericChange('avgConsumption', e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Tipo de Carrocería (Camión)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {BODY_TYPES.map(type => (
                        <button 
                          key={type.id} 
                          type="button"
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all text-center",
                            formData.bodyType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                          )}
                          onClick={() => setFormData({...formData, bodyType: type.id})}
                        >
                          <type.icon size={20} />
                          <span className="text-[10px] uppercase font-black">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-l-4 border-l-blue-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid size={20} className="text-blue-600" /> Semirremolque / Acoplado
                </CardTitle>
                <CardDescription>Registre los datos del equipo de arrastre asignado.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Patente Semirremolque</Label>
                    <Input 
                      placeholder="N° de Patente" 
                      value={formData.semiTrailer?.plate ?? ''} 
                      onChange={e => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, plate: e.target.value.toUpperCase()}})} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Marca Acoplado</Label>
                      <Select 
                        value={formData.semiTrailer?.brand} 
                        onValueChange={v => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, brand: v}})}
                      >
                        <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                        <SelectContent>
                          {SEMI_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Input 
                        type="number" 
                        value={formData.semiTrailer?.year ?? 0} 
                        onChange={e => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, year: parseInt(e.target.value) || 0}})} 
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Batea / Equipo</Label>
                    <Select 
                      value={formData.semiTrailer?.type} 
                      onValueChange={v => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, type: v}})}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>
                        {BODY_TYPES.map(bt => <SelectItem key={bt.id} value={bt.id}>{bt.label}</SelectItem>)}
                        <SelectItem value="sider">Sider / Cortina</SelectItem>
                        <SelectItem value="jaula">Ganadero / Jaula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cantidad de Ejes</Label>
                    <Input 
                      type="number" 
                      value={formData.semiTrailer?.axles ?? 3} 
                      onChange={e => setFormData({...formData, semiTrailer: {...formData.semiTrailer!, axles: parseInt(e.target.value) || 0}})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Ubicación y Estado Operativo</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Provincia Base</Label>
                    <Select value={formData.location?.province} onValueChange={v => setFormData({...formData, location: {...formData.location!, province: v, country: "Argentina"}})}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccionar provincia" /></SelectTrigger>
                      <SelectContent>
                        {PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Localidad</Label>
                    <Input className="bg-white" value={formData.location?.city ?? ''} onChange={e => setFormData({...formData, location: {...formData.location!, city: e.target.value}})} />
                  </div>
                  <Button variant="outline" type="button" className="w-full text-xs" onClick={handleGetLocation}>
                    <Crosshair size={14} className="mr-2" /> Capturar GPS de la Base
                  </Button>
                </div>
                <div className="space-y-4">
                   <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-2"><Info size={14} /> Sincronización Automática</p>
                      <p className="text-[10px] text-blue-600 leading-relaxed">
                        Al guardar, el sistema validará el estado de la VTV y Seguro. Asegúrese de que el odómetro sea el reflejado en el último ticket de combustible para un cálculo de eficiencia preciso.
                      </p>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft size={16} className="mr-1" /> Volver
          </Button>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button onClick={handleNext} className="bg-blue-600 min-w-[120px]">
                Siguiente <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting || isProcessingAvatar}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                {truckId ? 'Guardar Cambios' : 'Habilitar Unidad'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
