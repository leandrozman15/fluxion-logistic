
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
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

interface ClientFormWizardProps {
  clientId?: string;
}

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];

const INDUSTRIES = [
  "Agropecuario", "Automotriz", "Construcción", "Electrónica", "Energía", 
  "Farmacéutico", "Alimenticio", "Metalúrgico", "Minero", "Petróleo y Gas", 
  "Retail / Comercio", "Tecnología", "Textil", "Otro"
];

const IVA_CONDITIONS = ["Responsable Inscripto", "Monotributista", "Exento", "No Responsable", "Consumidor Final"];

export default function ClientFormWizard({ clientId }: ClientFormWizardProps) {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Client>>({
    internalCode: "",
    type: 'company',
    name: "",
    cuit: "",
    ivaCondition: "Responsable Inscripto",
    industry: "Alimenticio",
    status: "active",
    category: "regular",
    mainContact: { name: "", role: "", email: "", phone: "", whatsapp: "" },
    address: { 
      street: "", number: "", floor: "", barrio: "", 
      city: "", province: "", country: "Argentina", 
      zip: "", lat: -34.6037, lng: -58.3816 
    },
    preferredPaymentMethod: "Transferencia",
    creditLimit: 0,
    standardLeadTimeHours: 48,
    comex: {
      countryOfOrigin: "Argentina",
      impExpCode: "",
      operatorType: "importer",
      registrations: { sicnea: false, sita: false, malvina: false, vucea: false }
    }
  });

  // Load data if editing
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
          role: existingClient.mainContact?.role || "",
          email: existingClient.mainContact?.email || "",
          phone: existingClient.mainContact?.phone || "",
          whatsapp: existingClient.mainContact?.whatsapp || "",
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
      if (!formData.name) return toast({ variant: "destructive", title: "Información Faltante", description: "Debe ingresar la Razón Social." });
      if (!formData.cuit) return toast({ variant: "destructive", title: "Información Faltante", description: "El CUIT es obligatorio." });
    }
    if (step === 2) {
      if (!formData.address?.street) return toast({ variant: "destructive", title: "Información Faltante", description: "Debe ingresar la Calle." });
      if (!formData.address?.number) return toast({ variant: "destructive", title: "Información Faltante", description: "El número es obligatorio." });
    }
    setStep(s => s + 1);
  };

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
    if (file) {
      setIsSubmitting(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        setFormData(prev => ({ ...prev, facadePhotoUrl: compressed }));
        setIsSubmitting(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!db || !tenantId) return;
    
    if (!formData.name) return toast({ variant: "destructive", title: "Error", description: "Falta el nombre." });

    setIsSubmitting(true);
    try {
      if (clientId) {
        await updateDoc(doc(db, "tenants", tenantId, "clients", clientId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Cliente Actualizado" });
      } else {
        const newRef = doc(collection(db, "tenants", tenantId, "clients"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Cliente Registrado" });
      }
      router.push('/clientes');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al guardar", description: e.message || "Ocurrió un error técnico." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold">Registro de Cliente</h1>
            <p className="text-sm text-slate-500">Asegure la geolocalización exacta para evitar fallos en la entrega.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto">
          {[
            { id: 1, label: "Fiscal", icon: CreditCard },
            { id: 2, label: "Ubicación", icon: MapPin },
            { id: 3, label: "Comex", icon: Anchor },
            { id: 4, label: "Perfil", icon: Briefcase }
          ].map((s) => (
            <div key={s.id} className={cn("flex flex-col items-center gap-1.5 flex-1 relative min-w-[80px]", step === s.id ? "text-blue-600" : "text-slate-400")}>
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border transition-all", step >= s.id ? "bg-blue-600 text-white border-blue-600" : "bg-white")}>
                {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
              </div>
              <span className="text-[9px] font-bold uppercase text-center">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in duration-300">
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Identificación Fiscal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1"><Label>Razón Social</Label><Input value={formData.name ?? ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
               <div className="space-y-1"><Label>CUIT</Label><Input placeholder="30-XXXXXXXX-X" value={formData.cuit ?? ''} onChange={e => setFormData({...formData, cuit: e.target.value})} /></div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Ubicación de Destino</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1"><Label>Calle</Label><Input value={formData.address?.street ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} /></div>
                <div className="space-y-1"><Label>Número</Label><Input value={formData.address?.number ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} /></div>
                <div className="space-y-1"><Label>Ciudad</Label><Input value={formData.address?.city ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} /></div>
                <div className="space-y-1"><Label>Provincia</Label><Input value={formData.address?.province ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, province: e.target.value}})} /></div>
              </div>
              <Button onClick={handleGetLocation} className="w-full bg-slate-900"><Locate className="mr-2 h-4 w-4" /> Capturar Coordenadas GPS</Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card><CardHeader><CardTitle>Comercio Exterior</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-1"><Label>Código Exportador</Label><Input value={formData.comex?.impExpCode ?? ''} onChange={e => setFormData({...formData, comex: {...formData.comex!, impExpCode: e.target.value}})} /></div></CardContent></Card>
        )}

        {step === 4 && (
          <Card><CardHeader><CardTitle>Perfil Comercial</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label>Límite Crédito</Label><Input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value)})} /></div></CardContent></Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>VOLVER</Button>
          <div className="flex gap-2">
            {step < 4 ? <Button onClick={handleNext} className="bg-blue-600">SIGUIENTE</Button> : <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
