'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { collection, serverTimestamp, doc, updateDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Box, ArrowLeft, ArrowRight, Save, Loader2, 
  Scale, Layers, ShieldCheck, CheckCircle2, 
  Info, Tag, Ship, ThermometerSnowflake, 
  AlertTriangle, ScanBarcode, Camera, Image as ImageIcon, 
  ChevronRight, ChevronLeft, Package
} from "lucide-react";
import { Product } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";

interface ProductFormWizardProps {
  productId?: string;
}

const CATEGORIES = ["Alimentos y Bebidas", "Automotriz", "Construcción", "Electrónica", "Farma y Cosmética", "Químicos", "Textil", "Otros"];
const PACKAGING_TYPES = [
  { id: 'pallet', label: 'Pallet Arlog/Euro' },
  { id: 'box', label: 'Caja / Bulto' },
  { id: 'bag', label: 'Bolsa / Saco' },
  { id: 'drum', label: 'Tambor / IBC' },
  { id: 'loose', label: 'Carga Suelta' },
  { id: 'container', label: 'Contenedor' }
];

export default function ProductFormWizard({ productId }: ProductFormWizardProps) {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "",
    name: "",
    brand: "",
    description: "",
    category: "Alimentos y Bebidas",
    unitWeightKg: 0,
    unitVolumeM3: 0,
    unitType: 'unit',
    packagingType: 'pallet',
    unitsPerPallet: 1,
    ncmCode: "",
    gtin: "",
    origin: 'nacional',
    dangerLevel: 'none',
    onuNumber: "",
    requiresReefer: false,
    tempRange: { min: 0, max: 25 },
    status: 'active',
    photoUrl: ""
  });

  const productRef = useMemo(() => 
    productId && db ? doc(db, "products", productId) : null
  , [db, productId]);

  const { data: existingProduct, loading: loadingExisting } = useDoc<Product>(productRef);

  useEffect(() => {
    if (existingProduct) {
      setFormData(existingProduct);
    }
  }, [existingProduct]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingPhoto(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const compressed = await compressImage(base64, 800, 800, 0.7);
          setFormData(prev => ({ ...prev, photoUrl: compressed }));
          toast({ title: "Imagen de producto lista" });
        } catch (err) {
          setFormData(prev => ({ ...prev, photoUrl: base64 }));
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!db) return;
    if (!formData.name || !formData.sku) {
      toast({ variant: "destructive", title: "Faltan datos críticos", description: "Nombre y SKU son obligatorios." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (productId) {
        await updateDoc(doc(db, "products", productId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Producto Actualizado" });
      } else {
        const newRef = doc(collection(db, "products"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Producto Registrado en Catálogo" });
      }
      router.push('/productos');
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && productId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {productId ? 'Editar Ficha Técnica' : 'Nuevo Producto / Carga'}
            </h1>
            <p className="text-sm text-slate-500">Gestión exhaustiva de especificaciones y cumplimiento AR.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
          {formData.sku || 'NUEVO-SKU'}
        </Badge>
      </div>

      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between overflow-x-auto">
        {[
          { id: 1, label: "General", icon: Tag },
          { id: 2, label: "Logística", icon: Scale },
          { id: 3, label: "Aduana / Reg.", icon: Ship },
          { id: 4, label: "Seguridad", icon: ShieldCheck }
        ].map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 min-w-[80px] relative">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
              step > s.id ? "bg-green-500 text-white shadow-sm" : step === s.id ? "bg-blue-600 text-white shadow-lg" : "bg-slate-50 text-slate-300 border"
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

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Información del Artículo</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed rounded-2xl space-y-4">
                  <div className="relative w-40 h-40 bg-white rounded-2xl border-2 border-slate-200 shadow-md flex items-center justify-center overflow-hidden group">
                    {formData.photoUrl ? (
                      <img src={formData.photoUrl} className="w-full h-full object-cover" alt="Producto" />
                    ) : (
                      <Package size={48} className="text-slate-200" />
                    )}
                    {isProcessingPhoto && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600" />
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Camera size={14} className="mr-2" /> {formData.photoUrl ? 'CAMBIAR IMAGEN' : 'SUBIR IMAGEN'}
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center px-4 italic">Suba una foto clara para que el chofer identifique la carga en destino.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1"><Label>SKU / Código Único</Label><Input placeholder="Ej: LOG-AR-1234" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} /></div>
                  <div className="space-y-1"><Label>Nombre del Producto</Label><Input placeholder="Nombre comercial" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Marca / Fabricante</Label><Input placeholder="Marca" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Descripción Técnica</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Detalles del Producto</Label>
                  <Textarea 
                    placeholder="Ingrese una descripción detallada que aparecerá en la Ficha Técnica..." 
                    className="min-h-[120px]"
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Categorización</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Rubro Industrial</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className="bg-white h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de Unidad</Label>
                  <Select value={formData.unitType} onValueChange={(v: any) => setFormData({...formData, unitType: v})}>
                    <SelectTrigger className="bg-white h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit">📦 Por Unidad</SelectItem>
                      <SelectItem value="kg">⚖️ Por Kilogramo</SelectItem>
                      <SelectItem value="liter">🧪 Por Litro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Scale size={18} className="text-blue-600" /> Especificaciones de Carga</CardTitle>
                <CardDescription>Pesos y medidas vitales para el cálculo de flete.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1"><Label>Peso Unitario (KG)</Label><Input type="number" step="0.01" value={formData.unitWeightKg} onChange={e => setFormData({...formData, unitWeightKg: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-1"><Label>Volumen Unitario (M³)</Label><Input type="number" step="0.001" value={formData.unitVolumeM3} onChange={e => setFormData({...formData, unitVolumeM3: parseFloat(e.target.value) || 0})} /></div>
                <div className="space-y-1"><Label>Unidades por Pallet</Label><Input type="number" value={formData.unitsPerPallet} onChange={e => setFormData({...formData, unitsPerPallet: parseInt(e.target.value) || 1})} /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Embalaje y Estibaje</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="grid grid-cols-2 gap-2">
                  {PACKAGING_TYPES.map(type => (
                    <button 
                      key={type.id}
                      onClick={() => setFormData({...formData, packagingType: type.id as any})}
                      className={cn(
                        "p-3 border rounded-xl text-center text-[10px] font-bold uppercase transition-all",
                        formData.packagingType === type.id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-slate-400 hover:border-blue-200"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border">
                  <div className="flex items-center gap-3 text-blue-600 font-black italic">
                    <Layers size={32} /> DIMENSIONES DE CAJA
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label className="text-[9px]">L (cm)</Label><Input type="number" className="bg-white h-8" value={formData.dimensions?.l || 0} onChange={e => setFormData({...formData, dimensions: {...(formData.dimensions || {w:0,h:0,l:0}), l: parseFloat(e.target.value) || 0}})} /></div>
                    <div className="space-y-1"><Label className="text-[9px]">W (cm)</Label><Input type="number" className="bg-white h-8" value={formData.dimensions?.w || 0} onChange={e => setFormData({...formData, dimensions: {...(formData.dimensions || {w:0,h:0,l:0}), w: parseFloat(e.target.value) || 0}})} /></div>
                    <div className="space-y-1"><Label className="text-[9px]">H (cm)</Label><Input type="number" className="bg-white h-8" value={formData.dimensions?.h || 0} onChange={e => setFormData({...formData, dimensions: {...(formData.dimensions || {w:0,h:0,l:0}), h: parseFloat(e.target.value) || 0}})} /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-blue-100 bg-blue-50/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800"><Ship size={18} /> Aduana y Comercio Exterior</CardTitle>
                <CardDescription>Datos mandatorios para MIC/DTA y despachos de puerto.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5"><ScanBarcode size={14} /> Posición Arancelaria (NCM)</Label>
                  <Input placeholder="Ej: 8418.69.90" className="bg-white" value={formData.ncmCode} onChange={e => setFormData({...formData, ncmCode: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Código GTIN / EAN-13</Label>
                  <Input placeholder="Código de barras global" className="bg-white" value={formData.gtin} onChange={e => setFormData({...formData, gtin: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Origen de la Mercadería</Label>
                  <Select value={formData.origin} onValueChange={(v: any) => setFormData({...formData, origin: v})}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">🇦🇷 Industria Nacional</SelectItem>
                      <SelectItem value="importado">🌍 Importado / Extra-zona</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Habilitaciones Sanitarias / Organismos</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-slate-400">N° Certificado SENASA</Label>
                  <Input placeholder="Para alimentos/agroquímicos" value={formData.senasaHabilitation} onChange={e => setFormData({...formData, senasaHabilitation: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-slate-400">N° Registro ANMAT</Label>
                  <Input placeholder="Para farma/cosmética" value={formData.anmatHabilitation} onChange={e => setFormData({...formData, anmatHabilitation: e.target.value})} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <Card className="border-red-100 bg-red-50/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700"><AlertTriangle size={18} /> Seguridad y Materiales Peligrosos</CardTitle>
                <CardDescription>Clasificación técnica para manejo de incidentes y seguros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Nivel de Peligrosidad (IMO)</Label>
                    <Select value={formData.dangerLevel} onValueChange={(v: any) => setFormData({...formData, dangerLevel: v})}>
                      <SelectTrigger className="bg-white h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">🟢 Sin Peligro / General</SelectItem>
                        <SelectItem value="low">🟡 Bajo (Inflamable G3)</SelectItem>
                        <SelectItem value="medium">🟠 Medio (Tóxico G6)</SelectItem>
                        <SelectItem value="high">🔴 Alto (Explosivo/Rad G1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Número ONU / UN Number</Label>
                    <Input placeholder="Ej: UN 1203" className="bg-white" value={formData.onuNumber} onChange={e => setFormData({...formData, onuNumber: e.target.value.toUpperCase()})} />
                  </div>
                </div>

                <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl space-y-6">
                   <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <Label className="flex items-center gap-2 text-blue-800 font-black italic"><ThermometerSnowflake size={20} /> CADENA DE FRÍO (REEFER)</Label>
                       <p className="text-[10px] text-blue-600 font-bold uppercase">Requiere transporte con temperatura controlada</p>
                     </div>
                     <Switch checked={formData.requiresReefer} onCheckedChange={v => setFormData({...formData, requiresReefer: v})} />
                   </div>
                   
                   {formData.requiresReefer && (
                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-100 animate-in fade-in">
                       <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-blue-400">Temp. Mínima (°C)</Label>
                          <Input type="number" className="bg-white" value={formData.tempRange?.min} onChange={e => setFormData({...formData, tempRange: {...(formData.tempRange || {min:0,max:0}), min: parseFloat(e.target.value) || 0}})} />
                       </div>
                       <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-blue-400">Temp. Máxima (°C)</Label>
                          <Input type="number" className="bg-white" value={formData.tempRange?.max} onChange={e => setFormData({...formData, tempRange: {...(formData.tempRange || {min:0,max:0}), max: parseFloat(e.target.value) || 0}})} />
                       </div>
                     </div>
                   )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardFooter className="bg-slate-50 border-t p-6 flex justify-end">
                 <Button onClick={handleSubmit} className="h-14 px-10 rounded-2xl bg-green-600 hover:bg-green-700 font-black shadow-xl" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} 
                   {productId ? 'ACTUALIZAR FICHA' : 'REGISTRAR PRODUCTO'}
                 </Button>
              </CardFooter>
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
              <Button onClick={handleNext} className="bg-blue-600 min-w-[120px]">
                SIGUIENTE <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                EMITIR REGISTRO
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}