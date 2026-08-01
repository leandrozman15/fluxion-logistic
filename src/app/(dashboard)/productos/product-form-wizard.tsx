
'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, updateDoc, setDoc, query, orderBy, writeBatch } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Box, ArrowLeft, Save, Loader2, 
  Scale, Layers, CheckCircle2, 
  Info, Camera, ChevronRight, ChevronLeft, Warehouse, Plus, Trash2, Zap, DollarSign
} from "lucide-react";
import { Product, Hub, ProductWarehouse, ProductVariant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";

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
  const db = useFirestore();
  const { tenantId, role } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const [activeVariantUploadId, setActiveVariantUploadId] = useState<string | null>(null);

  const isManager = useMemo(() => role === 'manager' || role === 'admin', [role]);

  const steps = useMemo(() => {
    const s = [
      { id: 1, label: "Gral", icon: Info },
      { id: 2, label: "Variantes", icon: Layers },
      { id: 3, label: "Logística", icon: Scale },
      { id: 4, label: "Stock/Depósitos", icon: Warehouse },
    ];
    if (isManager) {
      s.push({ id: 5, label: "Ventas/Compras", icon: DollarSign });
    }
    return s;
  }, [isManager]);

  const maxSteps = steps.length;

  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "", gtin: "", name: "", brand: "", model: "", description: "", category: "Alimentos y Bebidas",
    unitWeightKg: 0, unitVolumeM3: 0, packagingType: 'pallet', status: 'active', photoUrl: "",
    unitType: 'unit', unitsPerBox: 0, unitsPerPallet: 0, origin: 'nacional',
    managesStock: true, minStockAlert: 5, stockQuantity: 0, ivaRate: 21, dangerLevel: 'none', requiresReefer: false,
    hasVariants: false, variants: [], warehouses: [], listPrice: 0, avgCost: 0, markup: 0
  });

  const handleBack = () => setStep(prev => Math.max(1, prev - 1));
  
  const handleNext = () => {
    if (step === 1) {
      if (!formData.name) return toast({ variant: "destructive", title: "Falta Nombre", description: "El nombre del producto es obligatorio." });
      if (!formData.sku) return toast({ variant: "destructive", title: "Falta SKU", description: "Debe definir un código SKU madre." });
    }
    setStep(prev => Math.min(maxSteps, prev + 1));
  };

  const productRef = useMemo(() => (productId && db && tenantId) ? doc(db, "tenants", tenantId, "products", productId) : null, [db, tenantId, productId]);
  const { data: existingProduct, loading: loadingExisting } = useDoc<Product>(productRef);

  const hubsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "hubs"), orderBy("name")) : null, [db, tenantId]);
  const { data: hubs } = useCollection<Hub>(hubsQuery);

  useEffect(() => {
    if (existingProduct) setFormData(existingProduct);
  }, [existingProduct]);

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

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>, variantId?: string) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setIsProcessingPhoto(variantId || 'main');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        const fileName = `product_${Date.now()}.jpg`;
        const storagePath = `tenants/${tenantId}/products/${formData.sku || 'temp'}/${variantId ? `var_${variantId}` : 'main'}_${fileName}`;
        const url = await uploadBase64(storagePath, compressed);

        if (variantId) {
          handleUpdateVariant(variantId, 'photoUrl', url);
        } else {
          setFormData(prev => ({ ...prev, photoUrl: url }));
        }
        toast({ title: "Imagen subida" });
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

  const handleAddVariant = () => {
    const suffix = (formData.variants?.length || 0) + 1;
    const newVariant: ProductVariant = {
      id: Math.random().toString(36).substring(7),
      sku: `${formData.sku || 'PROD'}-${suffix}`,
      value: "",
      cost: formData.avgCost || 0,
      markup: formData.markup || 0,
      price: formData.listPrice || 0,
      stockQuantity: 0
    };
    setFormData(prev => ({ ...prev, hasVariants: true, variants: [...(prev.variants || []), newVariant] }));
  };

  const handleUpdateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: (prev.variants || []).map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const handleRemoveVariant = (id: string) => {
    setFormData(prev => ({
      ...prev,
      variants: (prev.variants || []).filter(v => v.id !== id),
      hasVariants: (prev.variants || []).length > 1
    }));
  };

  const handleSubmit = async () => {
    if (!db || !tenantId || !formData.name || !formData.sku) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);

      if (formData.hasVariants && formData.variants && formData.variants.length > 0) {
        for (const variant of formData.variants) {
          const variantRef = doc(collection(db, "tenants", tenantId, "products"));
          const variantData = {
            ...formData,
            id: variantRef.id,
            sku: variant.sku,
            name: `${formData.name} - ${variant.value}`,
            photoUrl: variant.photoUrl || formData.photoUrl,
            stockQuantity: variant.stockQuantity,
            avgCost: variant.cost,
            markup: variant.markup,
            listPrice: variant.price,
            hasVariants: false,
            variants: [],
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          };
          batch.set(variantRef, variantData);
        }
      } else {
        const totalStock = (formData.warehouses || []).reduce((acc, w) => acc + (w.stockQuantity || 0), 0);
        const finalData = { ...formData, stockQuantity: totalStock, updatedAt: serverTimestamp() };
        if (productId) {
          batch.update(doc(db, "tenants", tenantId, "products", productId), finalData);
        } else {
          const newRef = doc(collection(db, "tenants", tenantId, "products"));
          batch.set(newRef, { ...finalData, id: newRef.id, createdAt: serverTimestamp() });
        }
      }

      await batch.commit();
      toast({ title: "Guardado exitoso" });
      router.push('/productos');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && productId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div><h1 className="text-2xl font-bold">Maestro de Productos</h1><p className="text-sm text-slate-500">Configuración integral de artículos y variantes.</p></div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">{formData.sku || 'NUEVO SKU'}</Badge>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
         {steps.map(s => (
            <div key={s.id} className={cn("flex flex-col items-center gap-1.5 flex-1 relative min-w-[80px]", step === s.id ? "text-blue-600" : "text-slate-400")}>
               <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border z-10 transition-all", step >= s.id ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white")}>
                 {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={18} />}
               </div>
               <span className="text-[9px] font-black uppercase text-center">{s.label}</span>
               {s.id < maxSteps && <div className={cn("absolute top-4.5 left-1/2 w-full h-[2px] -z-0", step > s.id ? "bg-blue-600" : "bg-slate-100")}></div>}
            </div>
          ))}
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white"><CardTitle className="text-sm uppercase tracking-widest">1. Información de Identidad</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-8 p-8">
              <div className="md:col-span-4 flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed rounded-[2rem]">
                 <div className="relative w-48 h-48 bg-white rounded-3xl border-2 border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                   {formData.photoUrl ? <img src={formData.photoUrl} className="w-full h-full object-cover" /> : <Box size={64} className="text-slate-200" />}
                   {isProcessingPhoto === 'main' && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('photoUrl', e)} />
                 <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={!!isProcessingPhoto}><Camera size={16} className="mr-2" /> SUBIR FOTO</Button>
              </div>
              <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">SKU Madre</Label><Input value={formData.sku ?? ''} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} /></div>
                 <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Nombre Base</Label><Input className="font-bold text-lg" value={formData.name ?? ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                 <div className="md:col-span-2 space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Categoría</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-6">
             <div className="flex justify-between items-center px-4">
                <div><h2 className="text-lg font-black uppercase italic">Variantes del Producto</h2><p className="text-xs text-slate-500">Cada variante generará un registro único en el catálogo.</p></div>
                <Button className="bg-blue-600" onClick={handleAddVariant}><Plus className="w-4 h-4 mr-2" /> Agregar Variante</Button>
             </div>
             {formData.variants?.map((v, i) => (
               <Card key={v.id} className="border-none shadow-md rounded-[2rem] overflow-hidden">
                  <div className="bg-slate-900 text-white px-8 py-3 flex justify-between items-center"><p className="text-[10px] font-black uppercase text-blue-400">Variante #{i + 1}</p><Button variant="ghost" size="icon" className="text-white/40" onClick={() => handleRemoveVariant(v.id)}><Trash2 size={14}/></Button></div>
                  <CardContent className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
                     <div className="md:col-span-3 flex flex-col items-center gap-3">
                        <div className="w-32 h-32 bg-slate-50 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => { setActiveVariantUploadId(v.id); variantFileInputRef.current?.click(); }}>
                           {v.photoUrl ? <img src={v.photoUrl} className="w-full h-full object-cover" /> : <Camera size={32} className="text-slate-300" />}
                           {isProcessingPhoto === v.id && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                        </div>
                        <p className="text-[8px] font-black uppercase text-slate-400">FOTO VAR</p>
                     </div>
                     <div className="md:col-span-9 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Valor (Ex: #40)</Label><Input className="h-10 bg-slate-50 border-none font-bold" value={v.value} onChange={e => handleUpdateVariant(v.id, 'value', e.target.value)} /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">SKU</Label><Input className="h-10 bg-slate-100 border-none font-mono" value={v.sku} readOnly /></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Stock Inicial</Label><Input type="number" className="h-10 bg-blue-50 border-none font-black text-blue-700" value={v.stockQuantity} onChange={e => handleUpdateVariant(v.id, 'stockQuantity', parseInt(e.target.value) || 0)} /></div>
                     </div>
                  </CardContent>
               </Card>
             ))}
             <input type="file" ref={variantFileInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('photoUrl', e, activeVariantUploadId!)} />
          </div>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm rounded-3xl p-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-slate-400">Unidad de Medida</Label><Select value={formData.unitType} onValueChange={(v: any) => setFormData({...formData, unitType: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNIT_TYPES.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-slate-400">Peso Bruto (Kg)</Label><Input type="number" value={formData.unitWeightKg} onChange={e => setFormData({...formData, unitWeightKg: parseFloat(e.target.value) || 0})} /></div>
             </div>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
             <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8">Sede / Almacén</TableHead><TableHead className="text-center">Stock Físico Actual</TableHead></TableRow></TableHeader>
                <TableBody>
                   {formData.warehouses?.map(w => (
                     <TableRow key={w.hubId}><TableCell className="px-8 font-bold">{w.hubName}</TableCell><TableCell className="text-center"><Input type="number" className="w-32 mx-auto text-center font-black" value={w.stockQuantity} onChange={e => handleWarehouseChange(w.hubId, 'stockQuantity', parseInt(e.target.value) || 0)} /></TableCell></TableRow>
                   ))}
                </TableBody>
             </Table>
          </Card>
        )}

        {step === 5 && isManager && (
          <Card className="border-none shadow-sm rounded-3xl p-8 grid grid-cols-2 gap-6">
             <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Costo Promedio (ARS)</Label><Input type="number" value={formData.avgCost || 0} onChange={e => setFormData({...formData, avgCost: parseFloat(e.target.value) || 0})} /></div>
             <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Precio Lista</Label><Input type="number" value={formData.listPrice || 0} onChange={e => setFormData({...formData, listPrice: parseFloat(e.target.value) || 0})} /></div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>VOLVER</Button>
          <div className="flex gap-2">
            {step < maxSteps ? <Button onClick={handleNext} className="bg-blue-600">SIGUIENTE</Button> : <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
