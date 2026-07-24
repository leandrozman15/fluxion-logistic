
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { collection, serverTimestamp, doc, setDoc } from "firebase/firestore";
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
  Info, MessageSquare, Crosshair, Anchor
} from "lucide-react";
import { Client, ClientType, ClientCategory, Country } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];

const INDUSTRIES = [
  "Agropecuario", "Automotriz", "Construcción", "Electrónica", "Energía", 
  "Farmacéutico", "Alimenticio", "Metalúrgico", "Minero", "Petróleo y Gas", 
  "Retail / Comercio", "Tecnología", "Textil", "Otro"
];

const CLIENT_TYPES = [
  { id: 'company', label: 'Empresa / S.A.', icon: Building2 },
  { id: 'monotax', label: 'Individuo / Freelance', icon: User },
  { id: 'government', label: 'Entidad Pública', icon: ShieldCheck },
  { id: 'international', label: 'Comercio Exterior', icon: Globe },
];

export default function NewClientPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    address: { street: "", number: "", city: "", province: "", country: "Argentina", zip: "" },
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

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      internalCode: `CLI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    }));
  }, []);

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const newRef = doc(collection(db, "clients"));
      await setDoc(newRef, {
        ...formData,
        id: newRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Cliente Registrado", description: `${formData.name} ha sido habilitado en la red regional.` });
      router.push('/clientes');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nuevo Cliente Regional</h1>
            <p className="text-sm text-slate-500">Registro de dador de carga para operaciones internacionales.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
          {formData.internalCode}
        </Badge>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Fiscal", icon: CreditCard },
            { id: 2, label: "Contatos", icon: User },
            { id: 3, label: "Comex", icon: Anchor },
            { id: 4, label: "Comercial", icon: Briefcase }
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1 relative">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all",
                step > s.id ? "bg-green-500 text-white" : step === s.id ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 text-slate-300 border"
              )}>
                {step > s.id ? <CheckCircle2 size={18} /> : <s.icon size={16} />}
              </div>
              <span className={cn("text-[9px] uppercase font-bold text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>
                {s.label}
              </span>
              {s.id < 4 && <div className={cn("absolute top-4.5 left-1/2 w-full h-[1px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Datos Identificatorios</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>País de Operación Principal</Label>
                  <Select value={formData.address?.country} onValueChange={v => setFormData({...formData, address: {...formData.address!, country: v as Country}})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tax ID (CUIT/RUT/RUC/CNPJ)</Label>
                  <Input placeholder="Identificación Tributaria" value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Razón Social</Label>
                  <Input placeholder="Nombre de la Empresa" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Indústria</Label>
                  <Select value={formData.industry} onValueChange={v => setFormData({...formData, industry: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Ubicación y Contacto</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={formData.address?.city} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Estado / Provincia</Label>
                  <Input value={formData.address?.province} onChange={e => setFormData({...formData, address: {...formData.address!, province: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Email Comercial</Label>
                  <Input type="email" value={formData.mainContact?.email} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, email: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono / WhatsApp</Label>
                  <Input placeholder="+54 / +56 / +595..." value={formData.mainContact?.phone} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, phone: e.target.value}})} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="text-blue-600" /> Operaciones Internacionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label>País de Origen de Carga</Label>
                    <Select value={formData.comex?.countryOfOrigin} onValueChange={v => setFormData({...formData, comex: {...formData.comex!, countryOfOrigin: v as Country}})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label>N° de Registro Importador/Exportador</Label>
                    <Input placeholder="Código de Operador" value={formData.comex?.impExpCode} onChange={e => setFormData({...formData, comex: {...formData.comex!, impExpCode: e.target.value}})} />
                 </div>
               </div>
               <div className="p-4 bg-blue-50 border rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-blue-600 mt-1" />
                  <p className="text-xs text-blue-700">Para el mercado argentino se activarán los chequeos de MALVINA y SICNEA automáticamente si el país de origen es Argentina.</p>
               </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Condiciones Comerciales</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={formData.category} onValueChange={(v: any) => setFormData({...formData, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">💎 Cliente Premium</SelectItem>
                        <SelectItem value="regular">⭐ Regular</SelectItem>
                        <SelectItem value="occasional">📦 Ocasional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Límite de Crédito Autorizado</Label>
                    <Input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value)})} />
                  </div>
               </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : router.back()}>
            <ChevronLeft size={16} className="mr-1" /> Volver
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} className="bg-blue-600 min-w-[120px]">
                Siguiente <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                Confirmar Registro
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
