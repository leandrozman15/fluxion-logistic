
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
import { Client, ClientType, ClientCategory } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

const INDUSTRIES = [
  "Agropecuario", "Automotriz", "Construcción", "Electrónica", "Energía", 
  "Farmacéutico", "Alimenticio", "Metalúrgico", "Minero", "Petróleo y Gas", 
  "Retail / Comercio", "Tecnología", "Textil", "Otro"
];

const CLIENT_TYPES = [
  { id: 'company', label: 'Empresa / S.A.', icon: Building2 },
  { id: 'monotax', label: 'Monotributista', icon: User },
  { id: 'government', label: 'Entidad Pública', icon: ShieldCheck },
  { id: 'cooperative', label: 'Cooperativa', icon: Globe },
  { id: 'international', label: 'Internacional', icon: Globe },
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
    address: { street: "", number: "", city: "", province: "Buenos Aires", zip: "" },
    preferredPaymentMethod: "Contado",
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
      toast({ title: "Cliente Registrado", description: `${formData.name} já está ativo.` });
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
            <h1 className="text-2xl font-bold text-slate-900">Novo Cliente / Dador de Carga</h1>
            <p className="text-sm text-slate-500">Cadastro integral e dados de Comércio Exterior.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
          {formData.internalCode}
        </Badge>
      </div>

      {/* Steps Indicator */}
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
            <CardHeader><CardTitle>Dados Fiscais e Legais</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <Label>Tipo de Cliente</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {CLIENT_TYPES.map(type => (
                    <Button 
                      key={type.id} 
                      type="button" 
                      variant={formData.type === type.id ? "default" : "outline"}
                      className="flex flex-col h-16 gap-1 p-2"
                      onClick={() => setFormData({...formData, type: type.id as any})}
                    >
                      <type.icon size={16} />
                      <span className="text-[9px] uppercase font-bold text-center leading-tight">{type.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input placeholder="ACME S.A." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>CUIT (Argentina)</Label>
                  <Input placeholder="30-XXXXXXXX-X" value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Condição IVA</Label>
                  <Select value={formData.ivaCondition} onValueChange={v => setFormData({...formData, ivaCondition: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
            <CardHeader><CardTitle>Contatos e Endereço</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Contato Principal</Label>
                  <Input value={formData.mainContact?.name} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, name: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={formData.mainContact?.role} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, role: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.mainContact?.email} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, email: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone / WhatsApp</Label>
                  <Input value={formData.mainContact?.phone} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, phone: e.target.value}})} />
                </div>
              </div>
              <div className="pt-4 border-t space-y-4">
                <Label className="text-blue-600 font-bold">Endereço Fiscal</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] uppercase">Rua</Label>
                    <Input value={formData.address?.street} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase">N°</Label>
                    <Input value={formData.address?.number} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="text-blue-600" /> Datos de Comercio Exterior</CardTitle>
              <CardDescription>Informações necessárias para fletes internacionais e aduana.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>País de Origem / Constituição</Label>
                  <Select value={formData.comex?.countryOfOrigin} onValueChange={v => setFormData({...formData, comex: {...formData.comex!, countryOfOrigin: v}})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Argentina', 'Brasil', 'Chile', 'Uruguay', 'Paraguay', 'Bolivia', 'Perú'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Código Importador/Exportador (DGA)</Label>
                  <Input placeholder="Reg. Aduaneiro" value={formData.comex?.impExpCode} onChange={e => setFormData({...formData, comex: {...formData.comex!, impExpCode: e.target.value}})} />
                </div>
              </div>

              <div className="p-4 bg-blue-50 border rounded-xl space-y-4">
                <Label className="text-blue-900 font-bold uppercase text-[10px]">Registros Sistêmicos Aduaneiros (Argentina)</Label>
                <div className="grid grid-cols-2 gap-4">
                   {['sicnea', 'sita', 'malvina', 'vucea'].map(reg => (
                     <div key={reg} className="flex items-center justify-between p-2 bg-white rounded border">
                       <span className="text-xs font-bold uppercase">{reg}</span>
                       <Switch 
                        checked={(formData.comex?.registrations as any)?.[reg]} 
                        onCheckedChange={v => setFormData({
                          ...formData, 
                          comex: {
                            ...formData.comex!, 
                            registrations: {...formData.comex!.registrations, [reg]: v}
                          }
                        })} 
                       />
                     </div>
                   ))}
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  <strong>Atenção:</strong> O CUIT do cliente deve figurar em todos os documentos de transporte internacional para evitar atrasos na aduana.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Perfil Comercial</CardTitle></CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={formData.category} onValueChange={(v: any) => setFormData({...formData, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">💎 Premium</SelectItem>
                        <SelectItem value="regular">⭐ Regular</SelectItem>
                        <SelectItem value="occasional">📦 Ocasional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Crédito (ARS)</Label>
                    <Input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value)})} />
                  </div>
               </div>
               <div className="space-y-2">
                 <Label>Observações Internas</Label>
                 <Textarea value={formData.internalNotes} onChange={e => setFormData({...formData, internalNotes: e.target.value})} />
               </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : router.back()}>
            <ChevronLeft className="mr-2" size={16} /> Voltar
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} className="bg-blue-600 min-w-[120px]">
                Próximo <ChevronRight className="ml-2" size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                Registrar Cliente
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
