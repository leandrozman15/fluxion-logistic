
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
          lat: existingClient.address?.lat || -34.6037,
          lng: existingClient.address?.lng || -58.3816
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
        toast({ title: "Ubicación fijada automáticamente" });
      }, (err) => {
        toast({ variant: "destructive", title: "Error GPS", description: "No se pudo obtener la ubicación actual." });
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
          
          if (db && user) {
            await logSystemEvent(db, tenantId, user, 'document_upload', 'client', formData.cuit || 'unknown', { fileType: 'facade' });
          }
          
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
      const dataToSave = { ...formData };
      
      // Asegurar que lat/lng sean números
      if (dataToSave.address) {
        dataToSave.address.lat = parseFloat(String(dataToSave.address.lat));
        dataToSave.address.lng = parseFloat(String(dataToSave.address.lng));
      }

      if (clientId) {
        await updateDoc(doc(db, "tenants", tenantId, "clients", clientId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
        if (user) await logSystemEvent(db, tenantId, user, 'update', 'client', clientId, { name: formData.name });
      } else {
        const newRef = doc(collection(db, "tenants", tenantId, "clients"));
        await setDoc(newRef, {
          ...dataToSave,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        if (user) await logSystemEvent(db, tenantId, user, 'create', 'client', newRef.id, { name: formData.name });
      }
      toast({ title: "Cliente Guardado" });
      router.push('/clientes');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && clientId) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Ficha Maestral de Cliente</h1>
            <p className="text-sm text-slate-500 font-medium">Gestión de puntos de entrega y datos fiscales regionalizados.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono font-black text-blue-600 bg-blue-50 border-blue-100">{formData.internalCode || 'NUEVO_CLIENTE'}</Badge>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border shadow-sm flex items-center justify-between overflow-x-auto gap-4">
          {[
            { id: 1, label: "Fiscal", icon: CreditCard },
            { id: 2, label: "Ubicación", icon: MapPin },
            { id: 3, label: "Contacto", icon: Phone },
            { id: 4, label: "Perfil", icon: Briefcase }
          ].map((s) => (
            <div key={s.id} className={cn("flex flex-col items-center gap-1.5 flex-1 relative min-w-[80px]")}>
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all", 
                step === s.id ? "bg-blue-600 text-white border-blue-600 shadow-lg scale-110" : 
                step > s.id ? "bg-green-500 text-white border-green-500" : "bg-white text-slate-300 border-slate-100"
              )}>
                {step > s.id ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
              </div>
              <span className={cn("text-[9px] font-black uppercase text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>{s.label}</span>
              {s.id < 4 && <div className={cn("absolute top-5 left-1/2 w-full h-[2px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
            </div>
          ))}
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        {step === 1 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={18} className="text-blue-400"/> 1. Identificación Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
               <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Razón Social / Nombre Comercial</Label>
                 <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold text-lg" value={formData.name ?? ''} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">CUIT / ID Tributario</Label>
                 <Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-bold" placeholder="30-XXXXXXXX-X" value={formData.cuit ?? ''} onChange={e => setFormData({...formData, cuit: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Rubro / Industria Principal</Label>
                  <Select value={formData.industry} onValueChange={v => setFormData({...formData, industry: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
               </div>
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estado de Cuenta</Label>
                  <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="active">🟢 Cuenta Activa</SelectItem>
                       <SelectItem value="inactive">🔴 Cuenta Suspendida</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-blue-600 text-white p-8">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <MapPin size={18}/> 2. Geolocalización de Destino / Punto de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Calle</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.address?.street ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Número</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.address?.number ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ciudad / Localidad</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.address?.city ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Provincia / Estado</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.address?.province ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, province: e.target.value}})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">CP</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.address?.zip ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, zip: e.target.value}})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 p-8 bg-slate-900 text-white rounded-[2rem] shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Globe size={120}/></div>
                 <div className="md:col-span-8 space-y-6 relative z-10">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-2">
                       <Locate size={14}/> Coordenadas Maestras (Manual o GPS)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold text-white/50 uppercase ml-1">Latitud</Label>
                          <Input 
                            type="number" 
                            step="any"
                            className="h-12 bg-white/10 border-white/20 text-white font-mono font-bold text-lg rounded-xl focus:bg-white/20" 
                            value={formData.address?.lat ?? ''} 
                            onChange={e => setFormData({...formData, address: {...formData.address!, lat: parseFloat(e.target.value) || 0}})} 
                          />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold text-white/50 uppercase ml-1">Longitud</Label>
                          <Input 
                            type="number" 
                            step="any"
                            className="h-12 bg-white/10 border-white/20 text-white font-mono font-bold text-lg rounded-xl focus:bg-white/20" 
                            value={formData.address?.lng ?? ''} 
                            onChange={e => setFormData({...formData, address: {...formData.address!, lng: parseFloat(e.target.value) || 0}})} 
                          />
                       </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
                       <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                       <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                         Ingrese las coordenadas manualmente si conoce el punto exacto de descarga o utilice el botón de auto-captura si se encuentra en el lugar.
                       </p>
                    </div>
                 </div>
                 <div className="md:col-span-4 flex items-center justify-center relative z-10">
                    <Button onClick={handleGetLocation} className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-900/40">
                       <Crosshair size={20} className="mr-2" /> CAPTURAR GPS ACTUAL
                    </Button>
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Reconocimiento Visual de Fachada (Para el Chofer)</Label>
                 <div 
                  className="aspect-video md:aspect-auto md:h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:bg-slate-100 group" 
                  onClick={() => fileInputRef.current?.click()}
                 >
                    {formData.facadePhotoUrl ? (
                      <img src={formData.facadePhotoUrl} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                           {isProcessingPhoto ? <Loader2 className="animate-spin" /> : <Camera size={32} />}
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-tighter">Capturar Imagen de Destino</p>
                      </>
                    )}
                 </div>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <Phone size={18} className="text-blue-400"/> 3. Enlace y Comunicación Directa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre del Responsable de Logística / Compras</Label>
                  <div className="relative">
                     <User className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                     <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12" placeholder="Ej: Ing. Jorge Martínez" value={formData.mainContact?.name ?? ''} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, name: e.target.value}})} />
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">E-mail Institucional</Label>
                    <div className="relative">
                       <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                       <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12" placeholder="usuario@cliente.com" value={formData.mainContact?.email ?? ''} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, email: e.target.value}})} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Teléfono Directo / WhatsApp</Label>
                    <div className="relative">
                       <MessageSquare className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                       <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12" placeholder="+54 9..." value={formData.mainContact?.phone ?? ''} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, phone: e.target.value}})} />
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <Briefcase size={18} className="text-blue-400"/> 4. Perfil Comercial y Crédito
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Límite de Crédito Operativo (ARS)</Label>
                     <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                        <Input type="number" className="h-12 bg-slate-50 border-none rounded-xl font-black text-xl pl-12" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value) || 0})} />
                     </div>
                     <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 italic">Monto máximo de fletes pendientes de pago habilitados.</p>
                  </div>
               </div>
               
               <div className="pt-8 border-t flex justify-end">
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 h-16 px-16 rounded-2xl font-black text-lg shadow-2xl shadow-green-100 transition-all active:scale-95">
                     {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} FINALIZAR REGISTRO
                  </Button>
               </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" className="font-black text-slate-400 text-xs uppercase tracking-widest" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft className="mr-1" size={16} /> VOLVER
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-100">
                SIGUIENTE PASO <ChevronRight className="ml-1" size={16} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
