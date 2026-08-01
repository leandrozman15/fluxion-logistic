
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Building2, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Phone, Mail, Globe, ShieldCheck, 
  User, CreditCard, Briefcase, Plus, Trash2, 
  CheckCircle2, ChevronRight, ChevronLeft, Star, 
  Info, MessageSquare, Crosshair, Anchor, Image as ImageIcon, Camera, Home, Locate
} from "lucide-react";
import { Client, Country } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";
import { logSystemEvent } from "@/lib/audit-service";

interface ClientFormWizardProps {
  clientId?: string;
}

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];

const INDUSTRIES = [
  "Agropecuario", "Automotriz", "Construcción", "Electrónica", "Energía", 
  "Farmacéutico", "Alimenticio", "Metalúrgico", "Minero", "Petróleo y Gas", 
  "Retail / Comercio", "Tecnología", "Textil", "Otro"
];

export default function ClientFormWizard({ clientId }: ClientFormWizardProps) {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Client>>({
    internalCode: "",
    name: "",
    cuit: "",
    industry: "Alimenticio",
    status: "active",
    mainContact: { name: "", email: "", phone: "" },
    address: { 
      street: "", number: "", city: "", province: "", country: "Argentina", 
      zip: "", lat: -34.6037, lng: -58.3816 
    },
    creditLimit: 0,
  });

  const clientRef = useMemo(() => 
    (clientId && db && tenantId) ? doc(db, "tenants", tenantId, "clients", clientId) : null
  , [db, tenantId, clientId]);

  const { data: existingClient, loading: loadingExisting } = useDoc<Client>(clientRef);

  useEffect(() => {
    if (existingClient) {
      setFormData({
        ...existingClient,
        mainContact: {
          name: existingClient.mainContact?.name || "",
          email: existingClient.mainContact?.email || "",
          phone: existingClient.mainContact?.phone || "",
        },
        address: {
          ...existingClient.address,
          street: existingClient.address?.street || "",
          number: existingClient.address?.number || "",
          city: existingClient.address?.city || "",
          province: existingClient.address?.province || "",
          zip: existingClient.address?.zip || "",
          country: existingClient.address?.country || "Argentina",
        }
      });
    }
  }, [existingClient]);

  useEffect(() => {
    if (!clientId) {
      setFormData(prev => ({
        ...prev,
        internalCode: `CLI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      }));
    }
  }, [clientId]);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name) return toast({ variant: "destructive", title: "Falta Nombre", description: "La razón social es obligatoria." });
      if (!formData.cuit) return toast({ variant: "destructive", title: "Falta CUIT", description: "El CUIT es obligatorio." });
    }
    if (step === 2) {
      if (!formData.address?.street || !formData.address?.number) return toast({ variant: "destructive", title: "Falta Dirección", description: "Calle y número son obligatorios." });
    }
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleGetLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          address: { 
            ...prev.address!, 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude 
          }
        }));
        toast({ title: "Ubicación fijada" });
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && tenantId) {
      setIsProcessingPhoto(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressed = await compressImage(base64);
          const storagePath = `tenants/${tenantId}/clients/${formData.cuit || 'temp'}/facade.jpg`;
          const url = await uploadBase64(storagePath, compressed);
          setFormData(prev => ({ ...prev, facadePhotoUrl: url }));
          
          await logSystemEvent(db, tenantId, user, 'document_upload', 'client', formData.cuit || 'unknown', { fileType: 'facade' });
          
          toast({ title: "Foto de fachada guardada" });
        } catch (err) {
          toast({ variant: "destructive", title: "Error al subir foto" });
        } finally {
          setIsProcessingPhoto(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!db || !tenantId) return;
    setIsSubmitting(true);
    try {
      if (clientId) {
        await updateDoc(doc(db, "tenants", tenantId, "clients", clientId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        await logSystemEvent(db, tenantId, user, 'update', 'client', clientId, { name: formData.name });
      } else {
        const newRef = doc(collection(db, "tenants", tenantId, "clients"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await logSystemEvent(db, tenantId, user, 'create', 'client', newRef.id, { name: formData.name });
      }
      toast({ title: "Cliente Guardado" });
      router.push('/clientes');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold">Ficha de Cliente</h1>
            <p className="text-sm text-slate-500">Gestión de puntos de entrega y datos fiscales.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between">
          {[
            { id: 1, label: "Fiscal", icon: CreditCard },
            { id: 2, label: "Ubicación", icon: MapPin },
            { id: 3, label: "Contacto", icon: Phone },
            { id: 4, label: "Perfil", icon: Briefcase }
          ].map((s) => (
            <div key={s.id} className={cn("flex flex-col items-center gap-1.5 flex-1 relative min-w-[80px]", step === s.id ? "text-blue-600" : "text-slate-400")}>
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border z-10 transition-all", step >= s.id ? "bg-blue-600 text-white border-blue-600 shadow-lg" : "bg-white")}>
                {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
              </div>
              <span className="text-[9px] font-black uppercase text-center">{s.label}</span>
            </div>
          ))}
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Identificación Fiscal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1"><Label>Razón Social</Label><Input value={formData.name ?? ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
               <div className="space-y-1"><Label>CUIT</Label><Input placeholder="30-XXXXXXXX-X" value={formData.cuit ?? ''} onChange={e => setFormData({...formData, cuit: e.target.value})} /></div>
               <div className="space-y-1"><Label>Rubro / Industria</Label>
                  <Select value={formData.industry} onValueChange={v => setFormData({...formData, industry: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Geolocalización de Destino</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1"><Label>Calle</Label><Input value={formData.address?.street ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} /></div>
                <div className="space-y-1"><Label>Número</Label><Input value={formData.address?.number ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} /></div>
                <div className="space-y-1"><Label>Ciudad</Label><Input value={formData.address?.city ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} /></div>
                <div className="space-y-1"><Label>Provincia</Label><Input value={formData.address?.province ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, province: e.target.value}})} /></div>
                <div className="space-y-1"><Label>CP</Label><Input value={formData.address?.zip ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, zip: e.target.value}})} /></div>
              </div>
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                 <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-blue-400">Coordenadas Maestras</p><p className="text-xs font-mono">{formData.address?.lat?.toFixed(4)}, {formData.address?.lng?.toFixed(4)}</p></div>
                 <Button onClick={handleGetLocation} className="bg-blue-600"><Locate className="mr-2 h-4 w-4" /> CAPTURAR GPS</Button>
              </div>
              <div className="space-y-2">
                 <Label>Foto de Fachada (Para el Chofer)</Label>
                 <div className="aspect-video bg-slate-50 border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                    {formData.facadePhotoUrl ? <img src={formData.facadePhotoUrl} className="w-full h-full object-cover" /> : isProcessingPhoto ? <Loader2 className="animate-spin" /> : <Camera className="text-slate-300" size={32} />}
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Contacto Principal</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-1"><Label>Nombre Completo</Label><Input value={formData.mainContact?.name ?? ''} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, name: e.target.value}})} /></div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Email</Label><Input value={formData.mainContact?.email ?? ''} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, email: e.target.value}})} /></div>
                  <div className="space-y-1"><Label>Teléfono</Label><Input value={formData.mainContact?.phone ?? ''} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, phone: e.target.value}})} /></div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Perfil Comercial</CardTitle></CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-1"><Label>Límite de Crédito (ARS)</Label><Input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value) || 0})} /></div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>VOLVER</Button>
          <div className="flex gap-2">
            {step < 4 ? <Button onClick={handleNext} className="bg-blue-600">SIGUIENTE <ChevronRight size={16} /></Button> : <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR FICHA</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
