
'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, ArrowLeft, ArrowRight, Save, Loader2, 
  ShieldCheck, CheckCircle2, User, FileText, 
  Phone, HeartPulse, InfoIcon, X, Briefcase
} from "lucide-react";
import { Driver } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DriverFormWizardProps {
  driverId?: string;
}

const LICENSE_CLASSES = ["C", "D", "E", "F", "G"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];
const CONTRACT_TYPES = ["Tiempo completo", "Tiempo parcial", "Eventual / Temporario", "Contratista independiente", "Pasantía"];

export default function DriverFormWizard({ driverId }: DriverFormWizardProps) {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Driver>>({
    docType: 'DNI',
    dni: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "Masculino",
    nationality: "Argentina",
    licenseNumber: "",
    licenseClasses: [],
    licenseExpiry: "",
    hasLinti: false,
    lintiNumber: "",
    lintiExpiry: "",
    medicalCertificateExpiry: "",
    experienceYears: 0,
    phone: "",
    email: "",
    emergencyContact: "",
    emergencyPhone: "",
    address: "",
    bloodType: "0+",
    healthInsurance: "",
    medicalConditions: "",
    hireDate: new Date().toISOString().split('T')[0],
    contractType: "Tiempo completo",
    status: "active",
    observations: ""
  });

  // Load data if editing
  const { data: existingDriver, loading: loadingExisting } = useDoc<Driver>(
    driverId && db ? doc(db, "drivers", driverId) : null
  );

  useEffect(() => {
    if (existingDriver) {
      setFormData(existingDriver);
    }
  }, [existingDriver]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      if (driverId) {
        await updateDoc(doc(db, "drivers", driverId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Perfil Actualizado", description: `${formData.firstName} ${formData.lastName} ha sido guardado.` });
      } else {
        const newRef = doc(collection(db, "drivers"));
        await setDoc(newRef, {
          ...formData,
          id: newRef.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Alta Exitosa", description: "El conductor ha sido habilitado en el sistema." });
      }
      router.push('/choferes');
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar", description: "Verifique los datos e intente nuevamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLicenseClass = (cls: string) => {
    const current = formData.licenseClasses || [];
    const updated = current.includes(cls) 
      ? current.filter(c => c !== cls) 
      : [...current, cls];
    setFormData({ ...formData, licenseClasses: updated });
  };

  if (loadingExisting) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{driverId ? 'Editar Chofer' : 'Nuevo Chofer Professional'}</h1>
            <p className="text-sm text-slate-500">Registro integral de personal y cumplimiento normativo.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="ghost" onClick={() => router.back()} className="text-slate-500">Cancelar</Button>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          {[
            { id: 1, label: "Datos Personales", icon: User },
            { id: 2, label: "Habilitaciones", icon: FileText },
            { id: 3, label: "Contacto", icon: Phone },
            { id: 4, label: "Contrato", icon: Briefcase }
          ].map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2 flex-1 relative">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all",
                step > s.id ? "bg-green-500 text-white" : step === s.id ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-slate-100 text-slate-400"
              )}>
                {step > s.id ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
              </div>
              <span className={cn("text-[10px] uppercase font-bold text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>
                {s.label}
              </span>
              {s.id < 4 && <div className={cn("absolute top-5 left-1/2 w-full h-[2px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Información Legal y Personal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>Tipo Doc</Label>
                    <Select value={formData.docType} onValueChange={(v: any) => setFormData({...formData, docType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['DNI', 'LC', 'LE', 'Pasaporte', 'CI'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Número de Documento</Label>
                    <Input placeholder="Sin puntos" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nombres</Label>
                  <Input placeholder="Juan Carlos" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos</Label>
                  <Input placeholder="Pérez González" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Fecha de Nacimiento</Label>
                  <Input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Género</Label>
                  <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                      <SelectItem value="Otro">Otro / Prefiero no decir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidad</Label>
                  <Input value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Habilitaciones y Licencias</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número de Licencia de Conducir</Label>
                  <Input placeholder="Nacional / Provincial" value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Clase / Categoría</Label>
                  <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-lg border">
                    {LICENSE_CLASSES.map(cls => (
                      <div key={cls} className="flex items-center space-x-2">
                        <Checkbox id={`cls-${cls}`} checked={formData.licenseClasses?.includes(cls)} onCheckedChange={() => toggleLicenseClass(cls)} />
                        <label htmlFor={`cls-${cls}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{cls}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">Nota: Clase E requerida para semirremolques.</p>
                </div>
                <div className="space-y-2">
                  <Label>Vencimiento de Licencia</Label>
                  <Input type="date" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <Label>Habilitación LINTI</Label>
                       <p className="text-[10px] text-blue-600">Requerida para cargas peligrosas.</p>
                     </div>
                     <Switch checked={formData.hasLinti} onCheckedChange={(v) => setFormData({...formData, hasLinti: v})} />
                   </div>
                   {formData.hasLinti && (
                     <div className="space-y-3 animate-in fade-in duration-200">
                       <div className="space-y-1">
                         <Label className="text-[10px] uppercase font-bold text-blue-400">N° LINTI</Label>
                         <Input className="bg-white h-8" value={formData.lintiNumber} onChange={e => setFormData({...formData, lintiNumber: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-[10px] uppercase font-bold text-blue-400">Vencimiento LINTI</Label>
                         <Input type="date" className="bg-white h-8" value={formData.lintiExpiry} onChange={e => setFormData({...formData, lintiExpiry: e.target.value})} />
                       </div>
                     </div>
                   )}
                </div>
                <div className="space-y-2">
                  <Label>Vencimiento Psicofísico</Label>
                  <Input type="date" value={formData.medicalCertificateExpiry} onChange={e => setFormData({...formData, medicalCertificateExpiry: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Años de Experiencia Profesional</Label>
                  <Input type="number" value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: parseInt(e.target.value) || 0})} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Contacto y Emergencias Médicas</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Teléfono Móvil</Label>
                  <Input placeholder="Ej: 11 5555-1234" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Correo Electrónico</Label>
                  <Input type="email" placeholder="juan.perez@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Domicilio Particular</Label>
                  <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase">
                    <HeartPulse size={14} /> Ficha de Emergencia
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-red-400">Grupo Sanguíneo</Label>
                      <Select value={formData.bloodType} onValueChange={(v) => setFormData({...formData, bloodType: v})}>
                        <SelectTrigger className="bg-white h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BLOOD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-red-400">Obra Social</Label>
                      <Input className="bg-white h-8" value={formData.healthInsurance} onChange={e => setFormData({...formData, healthInsurance: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-red-400">Contacto de Emergencia</Label>
                    <Input placeholder="Nombre y Relación" className="bg-white h-8" value={formData.emergencyContact} onChange={e => setFormData({...formData, emergencyContact: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-red-400">Teléfono Emergencia</Label>
                    <Input className="bg-white h-8" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Datos Laborales y Documentación</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fecha de Ingreso</Label>
                    <Input type="date" value={formData.hireDate} onChange={e => setFormData({...formData, hireDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Contrato</Label>
                    <Select value={formData.contractType} onValueChange={(v) => setFormData({...formData, contractType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Estado Inicial</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">🟢 Activo</SelectItem>
                        <SelectItem value="resting">🟠 Descanso</SelectItem>
                        <SelectItem value="suspended">🔴 Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observaciones / Notas Internas</Label>
                <Textarea className="min-h-[100px]" value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} />
              </div>
              <div className="p-4 bg-slate-50 border border-dashed rounded-xl flex items-center justify-center text-center py-10">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto border shadow-sm text-slate-400">
                    <FileText />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Carga de Documentación</p>
                  <p className="text-[10px] text-slate-400">Arrastre aquí DNI, Licencia y LINTI (PDF/JPG)</p>
                  <Button variant="outline" size="sm" className="mt-2 text-[10px]">Seleccionar Archivos</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center">
          <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ArrowLeft className="mr-2" size={16} /> Volver
          </Button>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={handleNext} className="bg-blue-600">
                Siguiente <ArrowRight className="ml-2" size={16} />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-blue-600" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                {driverId ? 'Guardar Cambios' : 'Habilitar Chofer'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 mt-4">
        <InfoIcon className="text-blue-500 mt-0.5" size={18} />
        <div className="space-y-1">
          <p className="text-xs font-bold text-blue-700">Verificación de Cumplimiento</p>
          <p className="text-[10px] text-blue-600 leading-relaxed">
            Al guardar, el sistema verificará automáticamente la vigência de las licencias. 
            Si la LINTI no está habilitada, el conductor no podrá ser asignado a camiones de la categoría "Dangerous Goods".
          </p>
        </div>
      </div>
    </div>
  );
}
