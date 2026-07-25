'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { collection, serverTimestamp, doc, updateDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, ArrowLeft, ArrowRight, Save, Loader2, 
  Gauge, Box, Thermometer, Droplets, Anchor, Layers, 
  Crosshair, CheckCircle2, ChevronRight, ChevronLeft, ShieldCheck, InfoIcon, MapPin
} from "lucide-react";
import { Truck as TruckType } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

  const [formData, setFormData] = useState<Partial<TruckType>>({
    plate: "", chassis: "", brand: "", model: "", year: new Date().getFullYear(),
    axles: 2, vehicleType: "Camión Rígido", capacityKg: 0, volumeM3: 0,
    dimensions: { length: 0, width: 0, height: 0 }, bodyType: "furgon",
    grossWeight: 0, fuelType: "Diesel", tankLiters: 0, odometerKm: 0,
    avgConsumption: 32, status: "available",
    location: { city: "", province: "Buenos Aires", country: "Argentina", lat: 0, lng: 0 }
  });

  const { data: existingTruck, loading: loadingExisting } = useDoc<TruckType>(
    truckId && db ? doc(db, "trucks", truckId) : null
  );

  useEffect(() => {
    if (existingTruck) {
      setFormData(existingTruck);
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
      });
    }
  };

  const handleNumericChange = (field: string, value: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: isNaN(val) ? 0 : val }));
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
        const newRef = doc(collection(db, "drivers"));
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
      toast({ variant: "destructive", title: "Error al guardar los datos" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{truckId ? 'Editar Unidad' : 'Nueva Unidad de Flota'}</h1>
            <p className="text-sm text-slate-500">Gestión de especificaciones técnicas y documentación del vehículo.</p>
          </div>
        </div>
        {formData.plate && (
          <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
            {formData.plate}
          </Badge>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Identificación", icon: InfoIcon },
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

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Datos de Identificación</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Patente / Matrícula</Label>
                  <Input placeholder="AE-123-BC" value={formData.plate || ''} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-2">
                  <Label>Número de Chasis (VIN)</Label>
                  <Input placeholder="17 caracteres" maxLength={17} value={formData.chassis || ''} onChange={e => setFormData({...formData, chassis: e.target.value.toUpperCase()})} />
                </div>
              </div>
              <div className="space-y-4">
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
                <div className="space-y-2">
                  <Label>Año de Fabricación</Label>
                  <Input type="number" value={formData.year || ''} onChange={e => handleNumericChange('year', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Especificaciones Técnicas</CardTitle></CardHeader>
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
                  <Label>Tipo de Carrocería</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {BODY_TYPES.map(type => (
                      <button 
                        key={type.id} 
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Localidad</Label>
                    <Input value={formData.location?.city || ''} onChange={e => setFormData({...formData, location: {...formData.location!, city: e.target.value}})} />
                  </div>
                  <Button variant="outline" className="w-full text-xs" onClick={handleGetLocation}>
                    <Crosshair size={14} className="mr-2" /> Capturar GPS de la Base
                  </Button>
                </div>
                <div className="space-y-4">
                   <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-2"><InfoIcon size={14} /> Sincronización Automática</p>
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
            <ChevronLeft size={16} /> Volver
          </Button>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button onClick={handleNext} className="bg-blue-600 min-w-[120px]">
                Siguiente <ChevronRight size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck size={16} className="mr-2" />}
                {truckId ? 'Guardar Cambios' : 'Habilitar Unidad'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
