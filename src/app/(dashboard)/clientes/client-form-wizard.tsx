
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
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
    clientId && db ? doc(db, "clients", clientId) : null
  , [db, clientId]);

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
        toast({ title: "GPS: Punto de entrega fijado", description: "Coordenadas capturadas con precisión." });
      }, () => {
        toast({ variant: "destructive", title: "Error GPS", description: "Por favor, ingrese las coordenadas manualmente." });
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // En un entorno de producción aquí se subiría a Firebase Storage
      // Por ahora simulamos la carga exitosa
      toast({ 
        title: "Foto cargada correctamente", 
        description: `Archivo: ${file.name} listo para procesar.` 
      });
      // Placeholder para la URL de la imagen
      setFormData(prev => ({ ...prev, facadePhotoUrl: URL.createObjectURL(file) }));
    }
  };

  const handleSubmit = async () => {
    if (!db) return;
    if (!formData.name || !formData.cuit || !formData.address?.street) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "La dirección y datos fiscales son obligatorios." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (clientId) {
        await updateDoc(doc(db, "clients", clientId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Cliente Actualizado", description: `${formData.name} ha sido guardado.` });
      } else {
        const newRef = doc(collection(db, "clients"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Punto de Entrega Registrado", description: `${formData.name} ya está en el mapa operativo.` });
      }
      router.push('/clientes');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingExisting) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{clientId ? 'Editar Punto de Entrega' : 'Registro de Punto de Destino / Cliente'}</h1>
            <p className="text-sm text-slate-500">Asegure la geolocalización exacta para evitar fallos en la entrega.</p>
          </div>
        </div>
        <Badge variant="outline" className="h-8 px-4 font-mono text-blue-600 bg-blue-50 border-blue-100">
          {formData.internalCode || ''}
        </Badge>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Fiscal", icon: CreditCard },
            { id: 2, label: "Ubicación Exacta", icon: MapPin },
            { id: 3, label: "Aduana / Comex", icon: Anchor },
            { id: 4, label: "Perfil Comercial", icon: Briefcase }
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
            <CardHeader>
              <CardTitle>Identificación Fiscal</CardTitle>
              <CardDescription>Datos legales para facturación y guías de transporte.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Tipo de Cliente</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">🏢 Empresa / Sociedad</SelectItem>
                      <SelectItem value="monotax">👤 Responsable Inscripto</SelectItem>
                      <SelectItem value="government">🏛️ Entidad Gubernamental</SelectItem>
                      <SelectItem value="international">🌍 Cliente Internacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Razón Social / Nombre</Label>
                  <Input placeholder="Ej: ACME Corp S.A." value={formData.name ?? ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>CUIT / Tax ID</Label>
                  <Input placeholder="30-XXXXXXXX-X" value={formData.cuit ?? ''} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Condición frente al IVA</Label>
                  <Select value={formData.ivaCondition} onValueChange={v => setFormData({...formData, ivaCondition: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{IVA_CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Industria / Rubro</Label>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Locate className="text-blue-600" /> Georreferenciación de Destino</CardTitle>
              <CardDescription>Cargue cada detalhe para asegurar que el camión llegue al punto exacto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Calle / Avenida</Label>
                  <Input value={formData.address?.street ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, street: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={formData.address?.number ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, number: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Piso / Depto / Galpón</Label>
                  <Input placeholder="Ej: Galpón 4, Entrada Lateral" value={formData.address?.floor ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, floor: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Barrio / Zona Industrial</Label>
                  <Input placeholder="Ej: Parque Industrial Pilar" value={formData.address?.barrio ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, barrio: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input value={formData.address?.zip ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, zip: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad / Localidad</Label>
                  <Input value={formData.address?.city ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, city: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>Provincia / Estado</Label>
                  <Input value={formData.address?.province ?? ''} onChange={e => setFormData({...formData, address: {...formData.address!, province: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>País</Label>
                  <Select value={formData.address?.country} onValueChange={v => setFormData({...formData, address: {...formData.address!, country: v as Country}})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-blue-400 font-bold flex items-center gap-2"><Locate size={14} /> Coordenadas GPS</Label>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] bg-white/10 border-white/20 hover:bg-white/20" onClick={handleGetLocation}>
                      <Crosshair size={12} className="mr-1" /> Obtener GPS
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-white/40">Latitud</Label>
                      <Input className="bg-white/5 border-white/10 h-8 font-mono text-xs" type="number" step="any" value={formData.address?.lat ?? 0} onChange={e => setFormData({...formData, address: {...formData.address!, lat: parseFloat(e.target.value)}})} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-white/40">Longitud</Label>
                      <Input className="bg-white/5 border-white/10 h-8 font-mono text-xs" type="number" step="any" value={formData.address?.lng ?? 0} onChange={e => setFormData({...formData, address: {...formData.address!, lng: parseFloat(e.target.value)}})} />
                    </div>
                  </div>
                </div>

                <div 
                  className="p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-3 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    {formData.facadePhotoUrl ? <ImageIcon /> : <Camera />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-tighter">
                      {formData.facadePhotoUrl ? "Imagen Seleccionada" : "Foto de la Fachada / Entrada"}
                    </p>
                    <p className="text-[9px] text-slate-500">Indispensable para que el conductor identifique el destino.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-blue-600 font-bold">
                    {formData.facadePhotoUrl ? "CAMBIAR IMAGEN" : "SUBIR IMAGEN"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Anchor className="text-blue-600" /> Datos de Comercio Exterior</CardTitle>
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
                    <Input placeholder="Código de Operador" value={formData.comex?.impExpCode ?? ''} onChange={e => setFormData({...formData, comex: {...formData.comex!, impExpCode: e.target.value}})} />
                 </div>
               </div>
               <div className="p-4 bg-blue-50 border rounded-xl space-y-4">
                  <p className="text-xs font-bold text-blue-800 flex items-center gap-2"><ShieldCheck size={16} /> Registros de Cumplimiento (Argentina)</p>
                  <div className="grid grid-cols-2 gap-4">
                    {['sicnea', 'sita', 'malvina', 'vucea'].map(reg => (
                      <div key={reg} className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-[10px] font-bold uppercase">{reg}</span>
                        <Switch 
                          checked={(formData.comex?.registrations as any)?.[reg]} 
                          onCheckedChange={v => setFormData({...formData, comex: {...formData.comex!, registrations: {...formData.comex!.registrations, [reg]: v}}})} 
                        />
                      </div>
                    ))}
                  </div>
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
                    <Label>Categoría de Cliente</Label>
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
                    <Label>Límite de Crédito Autorizado (ARS)</Label>
                    <Input type="number" value={formData.creditLimit ?? 0} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Plazo de Entrega Estándar (Horas)</Label>
                    <Input type="number" value={formData.standardLeadTimeHours ?? 0} onChange={e => setFormData({...formData, standardLeadTimeHours: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de Pago Preferida</Label>
                    <Select value={formData.preferredPaymentMethod} onValueChange={v => setFormData({...formData, preferredPaymentMethod: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transferencia">Transferencia Bancaria</SelectItem>
                        <SelectItem value="Cheque">Cheque Diferido</SelectItem>
                        <SelectItem value="Contado">Contado</SelectItem>
                      </SelectContent>
                    </Select>
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
                {clientId ? 'Guardar Cambios' : 'Confirmar Registro'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
