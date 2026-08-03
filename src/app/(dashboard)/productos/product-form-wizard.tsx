'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Box, ArrowLeft, Save, Loader2, 
  Scale, Layers, CheckCircle2, 
  Info, Camera, ChevronRight, ChevronLeft, Warehouse, Plus, Trash2, Zap, DollarSign,
  ShieldAlert, ThermometerSnowflake, Ship, ScanBarcode, PackageSearch
} from "lucide-react";
import { Product, Hub, ProductWarehouse, ProductVariant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";
import { createProduct, getProduct, updateProduct } from "@/lib/products-api";
import { listHubs } from "@/lib/hubs-api";

interface ProductFormWizardProps {
  productId?: string;
}

const CATEGORIES = ["Alimentos y Bebidas", "Automotriz", "Construcción", "Electrónica", "Farma y Cosmética", "Químicos", "Textil", "Otros"];
const UNIT_TYPES = [
  { id: 'unit', label: 'Unidad' },
  { id: 'kg', label: 'Kilogramo' },
  { id: 'liter', label: 'Litro' },
  { id: 'meter', label: 'Metro' },
  { id: 'box', label: 'Caja' },
  { id: 'bag', label: 'Bolsa' },
];

export default function ProductFormWizard({ productId }: ProductFormWizardProps) {
  const { tenantId, role } = useTenant();
  useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(productId));
  const [hubs, setHubs] = useState<Hub[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManager = useMemo(() => role === 'manager' || role === 'admin', [role]);

  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "", gtin: "", name: "", brand: "", model: "", description: "", category: "Alimentos y Bebidas",
    unitWeightKg: 0, unitVolumeM3: 0, packagingType: 'pallet', status: 'active', photoUrl: "",
    unitType: 'unit', unitsPerBox: 0, unitsPerPallet: 0, origin: 'nacional',
    managesStock: true, minStockAlert: 5, stockQuantity: 0, ivaRate: 21, 
    dangerLevel: 'none', onuNumber: "", requiresReefer: false,
    tempRange: { min: 2, max: 8 }, ncmCode: "",
    hasVariants: false, variants: [], warehouses: [], 
    listPrice: 0, avgCost: 0, markup: 0
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setLoadingExisting(false);
          setHubs([]);
        }
        return;
      }

      try {
        const [hubsRows, productRow] = await Promise.all([
          listHubs(),
          productId ? getProduct(productId) : Promise.resolve(null),
        ]);

        if (!active) return;
        setHubs(hubsRows);
        if (productRow) setFormData(productRow);
      } catch (error) {
        if (active) {
          toast({ variant: "destructive", title: "Error al cargar datos", description: (error as Error).message });
        }
      } finally {
        if (active) setLoadingExisting(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, productId, toast]);

  useEffect(() => {
    if (hubs && (formData.warehouses?.length === 0 || !formData.warehouses)) {
      const initialWarehouses = hubs.map(h => ({
        hubId: h.id,
        hubName: h.name,
        location: "",
        stockQuantity: 0,
        minStock: 5,
        maxStock: 100
      }));
      setFormData(prev => ({ ...prev, warehouses: initialWarehouses }));
    }
  }, [hubs]);

  useEffect(() => {
    if (!productId && !formData.sku) {
      setFormData(prev => ({ ...prev, sku: `PROD-${Date.now().toString().slice(-6)}` }));
    }
  }, [productId]);

  const handleBack = () => setStep(prev => Math.max(1, prev - 1));
  
  const handleNext = () => {
    if (step === 1) {
      if (!formData.name) return toast({ variant: "destructive", title: "Falta Nombre", description: "El nombre del producto es obligatorio." });
      if (!formData.sku) return toast({ variant: "destructive", title: "Falta SKU", description: "Debe definir un código SKU madre." });
    }
    setStep(prev => Math.min(6, prev + 1));
  };

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setIsProcessingPhoto('main');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        const fileName = `product_${Date.now()}.jpg`;
        const storagePath = `tenants/${tenantId}/products/${formData.sku || 'temp'}/main_${fileName}`;
        const url = await uploadBase64(storagePath, compressed);

        setFormData(prev => ({ ...prev, photoUrl: url }));
        toast({ title: "Imagen actualizada" });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al subir" });
      } finally {
        setIsProcessingPhoto(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWarehouseChange = (hubId: string, field: keyof ProductWarehouse, value: any) => {
    setFormData(prev => ({
      ...prev,
      warehouses: (prev.warehouses || []).map(w => 
        w.hubId === hubId ? { ...w, [field]: value } : w
      )
    }));
  };

  const handleSubmit = async () => {
    if (!tenantId || !formData.name || !formData.sku) return;
    setIsSubmitting(true);
    try {
      const totalStock = (formData.warehouses || []).reduce((acc, w) => acc + (w.stockQuantity || 0), 0);
      const finalData = { ...formData, stockQuantity: totalStock };
      
      if (productId) {
        await updateProduct(productId, finalData);
      } else {
        await createProduct(finalData);
      }

      toast({ title: "Producto Guardado", description: "Los cambios ya están en el catálogo central." });
      router.push('/productos');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && productId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Ficha Técnica del Producto</h1>
            <p className="text-sm text-slate-500 font-medium">Parámetros de distribución, seguridad y stock regional.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono font-black text-blue-600 bg-blue-50 border-blue-100">{formData.sku || 'NUEVO_ARTICULO'}</Badge>
      </div>

      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between overflow-x-auto gap-4">
         {[
           { id: 1, label: "Identidad", icon: Info },
           { id: 2, label: "Logística", icon: Scale },
           { id: 3, label: "Seguridad", icon: ShieldAlert },
           { id: 4, label: "Comex", icon: Ship },
           { id: 5, label: "Stock/Sedes", icon: Warehouse },
           { id: 6, label: "Precios", icon: DollarSign }
         ].map(s => (
           <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative min-w-[80px]">
             <div className={cn(
               "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all", 
               step === s.id ? "bg-blue-600 text-white border-blue-600 shadow-lg" : 
               step > s.id ? "bg-green-500 text-white border-green-500" : "bg-white text-slate-300 border-slate-100"
             )}>
               {step > s.id ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
             </div>
             <span className={cn("text-[9px] font-black uppercase text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>{s.label}</span>
             {s.id < 6 && <div className={cn("absolute top-5 left-1/2 w-full h-[2px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
           </div>
         ))}
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        {/* PASO 1: IDENTIDAD */}
        {step === 1 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Box size={18} className="text-blue-400"/> 1. Identificación del Artículo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-8 p-8">
              <div className="md:col-span-4 flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed rounded-[2rem]">
                 <div className="relative w-48 h-48 bg-white rounded-3xl border-2 border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                   {formData.photoUrl ? <img src={formData.photoUrl} className="w-full h-full object-cover" /> : <PackageSearch size={64} className="text-slate-200" />}
                   {isProcessingPhoto === 'main' && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('photoUrl', e)} />
                 <Button variant="outline" className="w-full rounded-xl h-11 font-bold text-xs uppercase" onClick={() => fileInputRef.current?.click()} disabled={!!isProcessingPhoto}><Camera size={16} className="mr-2 text-blue-500" /> SUBIR IMAGEN</Button>
              </div>
              <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">SKU (Interno)</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-black" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} /></div>
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">GTIN / EAN-13</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-mono" value={formData.gtin} onChange={e => setFormData({...formData, gtin: e.target.value})} /></div>
                 <div className="md:col-span-2 space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Nombre Comercial</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-bold text-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Marca</Label><Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Categoría</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                       <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                       <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
                 <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Descripción Técnica</Label>
                    <Textarea className="h-24 bg-slate-50 border-none rounded-2xl p-4 text-xs italic" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PASO 2: LOGÍSTICA */}
        {step === 2 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-blue-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Scale size={18}/> 2. Especificaciones de Distribución</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Peso Bruto (KG)</Label><Input type="number" step="0.01" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl" value={formData.unitWeightKg} onChange={e => setFormData({...formData, unitWeightKg: parseFloat(e.target.value) || 0})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Volumen (M3)</Label><Input type="number" step="0.001" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl" value={formData.unitVolumeM3} onChange={e => setFormData({...formData, unitVolumeM3: parseFloat(e.target.value) || 0})} /></div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Unidad de Medida</Label>
                      <Select value={formData.unitType} onValueChange={(v: any) => setFormData({...formData, unitType: v})}>
                         <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                         <SelectContent>{UNIT_TYPES.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="p-8 bg-slate-900 text-white rounded-[2rem] space-y-6">
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-400 tracking-widest"><Layers size={14}/> Estructura de Embalaje y Estiba</div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5"><Label className="text-[9px] font-black text-white/40 uppercase">Unidades por Caja</Label><Input type="number" className="h-11 bg-white/10 border-none rounded-xl text-white" value={formData.unitsPerBox} onChange={e => setFormData({...formData, unitsPerBox: parseInt(e.target.value) || 0})} /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] font-black text-white/40 uppercase">Cajas por Pallet</Label><Input type="number" className="h-11 bg-white/10 border-none rounded-xl text-white" value={formData.cajasPerPallet} onChange={e => setFormData({...formData, cajasPerPallet: parseInt(e.target.value) || 0})} /></div>
                      <div className="space-y-1.5"><Label className="text-[9px] font-black text-white/40 uppercase">Unidades x Pallet (Total)</Label><Input type="number" className="h-11 bg-white/10 border-none rounded-xl text-white font-black" value={formData.unitsPerPallet} onChange={e => setFormData({...formData, unitsPerPallet: parseInt(e.target.value) || 0})} /></div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[9px] font-black text-white/40 uppercase">Tipo de Pallet / Batea</Label>
                      <Select value={formData.packagingType} onValueChange={(v: any) => setFormData({...formData, packagingType: v})}>
                         <SelectTrigger className="bg-white/10 border-none rounded-xl text-white"><SelectValue /></SelectTrigger>
                         <SelectContent><SelectItem value="pallet">Estandard (1.20 x 1.00)</SelectItem><SelectItem value="euro">Euro Pallet (1.20 x 0.80)</SelectItem><SelectItem value="box">Caja Suelta</SelectItem><SelectItem value="bag">Bolsa / Saco</SelectItem><SelectItem value="drum">Tambor / Bidón</SelectItem></SelectContent>
                      </Select>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 3: SEGURIDAD */}
        {step === 3 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-red-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={18}/> 3. Seguridad y Riesgos de Transporte</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
                      <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">Carga Peligrosa (Mercaderías ONU)</p>
                      <div className="space-y-2">
                         <Label className="text-[9px] font-black uppercase text-slate-400">Nivel de Riesgo</Label>
                         <Select value={formData.dangerLevel} onValueChange={(v: any) => setFormData({...formData, dangerLevel: v})}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="none">🟢 Sin Riesgo (Carga General)</SelectItem><SelectItem value="low">🟡 Riesgo Bajo (Clase 9)</SelectItem><SelectItem value="medium">🟠 Riesgo Medio (Clase 3/4)</SelectItem><SelectItem value="high">🔴 Riesgo Alto (Clase 1/2/6/8)</SelectItem></SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-1.5" style={{ display: formData.dangerLevel !== 'none' ? 'block' : 'none' }}>
                         <Label className="text-[9px] font-black uppercase text-slate-400">N° ONU (Ficha de Intervención)</Label>
                         <div className="relative"><ScanBarcode className="absolute left-3 top-2.5 h-4 w-4 text-slate-300"/><Input className="pl-9 font-mono font-bold" placeholder="Ej: 1203" value={formData.onuNumber} onChange={e => setFormData({...formData, onuNumber: e.target.value})} /></div>
                      </div>
                   </div>

                   <div className={cn("p-6 rounded-3xl border-2 transition-all", formData.requiresReefer ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100 opacity-60")}>
                      <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2"><ThermometerSnowflake className="text-blue-600"/><p className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Cadena de Frío (Equipo Reefer)</p></div>
                         <Switch checked={formData.requiresReefer} onCheckedChange={v => setFormData({...formData, requiresReefer: v})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in" style={{ display: formData.requiresReefer ? 'grid' : 'none' }}>
                         <div className="space-y-1.5"><Label className="text-[9px] font-bold text-blue-400 uppercase">T° Mínima (°C)</Label><Input type="number" className="bg-white border-blue-100" value={formData.tempRange?.min} onChange={e => setFormData({...formData, tempRange: {...formData.tempRange!, min: parseFloat(e.target.value) || 0}})} /></div>
                         <div className="space-y-1.5"><Label className="text-[9px] font-bold text-blue-400 uppercase">T° Máxima (°C)</Label><Input type="number" className="bg-white border-blue-100" value={formData.tempRange?.max} onChange={e => setFormData({...formData, tempRange: {...formData.tempRange!, max: parseFloat(e.target.value) || 0}})} /></div>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 4: COMEX */}
        {step === 4 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Ship size={18}/> 4. Parámetros de Comercio Exterior</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Posición Arancelaria (NCM)</Label>
                      <Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-black text-blue-600 tracking-widest" placeholder="Ej: 3926.90.90" value={formData.ncmCode} onChange={e => setFormData({...formData, ncmCode: e.target.value})} />
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 italic">Nomenclatura Común del Mercosur</p>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Origen de Mercadería</Label>
                      <Select value={formData.origin} onValueChange={(v: any) => setFormData({...formData, origin: v})}>
                         <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                         <SelectContent><SelectItem value="nacional">🇦🇷 Nacional (Argentina)</SelectItem><SelectItem value="mercosur">🇧🇷 Uruguay / Brasil / Paraguay</SelectItem><SelectItem value="importado">🌎 Extra-Zona (Importado)</SelectItem></SelectContent>
                      </Select>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 5: STOCK */}
        {step === 5 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Warehouse size={18}/> 5. Gestión de Existencias por Sede</CardTitle></CardHeader>
             <CardContent className="p-0">
                <div className="p-8 bg-blue-50/50 flex items-center justify-between border-b">
                   <div className="flex items-center gap-3">
                      <Switch checked={formData.managesStock} onCheckedChange={v => setFormData({...formData, managesStock: v})} />
                      <div><p className="text-xs font-black uppercase text-blue-800">Administrar Stock Físico</p><p className="text-[9px] text-blue-600 font-bold">Habilitar control de bultos y auditoría de almacén</p></div>
                   </div>
                   <div className="flex items-center gap-3">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Alerta de Stock Crítico:</Label>
                      <Input type="number" className="w-20 h-9 rounded-lg border-blue-200" value={formData.minStockAlert} onChange={e => setFormData({...formData, minStockAlert: parseInt(e.target.value) || 0})} />
                   </div>
                </div>
                <Table>
                   <TableHeader className="bg-slate-100"><TableRow><TableHead className="px-8 text-[10px] font-black uppercase">Sede / Depósito</TableHead><TableHead className="text-center text-[10px] font-black uppercase">Posición Rack</TableHead><TableHead className="text-right pr-8 text-[10px] font-black uppercase w-40">Stock Actual</TableHead></TableRow></TableHeader>
                   <TableBody>
                      {formData.warehouses?.map(w => (
                        <TableRow key={w.hubId}>
                           <TableCell className="px-8 py-4"><p className="font-bold text-slate-700">{w.hubName}</p></TableCell>
                           <TableCell className="text-center"><Input placeholder="Ej: P1-R4-N2" className="h-8 bg-slate-50 border-none text-[10px] font-mono text-center mx-auto w-32" value={w.location} onChange={e => handleWarehouseChange(w.hubId, 'location', e.target.value)} /></TableCell>
                           <TableCell className="pr-8 text-right"><Input type="number" className="h-9 bg-white border-slate-200 text-center font-black text-blue-600" value={w.stockQuantity} onChange={e => handleWarehouseChange(w.hubId, 'stockQuantity', parseInt(e.target.value) || 0)} /></TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </CardContent>
          </Card>
        )}

        {/* PASO 6: PRECIOS */}
        {step === 6 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-green-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><DollarSign size={18}/> 6. Costos y Tarifario Comercial</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Costo Promedio (ARS)</Label><Input type="number" step="0.01" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl" value={formData.avgCost} onChange={e => setFormData({...formData, avgCost: parseFloat(e.target.value) || 0})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Precio de Lista</Label><Input type="number" step="0.01" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl text-green-600" value={formData.listPrice} onChange={e => setFormData({...formData, listPrice: parseFloat(e.target.value) || 0})} /></div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Alícuota IVA</Label>
                      <Select value={formData.ivaRate?.toString()} onValueChange={(v: any) => setFormData({...formData, ivaRate: parseInt(v) as any})}>
                         <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold"><SelectValue /></SelectTrigger>
                         <SelectContent><SelectItem value="21">General 21%</SelectItem><SelectItem value="10.5">Reducido 10.5%</SelectItem><SelectItem value="27">Sobretasa 27%</SelectItem><SelectItem value="0">Exento 0%</SelectItem></SelectContent>
                      </Select>
                   </div>
                </div>

                <div className="pt-8 border-t flex justify-end">
                   <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 h-16 px-16 rounded-2xl font-black text-lg shadow-2xl shadow-blue-100 transition-all active:scale-95">
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} FINALIZAR FICHA TÉCNICA
                   </Button>
                </div>
             </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" className="font-black text-slate-400 text-xs uppercase" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft className="mr-1" size={16} /> VOLVER
          </Button>
          {step < 6 ? (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-100">
               SIGUIENTE PASO <ChevronRight className="ml-1" size={16} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}