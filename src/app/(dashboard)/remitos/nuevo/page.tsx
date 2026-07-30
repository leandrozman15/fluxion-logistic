
'use client';

import { useState, useMemo, useRef, useEffect } from "react";
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
  Trash2, Package, Scale, ShoppingCart, Search, Box, Receipt
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
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    number: "",
    cotNumber: "",
    clientId: "",
    fileUrl: "",
    items: [] as PendingRemitoItem[]
  });

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const productsQuery = useMemo(() => db ? query(collection(db, "products"), orderBy("name")) : null, [db]);

  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const totalWeight = useMemo(() => {
    return formData.items.reduce((acc, item) => acc + (item.weightKg || 0), 0);
  }, [formData.items]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

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

  const addItem = (product: Product) => {
    const existing = formData.items.find(i => i.productId === product.id);
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(i => i.productId === product.id 
          ? { ...i, quantity: i.quantity + 1, weightKg: (i.quantity + 1) * product.unitWeightKg } 
          : i
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          weightKg: product.unitWeightKg
        }]
      }));
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;
    
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.productId === productId 
        ? { ...i, quantity: Math.max(1, quantity), weightKg: Math.max(1, quantity) * product.unitWeightKg } 
        : i
      )
    }));
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
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Nuevo Remito Administrativo</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Confección de pedido con desglose de artículos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2">
                <Receipt size={18} className="text-blue-400" /> 1. Datos del Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-slate-400">Seleccionar Cliente de Destino</Label>
                  <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                    <SelectTrigger className="h-14 bg-slate-50 rounded-2xl border-none font-bold text-lg">
                       <SelectValue placeholder="Buscando en cartera..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.address.city})</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-400">N° de Remito / Hoja</Label>
                    <Input placeholder="Ej: 0001-00045678" className="h-14 bg-slate-50 border-none font-mono font-black text-xl rounded-2xl" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black text-slate-400">N° COT (AR)</Label>
                    <Input placeholder="Código de transporte" className="h-14 bg-slate-50 border-none font-mono font-black text-xl rounded-2xl" value={formData.cotNumber} onChange={e => setFormData({...formData, cotNumber: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase font-black text-slate-400">Digitalizar Remito Físico</Label>
                    {formData.fileUrl && <Badge className="bg-green-600 text-white font-black text-[8px] h-4">CAPTURA OK</Badge>}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
                  <div 
                    className={cn(
                      "aspect-video md:h-32 rounded-[2rem] border-3 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                      formData.fileUrl ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                  >
                     {isProcessingFile ? <Loader2 className="animate-spin text-blue-600" /> : formData.fileUrl ? <CheckCircle2 className="text-green-600" size={32} /> : <Camera className="text-slate-300" size={32} />}
                     <p className="text-[10px] font-black uppercase text-slate-400">Subir evidencia digital</p>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-white border-b py-6 px-8 flex flex-row items-center justify-between">
                <div>
                   <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Artículos en Remito</CardTitle>
                   <CardDescription className="text-[10px] font-bold">Listado de bultos para el despacho</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Peso Total Pedido</p>
                      <p className="text-2xl font-black text-slate-900 italic">{totalWeight.toLocaleString()} <span className="text-xs font-normal opacity-40">KG</span></p>
                   </div>
                   <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                      <Scale size={24}/>
                   </div>
                </div>
             </CardHeader>
             <CardContent className="p-0">
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
                           <div className="flex items-center gap-3 bg-white border rounded-xl p-1 shadow-sm">
                              <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400">-</button>
                              <span className="w-10 text-center font-black text-sm">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-8 h-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400">+</button>
                           </div>
                           <div className="text-right w-24">
                              <p className="text-xs font-black text-slate-900">{item.weightKg.toLocaleString()} KG</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Parcial</p>
                           </div>
                           <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => removeItem(item.productId)}><Trash2 size={18} /></Button>
                        </div>
                     </div>
                   ))}
                   {formData.items.length === 0 && (
                     <div className="p-20 text-center space-y-4">
                        <ShoppingCart size={48} className="mx-auto text-slate-100" />
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">El remito no tiene productos aún</p>
                     </div>
                   )}
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-[600px] flex flex-col">
              <CardHeader className="bg-blue-600 text-white p-6 shrink-0">
                 <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Box size={16}/> Catálogo de Artículos</CardTitle>
                 <div className="mt-4 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                    <Input 
                      placeholder="Buscar por nombre o SKU..." 
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10 h-10 rounded-xl"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto flex-1">
                 <div className="divide-y divide-slate-50">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all group">
                         <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate uppercase leading-tight">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{p.sku}</p>
                            <Badge variant="outline" className="text-[7px] h-3 uppercase font-black px-1 mt-1 border-slate-100">{p.unitWeightKg} KG/U</Badge>
                         </div>
                         <Button 
                          size="sm" 
                          variant="ghost" 
                          className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => addItem(p)}
                         >
                            <Plus size={14} />
                         </Button>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="p-10 text-center text-[10px] text-slate-400 italic">No se encontraron productos.</p>
                    )}
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] space-y-4 shadow-2xl">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center text-green-400 border border-green-500/30">
                    <Save size={24} />
                 </div>
                 <div>
                    <p className="text-sm font-black italic tracking-tight uppercase">Confirmar Pedido</p>
                    <p className="text-[10px] text-white/40 font-bold">Enviar al buzón de despacho</p>
                 </div>
              </div>
              <Button 
                className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-green-900/20"
                disabled={isSubmitting || formData.items.length === 0}
                onClick={handleSave}
              >
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                CONFIRMAR INGRESO
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}
