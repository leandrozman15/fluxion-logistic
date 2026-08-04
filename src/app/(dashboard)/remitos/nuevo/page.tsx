
'use client';

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, ArrowLeft, Loader2, Save, Camera, CheckCircle2, 
  Trash2, Package, Scale, ShoppingCart, Search, Box, Receipt, Layers,
  ChevronRight, ArrowRight, Info, MapPin, IdCard, FileText, Weight, Boxes
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
    notes: "",
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

  const selectedClient = useMemo(() => clients?.find(c => c.id === formData.clientId) || null, [clients, formData.clientId]);
  const selectedProduct = useMemo(() => products?.find(p => p.id === selectedProductId) || null, [products, selectedProductId]);

  const totalWeight = useMemo(() => formData.items.reduce((acc, item) => acc + (item.weightKg || 0), 0), [formData.items]);
  const totalVolume = useMemo(() => formData.items.reduce((acc, item) => acc + (item.volumeM3 || 0), 0), [formData.items]);
  const totalUnits = useMemo(() => formData.items.reduce((acc, item) => acc + (item.quantity || 0), 0), [formData.items]);

  const handleSave = async () => {
    if (!tenantId || !formData.clientId || !formData.number || formData.items.length === 0) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Seleccione cliente, número de remito y agregue al menos un producto." });
      return;
    }

    setIsSubmitting(true);
    try {
      const client = clients?.find(c => c.id === formData.clientId);
      if (!client) throw new Error("Cliente no encontrado");

      await createRemito({
        ...formData,
        clientName: client.name,
        clientCuit: client.cuit,
        address: `${client.address.street} ${client.address.number}`,
        city: client.address.city,
        province: client.address.province,
        lat: client.address.lat,
        lng: client.address.lng,
        weightKg: totalWeight,
        volumeM3: totalVolume,
        status: 'pending'
      });

      toast({ title: "Remito Emitido", description: `El remito ${formData.number} fue guardado correctamente.` });
      router.push('/remitos');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar", description: (e as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase italic">Confección de Remito</h1>
          <p className="text-xs text-slate-400 font-semibold">Documento de traslado / entrega de mercadería</p>
        </div>
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

           {selectedClient && (
             <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Info size={12} /> Datos del Destinatario</p>
                <div className="grid sm:grid-cols-2 gap-4">
                   <div className="flex items-start gap-3">
                      <IdCard size={18} className="text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">CUIT</p>
                        <p className="font-black text-slate-900">{selectedClient.cuit || "Sin CUIT registrado"}</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Dirección de Entrega</p>
                        <p className="font-bold text-slate-900 text-sm">{selectedClient.address.street} {selectedClient.address.number}</p>
                        <p className="text-xs text-slate-500">{selectedClient.address.city}, {selectedClient.address.province} {selectedClient.address.zip ? `(${selectedClient.address.zip})` : ""}</p>
                      </div>
                   </div>
                </div>
             </div>
           )}

           <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><FileText size={12} /> Observaciones</Label>
              <Textarea
                className="bg-slate-50 border-none font-medium resize-none"
                rows={2}
                placeholder="Instrucciones especiales de entrega, condiciones, etc."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
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
               {formData.items.length === 0 && (
                 <p className="text-xs text-slate-400 font-semibold text-center py-6">Aún no agregó productos a este remito.</p>
               )}
               {formData.items.map(item => (
                 <div key={item.productId} className="py-4 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] font-black tracking-wide">{item.sku}</Badge>
                        <p className="font-bold text-sm uppercase">{item.productName}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{item.quantity} Bultos • {item.weightKg.toFixed(2)} KG • {item.volumeM3.toFixed(3)} M³</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setFormData({...formData, items: formData.items.filter(i => i.productId !== item.productId)})}><Trash2 size={16}/></Button>
                 </div>
               ))}
            </div>

            {formData.items.length > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-2">
                 <div className="rounded-2xl bg-slate-50 p-4 text-center">
                    <Boxes size={16} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-black text-slate-900">{totalUnits}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Bultos</p>
                 </div>
                 <div className="rounded-2xl bg-slate-50 p-4 text-center">
                    <Weight size={16} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-black text-slate-900">{totalWeight.toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Peso Total (KG)</p>
                 </div>
                 <div className="rounded-2xl bg-slate-50 p-4 text-center">
                    <Layers size={16} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-lg font-black text-slate-900">{totalVolume.toFixed(3)}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Volumen (M³)</p>
                 </div>
              </div>
            )}
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

