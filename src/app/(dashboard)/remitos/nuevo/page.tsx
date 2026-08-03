
'use client';

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
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
import { listClients } from "@/lib/clients-api";
import { listProducts } from "@/lib/products-api";
import { createRemito } from "@/lib/remitos-api";

export default function NewRemitoPage() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState({
    number: "",
    cotNumber: "",
    clientId: "",
    fileUrl: "",
    items: [] as PendingRemitoItem[]
  });

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setClients([]);
          setProducts([]);
        }
        return;
      }

      try {
        const [clientRows, productRows] = await Promise.all([listClients(), listProducts()]);
        if (!active) return;
        setClients(clientRows);
        setProducts(productRows);
      } catch (error) {
        if (active) {
          setClients([]);
          setProducts([]);
          toast({ variant: "destructive", title: "Error al cargar datos", description: (error as Error).message });
        }
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const selectedProduct = useMemo(() => products?.find(p => p.id === selectedProductId) || null, [products, selectedProductId]);

  const totalWeight = useMemo(() => formData.items.reduce((acc, item) => acc + (item.weightKg || 0), 0), [formData.items]);
  const totalVolume = useMemo(() => formData.items.reduce((acc, item) => acc + (item.volumeM3 || 0), 0), [formData.items]);

  const handleSave = async () => {
    if (!tenantId || !formData.clientId || !formData.number || formData.items.length === 0) {
      toast({ variant: "destructive", title: "Datos incompletos" });
      return;
    }

    setIsSubmitting(true);
    try {
      const client = clients?.find(c => c.id === formData.clientId);
      if (!client) throw new Error("Cliente no encontrado");

      await createRemito({
        ...formData,
        clientName: client.name,
        address: `${client.address.street} ${client.address.number}`,
        city: client.address.city,
        province: client.address.province,
        lat: client.address.lat,
        lng: client.address.lng,
        weightKg: totalWeight,
        volumeM3: totalVolume,
        status: 'pending'
      });

      toast({ title: "Remito Emitido" });
      router.push('/remitos');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
        <h1 className="text-2xl font-black text-slate-900 uppercase italic">Confección de Remito</h1>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase flex items-center gap-2"><Receipt size={18} /> Datos del Documento</CardTitle></CardHeader>
        <CardContent className="p-8 space-y-6">
           <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Cliente Destinatario</Label>
              <Select value={formData.clientId} onValueChange={v => setFormData({...formData, clientId: v})}>
                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold"><SelectValue placeholder="Seleccione cliente..." /></SelectTrigger>
                <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.address.city})</SelectItem>)}</SelectContent>
              </Select>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">N° Remito</Label><Input className="h-11 bg-slate-50 border-none font-bold" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value.toUpperCase()})} /></div>
              <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">COT</Label><Input className="h-11 bg-slate-50 border-none font-bold" value={formData.cotNumber} onChange={e => setFormData({...formData, cotNumber: e.target.value})} /></div>
           </div>
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
         <CardHeader className="border-b p-8"><CardTitle className="text-sm font-black uppercase italic">Detalle de Mercadería</CardTitle></CardHeader>
         <CardContent className="p-8 space-y-4">
            <div className="flex gap-4">
               <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Buscar producto..." /></SelectTrigger>
                  <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}</SelectContent>
               </Select>
               <Input type="number" className="w-24" value={currentQuantity} onChange={e => setCurrentQuantity(parseInt(e.target.value) || 1)} />
               <Button onClick={() => {
                 if (!selectedProduct) return;
                 setFormData({...formData, items: [...formData.items, { productId: selectedProduct.id, productName: selectedProduct.name, sku: selectedProduct.sku, quantity: currentQuantity, weightKg: currentQuantity * selectedProduct.unitWeightKg, volumeM3: currentQuantity * selectedProduct.unitVolumeM3, photoUrl: selectedProduct.photoUrl || "" }]});
                 setSelectedProductId("");
               }} className="bg-blue-600"><Plus /></Button>
            </div>
            <div className="divide-y">
               {formData.items.map(item => (
                 <div key={item.productId} className="py-4 flex justify-between items-center">
                    <div><p className="font-bold text-sm uppercase">{item.productName}</p><p className="text-[10px] text-slate-400">{item.quantity} Bultos • {item.weightKg} KG</p></div>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setFormData({...formData, items: formData.items.filter(i => i.productId !== item.productId)})}><Trash2 size={16}/></Button>
                 </div>
               ))}
            </div>
         </CardContent>
         <CardFooter className="p-8 bg-slate-50 border-t flex justify-end">
            <Button onClick={handleSave} disabled={isSubmitting || formData.items.length === 0} className="bg-green-600 h-14 px-10 font-black rounded-2xl shadow-xl">
               {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} EMITIR PEDIDO
            </Button>
         </CardFooter>
      </Card>
    </div>
  );
}
