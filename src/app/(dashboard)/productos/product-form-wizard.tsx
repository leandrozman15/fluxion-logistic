
'use client';

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, updateDoc, setDoc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Barcode from "react-barcode";
import { 
  Box, ArrowLeft, ArrowRight, Save, Loader2, 
  Scale, Layers, ShieldCheck, CheckCircle2, 
  Info, Tag, Ship, ThermometerSnowflake, 
  AlertTriangle, ScanBarcode, Camera, Image as ImageIcon, 
  ChevronRight, ChevronLeft, Package, LayoutGrid, Building2, User, DollarSign, Activity, TrendingUp, Zap, ShoppingCart, Warehouse, MoveRight, X, BellRing, Calculator, Percent
} from "lucide-react";
import { Product, Hub, ProductWarehouse } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";

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
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManager = useMemo(() => role === 'manager' || role === 'admin', [role]);

  const steps = useMemo(() => {
    const s = [
      { id: 1, label: "Gral", icon: Info },
      { id: 2, label: "Logística", icon: Scale },
      { id: 3, label: "Stock/Depósitos", icon: Warehouse },
    ];
    if (isManager) {
      s.push({ id: 4, label: "Ventas/Compras", icon: DollarSign });
    }
    return s;
  }, [isManager]);

  const maxSteps = steps.length;

  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "", gtin: "", name: "", shortName: "", brand: "", model: "", manufacturer: "", description: "", category: "Alimentos y Bebidas",
    unitWeightKg: 0, unitVolumeM3: 0, packagingType: 'pallet', status: 'active', photoUrl: "",
    unitType: 'unit', conversionFactor: 1, unitsPerBox: 0, unitsPerPallet: 0, origin: 'nacional',
    managesStock: true, allowNegativeStock: false, isLotTracked: false, isSerialTracked: false, expiryControl: false,
    minStockAlert: 5, maxStockAlert: 100, stockQuantity: 0, ivaRate: 21, dangerLevel: 'none', requiresReefer: false,
    warehouses: [], markup: 0, avgCost: 0, listPrice: 0, wholesaleDiscount: 10, retailPrice: 0, wholesalePrice: 0
  });

  const handleBack = () => setStep(prev => Math.max(1, prev - 1));
  const handleNext = () => setStep(prev => Math.min(maxSteps, prev + 1));

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

  // CÁLCULO EN CASCADA DE PRECIOS
  useEffect(() => {
    const listPrice = formData.listPrice || 0;
    const iva = formData.ivaRate || 0;
    const discount = formData.wholesaleDiscount || 0;

    const retail = listPrice * (1 + (iva / 100));
    const wholesale = retail * (1 - (discount / 100));

    if (retail !== formData.retailPrice || wholesale !== formData.wholesalePrice) {
      setFormData(prev => ({ 
        ...prev, 
        retailPrice: Number(retail.toFixed(2)), 
        wholesalePrice: Number(wholesale.toFixed(2)) 
      }));
    }
  }, [formData.listPrice, formData.ivaRate, formData.wholesaleDiscount]);

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
        } catch (err) {
          setFormData(prev => ({ ...prev, photoUrl: base64 }));
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWarehouseChange = (hubId: string, field: keyof ProductWarehouse, value: any) => {
    setFormData(prev => ({
      ...prev,
      warehouses: (prev.warehouses || []).map(w => 
        w.hubId === hubId ? { ...w, [field]: value } : w
      )
    }));
  };

  const handlePriceChange = (field: 'listPrice' | 'avgCost' | 'markup' | 'wholesaleDiscount', value: string) => {
    const numVal = value === "" ? 0 : parseFloat(value);
    setFormData(prev => {
      const updated = { ...prev, [field]: numVal };
      if (field === 'markup' || field === 'avgCost') {
        const cost = field === 'avgCost' ? numVal : (prev.avgCost || 0);
        const mkp = field === 'markup' ? numVal : (prev.markup || 0);
        updated.listPrice = cost * (1 + (mkp / 100));
      }
      if (field === 'listPrice') {
        const cost = prev.avgCost || 0;
        if (cost > 0) {
          updated.markup = ((numVal - cost) / cost) * 100;
        }
      }
      return updated;
    });
  };

  const calculatedMargin = useMemo(() => {
    if (!formData.listPrice || !formData.avgCost || formData.listPrice === 0) return 0;
    return (((formData.listPrice - formData.avgCost) / formData.listPrice) * 100).toFixed(1);
  }, [formData.listPrice, formData.avgCost]);

  const generateAutoSku = () => {
    const categoryPrefix = (formData.category || "PROD").substring(0, 3).toUpperCase();
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    const newSku = `${categoryPrefix}-${randomPart}`;
    setFormData(prev => ({ ...prev, sku: newSku }));
    toast({ title: "SKU Generado", description: `Código: ${newSku}` });
  };

  const handleSubmit = async () => {
    if (!db || !tenantId || !formData.name || !formData.sku) return;
    setIsSubmitting(true);
    try {
      const totalStock = (formData.warehouses || []).reduce((acc, w) => acc + (w.stockQuantity || 0), 0);
      const finalData = { ...formData, stockQuantity: totalStock, updatedAt: serverTimestamp() };

      if (productId) {
        await updateDoc(doc(db, "tenants", tenantId, "products", productId), finalData);
      } else {
        const newRef = doc(collection(db, "tenants", tenantId, "products"));
        await setDoc(newRef, { ...finalData, id: newRef.id, createdAt: serverTimestamp() });
      }
      toast({ title: "Producto Guardado" });
      router.push('/productos');
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div><h1 className="text-2xl font-bold">Maestro de Productos</h1><p className="text-sm text-slate-500">Configuración integral de artículos y depósitos.</p></div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">{formData.sku || 'NUEVO SKU'}</Badge>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between overflow-x-auto">
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
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white"><CardTitle className="text-sm uppercase tracking-widest">1. Información de Identidad</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-8 p-8">
                <div className="md:col-span-4 space-y-6">
                   <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed rounded-[2rem] space-y-4">
                     <div className="relative w-48 h-48 bg-white rounded-3xl border-2 border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                       {formData.photoUrl ? <img src={formData.photoUrl} className="w-full h-full object-cover" /> : <Package size={64} className="text-slate-200" />}
                       {isProcessingPhoto && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
                     </div>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                     <Button variant="outline" className="rounded-xl h-10 w-full" onClick={() => fileInputRef.current?.click()} disabled={isProcessingPhoto}><Camera size={16} className="mr-2" /> SUBIR FOTO</Button>
                   </div>
                   
                   {formData.sku && (
                     <div className="p-4 bg-white border rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm">
                        <p className="text-[9px] font-black uppercase text-slate-400">Vista Previa Code 128</p>
                        <div className="bg-white p-2">
                           <Barcode value={formData.sku} format="CODE128" width={1.5} height={40} fontSize={10} />
                        </div>
                     </div>
                   )}
                </div>
                
                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-slate-400">SKU / Código Interno</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[9px] font-black text-blue-600 uppercase hover:bg-blue-50"
                        onClick={(e) => { e.preventDefault(); generateAutoSku(); }}
                      >
                        <Zap size={10} className="mr-1" /> Auto
                      </Button>
                    </div>
                    <Input value={formData.sku ?? ''} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">EAN-13 / GTIN</Label><Input value={formData.gtin ?? ''} onChange={e => setFormData({...formData, gtin: e.target.value})} /></div>
                  <div className="md:col-span-2 space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Nombre Comercial</Label><Input className="font-bold text-lg" value={formData.name ?? ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Marca</Label><Input value={formData.brand ?? ''} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Modelo / Fabricante</Label><Input value={formData.model ?? ''} onChange={e => setFormData({...formData, model: e.target.value})} /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl">
               <CardHeader><CardTitle className="text-sm uppercase tracking-widest">2. Clasificación</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Categoría</Label><Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Subcategoría / Línea</Label><Input value={formData.subCategory ?? ''} onChange={e => setFormData({...formData, subCategory: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Rubro AFIP (Opcional)</Label><Input value={formData.afipRubro ?? ''} onChange={e => setFormData({...formData, afipRubro: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Origen</Label><Select value={formData.origin} onValueChange={(v: any) => setFormData({...formData, origin: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nacional">🇦🇷 Nacional</SelectItem><SelectItem value="importado">🌎 Importado</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Estado</Label><Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem><SelectItem value="suspended">Suspendido</SelectItem></SelectContent></Select></div>
               </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
               <CardHeader className="bg-blue-600 text-white"><CardTitle className="text-sm uppercase">Unidad de Medida y Conversión</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
                  <div className="space-y-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Unidad Base de Venta/Stock</Label><Select value={formData.unitType} onValueChange={(v: any) => setFormData({...formData, unitType: v})}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{UNIT_TYPES.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="p-5 bg-slate-50 rounded-2xl space-y-2 border">
                       <p className="text-[10px] font-black uppercase text-blue-600">Ejemplo de Conversión</p>
                       <div className="flex items-center gap-4"><div className="flex-1 space-y-1"><Label className="text-[8px] uppercase">1 Unidad Superior (Caja)</Label><Input type="number" value={formData.conversionFactor} onChange={e => setFormData({...formData, conversionFactor: parseFloat(e.target.value) || 1})} /></div><MoveRight className="mt-4 text-slate-300" /><div className="flex-1 text-center pt-6"><p className="text-xl font-black text-slate-800">{formData.conversionFactor} <span className="text-[10px] font-normal uppercase text-slate-400">{formData.unitType}s</span></p></div></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                     <Label className="text-[10px] font-black uppercase text-slate-400">Dimensiones de Embalaje</Label>
                     <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1"><Label className="text-[8px] uppercase">Largo (cm)</Label><Input type="number" value={formData.dimensions?.l || 0} onChange={e => setFormData({...formData, dimensions: {...(formData.dimensions || {l:0, w:0, h:0}), l: parseFloat(e.target.value) || 0}})} /></div>
                        <div className="space-y-1"><Label className="text-[8px] uppercase">Ancho (cm)</Label><Input type="number" value={formData.dimensions?.w || 0} onChange={e => setFormData({...formData, dimensions: {...(formData.dimensions || {l:0, w:0, h:0}), w: parseFloat(e.target.value) || 0}})} /></div>
                        <div className="space-y-1"><Label className="text-[8px] uppercase">Alto (cm)</Label><Input type="number" value={formData.dimensions?.h || 0} onChange={e => setFormData({...formData, dimensions: {...(formData.dimensions || {l:0, w:0, h:0}), h: parseFloat(e.target.value) || 0}})} /></div>
                     </div>
                     <div className="pt-4"><Label className="text-[10px] font-black uppercase text-slate-400">Volumen Calculado (M³)</Label><Input type="number" step="0.001" value={formData.unitVolumeM3} onChange={e => setFormData({...formData, unitVolumeM3: parseFloat(e.target.value) || 0})} /></div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl">
               <CardHeader><CardTitle className="text-sm uppercase">Palletización y Carga</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Peso Bruto (Kg)</Label><Input type="number" value={formData.unitWeightKg} onChange={e => setFormData({...formData, unitWeightKg: parseFloat(e.target.value) || 0})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Unidades x Caja</Label><Input type="number" value={formData.unitsPerBox} onChange={e => setFormData({...formData, unitsPerBox: parseInt(e.target.value) || 0})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Unidades x Pallet</Label><Input type="number" value={formData.unitsPerPallet} onChange={e => setFormData({...formData, unitsPerPallet: parseInt(e.target.value) || 0})} /></div>
               </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl">
               <CardHeader><CardTitle className="text-sm uppercase flex items-center gap-2"><Zap className="text-blue-600" /> Política de Inventario</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 p-8">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border"><Label className="text-xs uppercase font-bold">Maneja Stock</Label><Switch checked={formData.managesStock} onCheckedChange={v => setFormData({...formData, managesStock: v})} /></div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border"><Label className="text-xs uppercase font-bold">Stock Negativo</Label><Switch checked={formData.allowNegativeStock} onCheckedChange={v => setFormData({...formData, allowNegativeStock: v})} /></div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border"><Label className="text-xs uppercase font-bold">Loteado</Label><Switch checked={formData.isLotTracked} onCheckedChange={v => setFormData({...formData, isLotTracked: v})} /></div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border"><Label className="text-xs uppercase font-bold">N° Serie</Label><Switch checked={formData.isSerialTracked} onCheckedChange={v => setFormData({...formData, isSerialTracked: v})} /></div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border"><Label className="text-xs uppercase font-bold">Vencimiento</Label><Switch checked={formData.expiryControl} onCheckedChange={v => setFormData({...formData, expiryControl: v})} /></div>
               </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card className="border-none shadow-sm rounded-3xl md:col-span-1">
                  <CardHeader className="bg-slate-50 border-b py-4">
                     <CardTitle className="text-xs uppercase flex items-center gap-2 text-slate-500"><BellRing size={16} /> Niveles de Alerta Global</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Stock Mínimo Global</Label>
                        <Input type="number" value={formData.minStockAlert} onChange={e => setFormData({...formData, minStockAlert: parseInt(e.target.value) || 0})} />
                        <p className="text-[8px] text-slate-400 italic">Disparará alertas de reposición.</p>
                     </div>
                     <div className="space-y-1.5 pt-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Stock Máximo Global</Label>
                        <Input type="number" value={formData.maxStockAlert} onChange={e => setFormData({...formData, maxStockAlert: parseInt(e.target.value) || 0})} />
                        <p className="text-[8px] text-slate-400 italic">Límite para evitar sobrestock.</p>
                     </div>
                  </CardContent>
               </Card>

               <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden md:col-span-2">
                  <CardHeader className="bg-slate-900 text-white py-6 px-8 flex flex-row items-center justify-between">
                     <div>
                       <CardTitle className="text-sm uppercase tracking-widest">Control por Depósitos</CardTitle>
                       <CardDescription className="text-white/40 text-[10px]">Parámetros específicos por sede operativa</CardDescription>
                     </div>
                     <div className="text-right">
                       <p className="text-[10px] font-black uppercase text-blue-400">Total Global</p>
                       <p className="text-2xl font-black italic">{(formData.warehouses || []).reduce((acc, w) => acc + (w.stockQuantity || 0), 0)} u.</p>
                     </div>
                  </CardHeader>
                  <CardContent className="p-0">
                     <Table>
                       <TableHeader className="bg-slate-50/50">
                         <TableRow>
                           <TableHead className="px-8 text-[10px] font-black uppercase">Sede / Depósito</TableHead>
                           <TableHead className="text-[10px] font-black uppercase text-center">Stock Actual</TableHead>
                           <TableHead className="text-[10px] font-black uppercase text-center">Mín/Máx</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {formData.warehouses?.map(w => (
                           <TableRow key={w.hubId}>
                              <TableCell className="px-8 py-4">
                                 <p className="font-bold text-slate-700">{w.hubName}</p>
                                 <Input className="h-6 text-[9px] w-24 mt-1 border-none bg-slate-50" placeholder="Locación" value={w.location} onChange={e => handleWarehouseChange(w.hubId, 'location', e.target.value)} />
                              </TableCell>
                              <TableCell className="text-center"><Input type="number" className="h-10 text-sm text-center font-black w-24 mx-auto" value={w.stockQuantity} onChange={e => handleWarehouseChange(w.hubId, 'stockQuantity', parseInt(e.target.value) || 0)} /></TableCell>
                              <TableCell className="text-center">
                                 <div className="flex items-center gap-2 justify-center">
                                   <Input type="number" className="h-10 text-[10px] w-16 text-center" value={w.minStock} onChange={e => handleWarehouseChange(w.hubId, 'minStock', parseInt(e.target.value) || 0)} title="Mínimo" />
                                   <span className="text-slate-300">/</span>
                                   <Input type="number" className="h-10 text-[10px] w-16 text-center" value={w.maxStock} onChange={e => handleWarehouseChange(w.hubId, 'maxStock', parseInt(e.target.value) || 0)} title="Máximo" />
                                 </div>
                              </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                  </CardContent>
               </Card>
            </div>
          </div>
        )}

        {step === 4 && isManager && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="border-none shadow-sm rounded-3xl">
                  <CardHeader className="bg-slate-50 border-b py-4">
                    <CardTitle className="text-sm uppercase flex items-center gap-2">
                      <ShoppingCart size={16} className="text-blue-600" /> Parámetros de Compra
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-8">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Costo Última Compra</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-300" />
                          <Input type="number" className="pl-9" value={formData.lastCost || 0} onChange={e => setFormData({...formData, lastCost: parseFloat(e.target.value) || 0})} />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-blue-400">Costo Promedio Ponderado (Auditado)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-blue-400" />
                          <Input type="number" className="pl-9 bg-blue-50/30 border-blue-100 font-bold" value={formData.avgCost || 0} onChange={e => handlePriceChange('avgCost', e.target.value)} />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Moneda de Gestión</Label>
                        <Select value={formData.currency || 'ARS'} onValueChange={v => setFormData({...formData, currency: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARS">ARS ($)</SelectItem>
                            <SelectItem value="USD">USD (U$S)</SelectItem>
                            <SelectItem value="BRL">BRL (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                     </div>
                  </CardContent>
               </Card>

               <Card className="border-none shadow-sm rounded-3xl">
                  <CardHeader className="bg-slate-50 border-b py-4">
                    <CardTitle className="text-sm uppercase flex items-center gap-2">
                      <TrendingUp size={16} className="text-green-600" /> Estructura de Precios y Markup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 p-8">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-blue-600">Markup (%)</Label>
                           <div className="relative">
                              <Percent className="absolute right-3 top-2.5 h-4 w-4 text-blue-300" />
                              <Input 
                                type="number" 
                                className="pr-9 font-black text-blue-600 bg-blue-50/50 border-blue-200" 
                                value={formData.markup || 0} 
                                onChange={e => handlePriceChange('markup', e.target.value)} 
                              />
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-slate-400">Precio Lista</Label>
                           <div className="relative">
                              <Calculator className="absolute left-3 top-2.5 h-4 w-4 text-slate-300" />
                              <Input 
                                type="number" 
                                className="pl-9 font-black text-slate-900" 
                                value={formData.listPrice || 0} 
                                onChange={e => handlePriceChange('listPrice', e.target.value)} 
                              />
                           </div>
                        </div>
                     </div>

                     <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-black uppercase text-green-700 tracking-widest">Margen Real Calculado</p>
                           <p className="text-[8px] text-green-600 font-bold uppercase">(Sobre Precio Venta)</p>
                        </div>
                        <p className="text-3xl font-black italic text-green-700">{calculatedMargin}%</p>
                     </div>

                     <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-slate-400">Alícuota IVA</Label>
                           <Select value={formData.ivaRate?.toString()} onValueChange={(v: any) => setFormData({...formData, ivaRate: parseFloat(v) as any})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Exento (0%)</SelectItem>
                                <SelectItem value="10.5">10.5%</SelectItem>
                                <SelectItem value="21">21%</SelectItem>
                                <SelectItem value="27">27%</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-blue-600">Precio Minorista (IVA Incl.)</Label>
                           <Input type="number" readOnly className="bg-slate-100 font-black" value={formData.retailPrice} />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 pt-4 border-t bg-slate-50/50 p-4 rounded-2xl border border-dashed">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-orange-600">Desc. Mayorista (%)</Label>
                           <Input type="number" className="font-bold border-orange-200" value={formData.wholesaleDiscount} onChange={e => handlePriceChange('wholesaleDiscount', e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-orange-600">Precio Mayorista (Final)</Label>
                           <Input type="number" readOnly className="bg-orange-50 font-black border-orange-200 text-orange-700" value={formData.wholesalePrice} />
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </div>
            
            <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl">
              <CardHeader className="border-b border-white/5"><CardTitle className="text-sm uppercase tracking-widest">Resumen Final de Registro</CardTitle></CardHeader>
              <CardContent className="p-8">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left">
                       <p className="text-[10px] font-black uppercase text-blue-400 mb-1 tracking-widest">Impacto en Inventario</p>
                       <p className="text-3xl font-black italic">{(formData.warehouses || []).reduce((acc, w) => acc + (w.stockQuantity || 0), 0)} u. <span className="text-sm font-normal text-white/30 uppercase">{formData.unitType}s</span></p>
                    </div>
                    <div className="h-16 w-[1px] bg-white/10 hidden md:block"></div>
                    <div className="text-center md:text-left">
                       <p className="text-[10px] font-black uppercase text-blue-400 mb-1 tracking-widest">Rédito Bruto (Margen)</p>
                       <p className="text-3xl font-black italic text-green-400">{calculatedMargin}% <span className="text-sm font-normal text-white/30 uppercase">Final</span></p>
                    </div>
                    <Button onClick={handleSubmit} className="h-16 px-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-xl rounded-2xl shadow-2xl shadow-blue-900/40" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} FINALIZAR ALTA
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting} className="font-bold"><ChevronLeft size={16} className="mr-1" /> VOLVER</Button>
          <div className="flex gap-2">
            {step < maxSteps ? (
              <Button onClick={handleNext} className="bg-blue-600 font-bold px-8">SIGUIENTE <ChevronRight size={16} className="ml-1" /></Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 font-bold px-8 shadow-lg shadow-green-100" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                {productId ? 'GUARDAR CAMBIOS' : 'GUARDAR PRODUCTO'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
