'use client';

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, ArrowLeft, Loader2, Save, Camera, CheckCircle2, 
  Trash2, Package, Scale, ShoppingCart, Search, Box, Receipt, Layers,
  ChevronRight, ArrowRight, Info
} from "lucide-react";
import { Client, Product, PendingRemitoItem } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/utils/image-compression";

export default function NewRemitoPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const [formData, setFormData] = useState({
    number: "",
    cotNumber: "",
    clientId: "",
    fileUrl: "",
    items: [] as PendingRemitoItem[]
  });

  // State for the "Quick Add" form
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const productsQuery = useMemo(() => db ? query(collection(db, "products"), orderBy("name")) : null, [db]);

  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const selectedProduct = useMemo(() => 
    products?.find(p => p.id === selectedProductId) || null
  , [products, selectedProductId]);

  const totalWeight = useMemo(() => {
    return formData.items.reduce((acc, item) => acc + (item.weightKg || 0), 0);
  }, [formData.items]);

  const totalVolume = useMemo(() => {
    return formData.items.reduce((acc, item) => acc + (item.volumeM3 || 0), 0);
  }, [formData.items]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingFile(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const compressed = await compressImage(base64, 1200, 1200, 0.6);
          setFormData(prev => ({ ...prev, fileUrl: compressed }));
        } catch (err) {
          setFormData(prev => ({ ...prev, fileUrl: base64 }));
        } finally {
          setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addItem = () => {
    if (!selectedProduct) return;
    
    const existing = formData.items.find(i => i.productId === selectedProduct.id);
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(i => i.productId === selectedProduct.id 
          ? { 
              ...i, 
              quantity: i.quantity + currentQuantity, 
              weightKg: (i.quantity + currentQuantity) * selectedProduct.unitWeightKg,
              volumeM3: (i.quantity + currentQuantity) * selectedProduct.unitVolumeM3
            } 
          : i
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity: currentQuantity,
          weightKg: currentQuantity * selectedProduct.unitWeightKg,
          volumeM3: currentQuantity * selectedProduct.unitVolumeM3
        }]
      }));
    }
    
    // Reset add form
    setSelectedProductId("");
    setCurrentQuantity(1);
    toast({ title: "Producto añadido" });
  };

  const removeItem = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.productId !== productId)
    }));
  };

  const handleSave = async () => {
    if (!db || !formData.clientId || !formData.number || formData.items.length === 0) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Cargue cliente, número y al menos un producto." });
      return;
    }

    setIsSubmitting(true);
    try {
      const client = clients?.find(c => c.id === formData.clientId);
      if (!client) throw new Error("Cliente no encontrado");

      await addDoc(collection(db, "pending_remitos"), {
        ...formData,
        clientName: client.name,
        address: `${client.address.street} ${client.address.number}`,
        city: client.address.city,
        province: client.address.province,
        lat: client.address.lat,
        lng: client.address.lng,
        weightKg: totalWeight,
        volumeM3: totalVolume,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      toast({ title: "Remito Emitido", description: "El pedido ha sido enviado al buzón de Tráfico." });
      router.push('/remitos');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Confección de Remito</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Ingreso administrativo de pedidos para despacho</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8 pb-6">
              <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2">
                <Receipt size={18} className="text-blue-400" /> 1. Datos del Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Cliente de Destino</Label>
                  <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 rounded-2xl border-none font-bold text-base">
                       <SelectValue placeholder="Seleccione un cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.address.city})</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">N° de Remito</Label>
                    <Input placeholder="0001-00045678" className="h-12 bg-slate-50 border-none font-mono font-black text-lg rounded-2xl" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Certificado COT</Label>
                    <Input placeholder="Código AR" className="h-12 bg-slate-50 border-none font-mono font-bold text-lg rounded-2xl" value={formData.cotNumber} onChange={e => setFormData({...formData, cotNumber: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Escaneo de Documento</Label>
                    {formData.fileUrl && <Badge className="bg-green-600 text-white font-black text-[8px] h-4">DIGITALIZADO</Badge>}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
                  <div 
                    className={cn(
                      "aspect-video md:h-24 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                      formData.fileUrl ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                     {isProcessingFile ? <Loader2 className="animate-spin text-blue-600" /> : formData.fileUrl ? <CheckCircle2 className="text-green-600" size={24} /> : <Camera className="text-slate-300" size={24} />}
                     <p className="text-[9px] font-black uppercase text-slate-400">Adjuntar Remito Físico</p>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-white border-b py-6 px-8 flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Artículos a Entregar</CardTitle>
                   <CardDescription className="text-[10px] font-bold">Detalle granular del pedido</CardDescription>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Carga Total</p>
                      <p className="text-2xl font-black text-slate-900 italic">{totalWeight.toLocaleString()} <span className="text-xs font-normal opacity-40">KG</span></p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cubaje</p>
                      <p className="text-2xl font-black text-blue-600 italic">{totalVolume.toFixed(2)} <span className="text-xs font-normal opacity-40">M³</span></p>
                   </div>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                {/* Quick Add Row */}
                <div className="p-6 bg-blue-50/50 border-b border-blue-100 flex flex-col md:flex-row gap-4 items-end">
                   <div className="flex-1 space-y-1.5 min-w-0">
                      <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">Producto del Catálogo</Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                         <SelectTrigger className="bg-white h-11 border-blue-100 rounded-xl font-bold">
                            <SelectValue placeholder="Buscar artículo..." />
                         </SelectTrigger>
                         <SelectContent>
                            {products?.map(p => (
                               <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {p.sku} - {p.name}
                               </SelectItem>
                            ))}
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="w-full md:w-24 space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-blue-600 ml-1">Cant.</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        className="h-11 bg-white border-blue-100 rounded-xl font-black text-center" 
                        value={currentQuantity} 
                        onChange={e => setCurrentQuantity(parseInt(e.target.value) || 1)} 
                      />
                   </div>
                   <div className="w-full md:w-32 space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Peso/Vol</Label>
                      <div className="h-11 flex flex-col justify-center bg-slate-100/50 rounded-xl px-3 border border-slate-100">
                         <span className="text-[10px] font-black text-slate-700 leading-none">{(selectedProduct?.unitWeightKg || 0) * currentQuantity} kg</span>
                         <span className="text-[8px] font-bold text-slate-400">{(selectedProduct?.unitVolumeM3 || 0) * currentQuantity} m³</span>
                      </div>
                   </div>
                   <Button 
                    className="h-11 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-6 rounded-xl shadow-lg shadow-blue-200"
                    onClick={addItem}
                    disabled={!selectedProductId}
                   >
                      <Plus className="mr-2" size={16} /> AGREGAR
                   </Button>
                </div>

                <div className="divide-y divide-slate-100">
                   {formData.items.map(item => (
                     <div key={item.productId} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0">
                              <Package size={20} />
                           </div>
                           <div className="min-w-0">
                              <p className="text-sm font-black text-slate-800 truncate uppercase">{item.productName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-8">
                           <div className="text-center w-16">
                              <p className="text-xs font-black text-slate-900">{item.quantity}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase">Bultos</p>
                           </div>
                           <div className="text-right w-24">
                              <p className="text-xs font-black text-slate-900">{item.weightKg.toLocaleString()} KG</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{item.volumeM3.toFixed(2)} M³</p>
                           </div>
                           <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => removeItem(item.productId)}><Trash2 size={18} /></Button>
                        </div>
                     </div>
                   ))}
                   {formData.items.length === 0 && (
                     <div className="p-20 text-center space-y-4">
                        <ShoppingCart size={48} className="mx-auto text-slate-100" />
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest italic">El remito no tiene productos aún</p>
                     </div>
                   )}
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
              <CardHeader className="p-8 pb-6 border-b border-white/5">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <Layers size={18} /> Resumen de Carga
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-white/50 uppercase">Total Kilogramos</span>
                       <span className="text-xl font-black italic">{totalWeight.toLocaleString()} KG</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-white/50 uppercase">Total Volumen</span>
                       <span className="text-xl font-black italic">{totalVolume.toFixed(2)} M³</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-xs font-bold text-white/50 uppercase">Total Artículos</span>
                       <span className="text-xl font-black italic">{formData.items.length} SKUs</span>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center text-green-400 border border-green-500/30">
                          <CheckCircle2 size={20} />
                       </div>
                       <p className="text-[10px] text-white/40 font-bold uppercase leading-tight">Ventas y Administración:<br/>Confirmar el ingreso para Tráfico.</p>
                    </div>
                    <Button 
                      className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-[1.5rem] shadow-2xl shadow-green-900/40 border-none"
                      disabled={isSubmitting || formData.items.length === 0}
                      onClick={handleSave}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                      CONFIRMAR REMITO
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm flex items-start gap-4">
              <Info size={24} className="text-blue-600 shrink-0 mt-1" />
              <div className="space-y-1">
                 <p className="text-xs font-black text-slate-800 uppercase italic">Control de Pesos</p>
                 <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Al confirmar, este remito aparecerá en la pantalla de "Despacho Inteligente". Tráfico podrá agruparlo con otros pedidos en el camión más eficiente basándose en el peso y volumen que usted acaba de declarar.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
