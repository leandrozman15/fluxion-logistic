
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

export default function ProductFormWizard({ productId }: ProductFormWizardProps) {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "", name: "", brand: "", description: "", category: "Alimentos y Bebidas",
    unitWeightKg: 0, unitVolumeM3: 0, packagingType: 'pallet', status: 'active', photoUrl: ""
  });

  const productRef = useMemo(() => productId && db ? doc(db, "products", productId) : null, [db, productId]);
  const { data: existingProduct, loading: loadingExisting } = useDoc<Product>(productRef);

  useEffect(() => {
    if (existingProduct) setFormData(existingProduct);
  }, [existingProduct]);

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
          toast({ title: "Imagen lista" });
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
    if (!db || !formData.name || !formData.sku) return;
    setIsSubmitting(true);
    try {
      if (productId) {
        await updateDoc(doc(db, "products", productId), { ...formData, updatedAt: serverTimestamp() });
      } else {
        const newRef = doc(collection(db, "products"));
        await setDoc(newRef, { ...formData, id: newRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      toast({ title: "Producto Guardado" });
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
        <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button><div><h1 className="text-2xl font-bold">Registro de Producto</h1><p className="text-sm text-slate-500">Gestión de especificaciones AR.</p></div></div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">{formData.sku || 'NUEVO'}</Badge>
      </div>

      <div className="animate-in fade-in duration-300">
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle>Ficha del Artículo</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed rounded-2xl space-y-4">
              <div className="relative w-40 h-40 bg-white rounded-2xl border-2 border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                {formData.photoUrl ? <img src={formData.photoUrl} className="w-full h-full object-cover" /> : <Package size={48} className="text-slate-300" />}
                {isProcessingPhoto && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Camera size={14} className="mr-2" /> SUBIR FOTO</Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1"><Label>SKU</Label><Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} /></div>
              <div className="space-y-1"><Label>Nombre</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="space-y-1"><Label>Descripción Técnica</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-6 border-t"><Button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600">{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR PRODUCTO</Button></CardFooter>
        </Card>
      </div>
    </div>
  );
}
