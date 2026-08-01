
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, updateDoc, setDoc, writeBatch } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
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
  Phone, HeartPulse, Info, X, Briefcase, Upload, AlertTriangle, FileCheck, Camera, Key, Sparkles,
  Shield, BadgeCheck, HardHat, Truck, UserCircle2
} from "lucide-react";
import { Driver, DriverRole } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";

interface DriverFormWizardProps {
  driverId?: string;
}

const LICENSE_CLASSES = ["C", "D", "E", "F", "G"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];

export default function DriverFormWizard({ driverId }: DriverFormWizardProps) {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState<string | null>(null);

  // Refs para inputs de archivo
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const dniInputRef = useRef<HTMLInputElement>(null);
  const dniBackInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const licenseBackInputRef = useRef<HTMLInputElement>(null);
  const lintiInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Driver>>({
    role: 'driver',
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
    password: "",
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
    dniBackFileUrl: "",
    licenseFileUrl: "",
    licenseBackFileUrl: "",
    lintiFileUrl: ""
  });

  const driverRef = useMemo(() => 
    (driverId && db && tenantId) ? doc(db, "tenants", tenantId, "drivers", driverId) : null
  , [db, tenantId, driverId]);

  const { data: existingDriver, loading: loadingExisting } = useDoc<Driver>(driverRef);

  useEffect(() => {
    if (existingDriver) {
      setFormData({
        ...existingDriver,
        role: existingDriver.role || 'driver',
        dni: existingDriver.dni || "",
        firstName: existingDriver.firstName || "",
        lastName: existingDriver.lastName || "",
        licenseNumber: existingDriver.licenseNumber || "",
        phone: existingDriver.phone || "",
        email: existingDriver.email || "",
      });
    }
  }, [existingDriver]);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.firstName) return toast({ variant: "destructive", title: "Información Faltante", description: "Por favor, ingrese los Nombres." });
      if (!formData.lastName) return toast({ variant: "destructive", title: "Información Faltante", description: "Por favor, ingrese los Apellidos." });
      if (!formData.dni) return toast({ variant: "destructive", title: "Información Faltante", description: "El número de DNI es obligatorio." });
      if (!formData.role) return toast({ variant: "destructive", title: "Información Faltante", description: "Debe seleccionar un Rol operativo." });
    }
    if (step === 2 && formData.role === 'driver') {
      if (!formData.licenseNumber) return toast({ variant: "destructive", title: "Información Faltante", description: "El número de licencia es obligatorio para choferes." });
      if (!formData.licenseExpiry) return toast({ variant: "destructive", title: "Información Faltante", description: "Debe indicar la fecha de vencimiento de la licencia." });
      if (!formData.licenseClasses || formData.licenseClasses.length === 0) return toast({ variant: "destructive", title: "Información Faltante", description: "Debe marcar al menos una Clase de licencia." });
    }
    if (step === 3) {
      if (!formData.email) return toast({ variant: "destructive", title: "Información Faltante", description: "El correo electrónico es necesario para el acceso." });
      if (!driverId && !formData.password) return toast({ variant: "destructive", title: "Información Faltante", description: "Debe definir una contraseña inicial." });
    }
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleFileClick = (key: string) => {
    if (key === 'avatarUrl') avatarInputRef.current?.click();
    if (key === 'dniFileUrl') dniInputRef.current?.click();
    if (key === 'dniBackFileUrl') dniBackInputRef.current?.click();
    if (key === 'licenseFileUrl') licenseInputRef.current?.click();
    if (key === 'licenseBackFileUrl') licenseBackInputRef.current?.click();
    if (key === 'lintiFileUrl') lintiInputRef.current?.click();
  };

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(key);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      let finalData = base64;
      if (file.type.startsWith('image/')) {
        finalData = await compressImage(base64);
      }
      setFormData(prev => ({ ...prev, [key]: finalData }));
      setIsProcessingFile(null);
      toast({ title: "Archivo procesado" });
    };
    reader.readAsDataURL(file);
  };

  const generateProvisionalPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let pass = "";
    for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData(prev => ({ ...prev, password: pass }));
    toast({ title: "Contraseña Provisoria Generada" });
  };

  const handleSubmit = async () => {
    if (!db || !tenantId) return;

    // Validación final
    const requiredLabels: Record<string, string> = {
      firstName: "Nombres",
      lastName: "Apellidos",
      dni: "DNI",
      email: "Correo Electrónico",
      role: "Rol Operativo"
    };

    for (const key in requiredLabels) {
      if (!formData[key as keyof typeof formData]) {
        toast({ variant: "destructive", title: "Datos Incompletos", description: `Falta completar: ${requiredLabels[key]}` });
        return;
      }
    }

    setIsSubmitting(true);
    
    // Instancia secundaria para Auth para no cerrar sesión del administrador actual
    const appName = `invite-auth-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      let uid = driverId;

      const batch = writeBatch(db);

      if (!driverId) {
        // 1. Crear usuario en Firebase Authentication real
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email!, formData.password || "LogisticaAr2026");
        uid = userCredential.user.uid;

        // 2. Registro en la colección global de usuarios (Mapeo por Email para Reglas)
        const globalUserRef = doc(db, "users", formData.email!);
        batch.set(globalUserRef, {
          uid,
          email: formData.email,
          tenantId,
          role: formData.role,
          status: "active",
          createdAt: serverTimestamp()
        });
      }

      // 3. Registro en la subcolección interna de la empresa
      const tenantUserRef = doc(db, "tenants", tenantId, "drivers", uid!);
      const finalData = {
        ...formData,
        id: uid,
        updatedAt: serverTimestamp(),
        ...(driverId ? {} : { createdAt: serverTimestamp() })
      };
      
      // Limpiamos el password antes de guardar en Firestore por seguridad
      delete finalData.password;

      if (driverId) {
        batch.update(tenantUserRef, finalData);
      } else {
        batch.set(tenantUserRef, finalData);
      }

      await batch.commit();
      
      toast({ 
        title: driverId ? "Perfil Actualizado" : "Alta Exitosa", 
        description: `${formData.firstName} ${formData.lastName} ha sido registrado y su acceso habilitado.` 
      });
      
      router.push('/choferes');
    } catch (error: any) {
      console.error(error);
      let msg = error.message || "Verifique los datos e intente nuevamente.";
      if (error.code === 'auth/email-already-in-use') msg = "El correo ya está registrado en el sistema.";
      toast({ variant: "destructive", title: "Error al guardar", description: msg });
    } finally {
      // Limpiar instancia secundaria
      await deleteApp(secondaryApp);
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
            <h1 className="text-2xl font-bold text-slate-900">{driverId ? 'Editar Personal' : 'Nuevo Integrante de Flota'}</h1>
            <p className="text-sm text-slate-500">Registro integral de personal y cumplimiento normativo.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm mx-4">
        <div className="flex items-center justify-between">
          {[
            { id: 1, label: "Datos Personales", icon: User },
            { id: 2, label: "Habilitaciones", icon: FileText },
            { id: 3, label: "Acceso y Contacto", icon: Key },
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
            <CardHeader><CardTitle>Identificación y Rol</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                  <AvatarImage src={formData.avatarUrl} className="object-cover" />
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <User size={48} />
                  </AvatarFallback>
                </Avatar>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold uppercase text-slate-600">Foto Identificatoria</p>
                </div>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('avatarUrl', e)} />
                <Button variant="outline" type="button" size="sm" onClick={() => handleFileClick('avatarUrl')} className="bg-white" disabled={isProcessingFile === 'avatarUrl'}>
                  {isProcessingFile === 'avatarUrl' ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Camera size={14} className="mr-2" />} 
                  {formData.avatarUrl ? 'Cambiar Foto' : 'Subir Foto'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Rol en la Organización</Label>
                  <Select value={formData.role} onValueChange={(v: DriverRole) => setFormData({...formData, role: v})}>
                    <SelectTrigger className="bg-white h-12">
                      <SelectValue placeholder="Seleccionar Rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">📊 Gerente</SelectItem>
                      <SelectItem value="sales_admin">💼 Administración Ventas</SelectItem>
                      <SelectItem value="purchasing_admin">💳 Administración Compras</SelectItem>
                      <SelectItem value="coordinator">🛰️ Coordinador / Tráfico</SelectItem>
                      <SelectItem value="warehouse">📦 Depósito</SelectItem>
                      <SelectItem value="driver">🚚 Chofer Profesional (Tractor)</SelectItem>
                      <SelectItem value="companion">👥 Acompañante / Ayudante</SelectItem>
                      <SelectItem value="viewer">👁️ Solo Lectura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número de DNI</Label>
                  <Input placeholder="Sin puntos" value={formData.dni ?? ''} onChange={e => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} />
                </div>
                <div className="space-y-2">
                  <Label>Nombres</Label>
                  <Input placeholder="Juan Carlos" value={formData.firstName ?? ''} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos</Label>
                  <Input placeholder="Pérez González" value={formData.lastName ?? ''} onChange={e => setFormData({...formData, lastName: e.target.value})} />
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
                  <Input placeholder="Número de Licencia" value={formData.licenseNumber ?? ''} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
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
                  <Input type="date" value={formData.licenseExpiry ?? ''} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} />
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
                         <Input className="bg-white h-8" value={formData.lintiNumber ?? ''} onChange={e => setFormData({...formData, lintiNumber: e.target.value})} />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-[10px] uppercase font-bold text-blue-400">Vencimiento LINTI</Label>
                         <Input type="date" className="bg-white h-8" value={formData.lintiExpiry ?? ''} onChange={e => setFormData({...formData, lintiExpiry: e.target.value})} />
                       </div>
                     </div>
                   )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Key size={18} className="text-blue-600" /> Credenciales de Acceso al Sistema
                </CardTitle>
                <CardDescription>Defina el usuario para que el integrante pueda utilizar la App del Chofer o el Panel Central.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Email de Login (Corporativo o Personal)</Label>
                    <Input type="email" placeholder="usuario@logistica-ar.com" value={formData.email ?? ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña Provisoria</Label>
                    <div className="flex gap-2">
                      <Input placeholder="••••••••" value={formData.password ?? ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                      <Button variant="secondary" size="icon" onClick={generateProvisionalPassword} title="Generar Contraseña">
                        <Sparkles size={16} className="text-blue-600" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                   <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                   <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                     El sistema registrará estas credenciales vinculadas al rol seleccionado. Informe al usuario su email y contraseña para que pueda ingresar.
                   </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Contacto de Emergencia y Salud</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Teléfono Celular</Label>
                    <Input placeholder="Ej: 11 5555-1234" value={formData.phone ?? ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección Residencial</Label>
                    <Input placeholder="Calle, Altura, Localidad" value={formData.address ?? ''} onChange={e => setFormData({...formData, address: e.target.value})} />
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
                        <Input className="bg-white h-8" value={formData.healthInsurance ?? ''} onChange={e => setFormData({...formData, healthInsurance: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Adjuntos de Documentación</CardTitle>
              <CardDescription>Cargue frente y dorso de los documentos habilitantes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Inputs ocultos para archivos */}
                <input type="file" ref={dniInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('dniFileUrl', e)} />
                <input type="file" ref={dniBackInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('dniBackFileUrl', e)} />
                <input type="file" ref={licenseInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('licenseFileUrl', e)} />
                <input type="file" ref={licenseBackInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('licenseBackFileUrl', e)} />
                <input type="file" ref={lintiInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => onFileChange('lintiFileUrl', e)} />

                {[
                  { label: "DNI Frente", key: "dniFileUrl" },
                  { label: "DNI Dorso", key: "dniBackFileUrl" },
                  { label: "Licencia Frente", key: "licenseFileUrl" },
                  { label: "Licencia Dorso", key: "licenseBackFileUrl" },
                  { label: "LINTI", key: "lintiFileUrl" }
                ].map((doc) => {
                  const hasFile = !!formData[doc.key as keyof typeof formData];
                  const isProcessing = isProcessingFile === doc.key;

                  return (
                    <div key={doc.key} className={cn(
                      "p-3 bg-slate-50 border-2 border-dashed rounded-xl text-center space-y-2 transition-colors",
                      hasFile ? "border-green-500 bg-green-50/30" : "border-slate-200"
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center mx-auto border shadow-sm",
                        hasFile ? "bg-green-500 text-white border-green-600" : "bg-white text-slate-400 border-slate-100"
                      )}>
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : (hasFile ? <FileCheck size={16} /> : <Upload size={14} />)}
                      </div>
                      <div>
                        <p className={cn("text-[9px] font-bold uppercase truncate", hasFile ? "text-green-700" : "text-slate-500")}>
                          {doc.label}
                        </p>
                      </div>
                      <Button 
                        variant={hasFile ? "secondary" : "outline"} 
                        type="button" 
                        size="sm" 
                        className={cn("h-6 text-[8px] w-full", hasFile ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-white")}
                        onClick={() => handleFileClick(doc.key)}
                        disabled={isProcessing}
                      >
                        {hasFile ? "Cambiar" : "Subir"}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 pt-4 border-t">
                <Label>Observaciones Laborales</Label>
                <Textarea className="min-h-[100px]" value={formData.observations ?? ''} onChange={e => setFormData({...formData, observations: e.target.value})} />
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
              <Button onClick={handleSubmit} className="bg-blue-600" disabled={isSubmitting || isProcessingFile !== null}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                {driverId ? 'Guardar Cambios' : 'Habilitar Personal'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
