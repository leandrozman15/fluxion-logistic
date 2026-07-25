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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, ArrowLeft, ArrowRight, Save, Loader2, 
  ShieldCheck, CheckCircle2, User, FileText, 
  Phone, HeartPulse, Info, X, Briefcase, Upload, AlertTriangle, FileCheck, Camera
} from "lucide-react";
import { Driver } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DriverFormWizardProps {
  driverId?: string;
}

const LICENSE_CLASSES = ["C", "D", "E", "F", "G"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];

export default function DriverFormWizard({ driverId }: DriverFormWizardProps) {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs para inputs de archivo
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const dniInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const lintiInputRef = useRef<HTMLInputElement>(null);

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
    hasCnrt: false,
    cnrtNumber: "",
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
    observations: "",
    avatarUrl: "",
    dniFileUrl: "",
    licenseFileUrl: "",
    lintiFileUrl: ""
  });

  const driverRef = useMemo(() => 
    driverId && db ? doc(db, "drivers", driverId) : null
  , [db, driverId]);

  const { data: existingDriver, loading: loadingExisting } = useDoc<Driver>(driverRef);

  useEffect(() => {
    if (existingDriver) {
      setFormData({
        ...existingDriver,
        dni: existingDriver.dni || "",
        firstName: existingDriver.firstName || "",
        lastName: existingDriver.lastName || "",
        licenseNumber: existingDriver.licenseNumber || "",
        phone: existingDriver.phone || "",
        email: existingDriver.email || "",
      });
    }
  }, [existingDriver]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleFileClick = (key: string) => {
    if (key === 'avatarUrl') avatarInputRef.current?.click();
    if (key === 'dniFileUrl') dniInputRef.current?.click();
    if (key === 'licenseFileUrl') licenseInputRef.current?.click();
    if (key === 'lintiFileUrl') lintiInputRef.current?.click();
  };

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de tamaño para el prototipo (Máx 800KB para evitar límites de Firestore)
    if (file.size > 850000) {
      toast({ 
        variant: "destructive", 
        title: "Archivo muy pesado", 
        description: "En este prototipo el límite es 800KB. Reduzca la calidad de la imagen o use un archivo más pequeño." 
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({ ...prev, [key]: base64 }));
      toast({ 
        title: key === 'avatarUrl' ? "Foto cargada" : "Documento adjuntado", 
        description: "El archivo se ha procesado para persistencia." 
      });
    };
    reader.readAsDataURL(file);
  };

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

  if (loadingExisting && driverId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{driverId ? 'Editar Chofer' : 'Nuevo Chofer Profesional'}</h1>
            <p className="text-sm text-slate-500">Registro integral de personal y cumplimiento normativo.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm mx-4">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Datos Personales", icon: User },
            { id: 2, label: "Habilitaciones", icon: FileText },
            { id: 3, label: "Contacto", icon: Phone },
            { id: 4, label: "Documentación", icon: Briefcase }
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

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mx-4">
        {step === 1 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Identificación y Datos Personales</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                  <AvatarImage src={formData.avatarUrl} className="object-cover" />
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <User size={48} />
                  </AvatarFallback>
                </Avatar>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold uppercase text-slate-600">Foto del Chofer</p>
                  <p className="text-[10px] text-slate-400">Identificación visual para el panel</p>
                </div>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('avatarUrl', e)} />
                <Button variant="outline" type="button" size="sm" onClick={() => handleFileClick('avatarUrl')} className="bg-white">
                  <Camera size={14} className="mr-2" /> {formData.avatarUrl ? 'Cambiar Foto' : 'Subir Foto'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Número de DNI</Label>
                  <Input placeholder="Sin puntos" value={formData.dni || ''} onChange={e => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} />
                </div>
                <div className="space-y-2">
                  <Label>Nombres</Label>
                  <Input placeholder="Juan Carlos" value={formData.firstName || ''} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos</Label>
                  <Input placeholder="Pérez González" value={formData.lastName || ''} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha de Nacimiento</Label>
                    <Input type="date" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nacionalidad</Label>
                    <Input value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Licencias y Habilitaciones</CardTitle>
              <CardDescription className="text-orange-600 flex items-center gap-1 font-bold">
                <AlertTriangle size={14} /> El RUTA ha sido eliminado (Decreto 1109/2024).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Licencia Nacional de Conducir</Label>
                  <Input placeholder="Número de Licencia" value={formData.licenseNumber || ''} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Clase (Mínimo C o E para Semis)</Label>
                  <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-lg border">
                    {LICENSE_CLASSES.map(cls => (
                      <div key={cls} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cls-${cls}`} 
                          checked={formData.licenseClasses?.includes(cls)} 
                          onCheckedChange={() => toggleLicenseClass(cls)} 
                        />
                        <label htmlFor={`cls-${cls}`} className="text-sm font-medium leading-none">{cls}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Vencimiento de Licencia</Label>
                  <Input type="date" value={formData.licenseExpiry || ''} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <Label>Licencia LINTI</Label>
                       <p className="text-[10px] text-blue-600 font-bold uppercase">Obligatoria Interjurisdiccional</p>
                     </div>
                     <Switch checked={formData.hasLinti} onCheckedChange={(v) => setFormData({...formData, hasLinti: v})} />
                   </div>
                   {formData.hasLinti && (
                     <div className="space-y-3 animate-in fade-in duration-200">
                       <div className="space-y-1">
                         <Label className="text-[10px] uppercase font-bold text-blue-400">N° LINTI</Label>
                         <Input className="bg-white h-8" value={formData.lintiNumber || ''} onChange={e => setFormData({...formData, lintiNumber: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-[10px] uppercase font-bold text-blue-400">Vencimiento LINTI</Label>
                         <Input type="date" className="bg-white h-8" value={formData.lintiExpiry || ''} onChange={e => setFormData({...formData, lintiExpiry: e.target.value})} />
                       </div>
                     </div>
                   )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Contacto y Salud</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Teléfono Celular</Label>
                  <Input placeholder="Ej: 11 5555-1234" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Correo Electrónico</Label>
                  <Input type="email" placeholder="juan.perez@email.com" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
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
                      <Input className="bg-white h-8" value={formData.healthInsurance || ''} onChange={e => setFormData({...formData, healthInsurance: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Adjuntos de Documentación</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Inputs ocultos para archivos */}
                <input type="file" ref={dniInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('dniFileUrl', e)} />
                <input type="file" ref={licenseInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('licenseFileUrl', e)} />
                <input type="file" ref={lintiInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('lintiFileUrl', e)} />

                {[
                  { label: "DNI (Frente/Dorso)", key: "dniFileUrl" },
                  { label: "Licencia de Conducir", key: "licenseFileUrl" },
                  { label: "Licencia LINTI", key: "lintiFileUrl" }
                ].map((doc) => {
                  const hasFile = !!formData[doc.key as keyof typeof formData];
                  return (
                    <div key={doc.key} className={cn(
                      "p-4 bg-slate-50 border-2 border-dashed rounded-xl text-center space-y-3 transition-colors",
                      hasFile ? "border-green-500 bg-green-50/30" : "border-slate-200"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center mx-auto border shadow-sm",
                        hasFile ? "bg-green-500 text-white border-green-600" : "bg-white text-slate-400 border-slate-100"
                      )}>
                        {hasFile ? <FileCheck size={20} /> : <Upload size={18} />}
                      </div>
                      <div>
                        <p className={cn("text-[10px] font-bold uppercase", hasFile ? "text-green-700" : "text-slate-500")}>
                          {hasFile ? "Archivo Cargado" : doc.label}
                        </p>
                        <p className="text-[8px] text-slate-400 mt-0.5">PDF o JPG (Máx 800KB)</p>
                      </div>
                      <Button 
                        variant={hasFile ? "secondary" : "outline"} 
                        type="button" 
                        size="sm" 
                        className={cn("h-7 text-[10px] w-full", hasFile ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-white")}
                        onClick={() => handleFileClick(doc.key)}
                      >
                        {hasFile ? "Cambiar Archivo" : "Seleccionar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 pt-4 border-t">
                <Label>Observaciones Laborales</Label>
                <Textarea className="min-h-[100px]" value={formData.observations || ''} onChange={e => setFormData({...formData, observations: e.target.value})} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center z-50">
        <div className="max-w-4xl w-full flex justify-between items-center px-4">
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
    </div>
  );
}
