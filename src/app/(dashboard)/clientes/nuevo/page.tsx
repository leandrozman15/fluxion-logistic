
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Building2, ArrowLeft, ArrowRight, Save, Loader2, 
  MapPin, Phone, Mail, Globe, ShieldCheck, 
  User, CreditCard, Briefcase, Plus, Trash2, 
  CheckCircle2, ChevronRight, ChevronLeft, Star, 
  Info, MessageSquare, Crosshair
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
    internalCode: "CLI-...", // To avoid hydration mismatch
    type: 'company',
    name: "",
    cuit: "",
    ivaCondition: "Responsable Inscripto",
    industry: "Alimenticio",
    status: "active",
    category: "regular",
    mainContact: { name: "", role: "", email: "", phone: "", whatsapp: "" },
    secondaryContacts: [],
    address: { street: "", number: "", city: "", province: "Buenos Aires", zip: "", lat: 0, lng: 0 },
    preferredPaymentMethod: "Contado",
    creditLimit: 0,
    standardLeadTimeHours: 48,
    internalNotes: ""
  });

  // Generate internal code only on client
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      internalCode: `CLI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    }));
  }, []);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

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

  const handleAddSecondaryContact = () => {
    setFormData({
      ...formData,
      secondaryContacts: [...(formData.secondaryContacts || []), { name: "", role: "", email: "", phone: "" }]
    });
  };

  const handleRemoveSecondaryContact = (index: number) => {
    const updated = [...(formData.secondaryContacts || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, secondaryContacts: updated });
  };

  const handleGetLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          address: { ...prev.address!, lat: pos.coords.latitude, lng: pos.coords.longitude }
        }));
        toast({ title: "Localização capturada" });
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Novo Cliente / Dador de Carga</h1>
            <p className="text-sm text-slate-500">Cadastro integral de parceiros comerciais e dados fiscais.</p>
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
            { id: 3, label: "Endereços", icon: MapPin },
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
                  <Label>Razão Social / Nome Completo</Label>
                  <Input placeholder="Ex: ACME Corp S.A." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>CUIT / Identificação Tributária</Label>
                  <Input placeholder="30-XXXXXXXX-X" value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Condição frente ao IVA</Label>
                  <Select value={formData.ivaCondition} onValueChange={v => setFormData({...formData, ivaCondition: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Responsable Inscripto', 'Monotributista', 'Exento', 'No Responsable', 'Consumidor Final'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ramo de Atividade / Indústria</Label>
                  <Select value={formData.industry} onValueChange={v => setFormData({...formData, industry: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações Fiscais</Label>
                <Textarea placeholder="Ej: Cliente isento de retenção..." value={formData.fiscalObservations} onChange={e => setFormData({...formData, fiscalObservations: e.target.value})} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Contatos de Referência</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase mb-2">
                  <Star size={14} /> Contato Principal
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-slate-400">Nome Completo</Label>
                    <Input className="bg-white" value={formData.mainContact?.name} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, name: e.target.value}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-slate-400">Cargo / Função</Label>
                    <Input className="bg-white" value={formData.mainContact?.role} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, role: e.target.value}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-slate-400">Email Comercial</Label>
                    <Input className="bg-white" type="email" value={formData.mainContact?.email} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, email: e.target.value}})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-slate-400">Telefone / WhatsApp</Label>
                    <Input className="bg-white" value={formData.mainContact?.phone} onChange={e => setFormData({...formData, mainContact: {...formData.mainContact!, phone: e.target.value}})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase font-bold text-slate-500">Contatos Secundários / Apoio</Label>
                  <Button variant="outline" size="sm" onClick={handleAddSecondaryContact}><Plus size={14} className="mr-1" /> Adicionar</Button>
                </div>
                <div className="grid gap-3">
                  {formData.secondaryContacts?.map((contact, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-white border rounded-lg relative group">
                      <Input placeholder="Nome" value={contact.name} onChange={e => {
                        const updated = [...formData.secondaryContacts!];
                        updated[i].name = e.target.value;
                        setFormData({...formData, secondaryContacts: updated});
                      }} />
                      <Input placeholder="Cargo" value={contact.role} onChange={e => {
                        const updated = [...formData.secondaryContacts!];
                        updated[i].role = e.target.value;
                        setFormData({...formData, secondaryContacts: updated});
                      }} />
                      <Input placeholder="Telefone" value={contact.phone} onChange={e => {
                        const updated = [...formData.secondaryContacts!];
                        updated[i].phone = e.target.value;
                        setFormData({...formData, secondaryContacts: updated});
                      }} />
                      <div className="flex gap-2">
                        <Input placeholder="Email" className="flex-1" value={contact.email} onChange={e => {
                          const updated = [...formData.secondaryContacts!];
                          updated[i].email = e.target.value;
                          setFormData({...formData, secondaryContacts: updated});
                        }} />
                        <Button variant="ghost" size="icon" className="text-red-500 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveSecondaryContact(i)}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Localização e Logística</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Endereço Fiscal</Label>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleGetLocation}><Crosshair size={12} className="mr-1" /> GPS</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Rua / Avenida</Label>
                      <Input value={formData.address?.street} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Número</Label>
                      <Input value={formData.address?.number} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Cidade</Label>
                      <Input value={formData.address?.city} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-slate-400">Província</Label>
                      <Select value={formData.address?.province} onValueChange={v => setFormData({...formData, address: {...formData.address!, province: v}})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase">
                      <Info size={14} /> Direções Especiais
                    </div>
                    <p className="text-[10px] text-amber-600 leading-relaxed">
                      O sistema utiliza estas coordenadas para otimizar o cálculo de quilometragem e tempo de viagem nos fletes atribuídos.
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-amber-400">Latitud</Label>
                        <Input className="bg-white h-8 text-xs" value={formData.address?.lat} readOnly />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-[9px] uppercase font-bold text-amber-400">Longitud</Label>
                        <Input className="bg-white h-8 text-xs" value={formData.address?.lng} readOnly />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Perfil Comercial e Configurações</CardTitle></CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Categoria do Cliente</Label>
                  <Select value={formData.category} onValueChange={(v: ClientCategory) => setFormData({...formData, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="premium">💎 Premium</SelectItem>
                      <SelectItem value="regular">⭐ Regular</SelectItem>
                      <SelectItem value="occasional">📦 Ocasional</SelectItem>
                      <SelectItem value="potential">🆕 Potencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pagamento Preferida</Label>
                  <Select value={formData.preferredPaymentMethod} onValueChange={v => setFormData({...formData, preferredPaymentMethod: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Contado', '30 dias', '60 dias', 'Contraentrega', 'Transferência'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Limite de Crédito (ARS)</Label>
                  <Input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Prazo de Entrega Padrão (Horas)</Label>
                  <Input type="number" value={formData.standardLeadTimeHours} onChange={e => setFormData({...formData, standardLeadTimeHours: parseInt(e.target.value) || 48})} />
                </div>
                <div className="space-y-2">
                  <Label>Observações Internas (Privado)</Label>
                  <Textarea placeholder="Notas de uso exclusivo administrativo..." value={formData.internalNotes} onChange={e => setFormData({...formData, internalNotes: e.target.value})} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft className="mr-2" size={16} /> Voltar
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} className="bg-blue-600 min-w-[120px]">
                Próximo <ChevronRight className="ml-2" size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 min-w-[150px]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                Confirmar e Registrar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
