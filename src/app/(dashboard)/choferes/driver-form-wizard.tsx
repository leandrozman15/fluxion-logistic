
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  User, 
  FileText, 
  Phone, 
  Camera, 
  Upload, 
  CheckCircle2, 
  ShieldCheck, 
  Key, 
  ChevronRight, 
  ChevronLeft,
  HeartPulse, 
  Briefcase, 
  Award, 
  Info,
  RefreshCw,
  Smartphone
} from "lucide-react";
import { Driver, DriverRole } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";
import { createDriver, getDriver, updateDriver } from "@/lib/drivers-api";

interface DriverFormWizardProps {
  driverId?: string;
}

const LICENSE_CLASSES = ["A1", "A2", "A3", "B1", "B2", "C1", "C2", "C3", "D1", "D2", "E1", "E2", "G1", "G2"];

export default function DriverFormWizard({ driverId }: DriverFormWizardProps) {
  const { tenantId } = useTenant();
   useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState<string | null>(null);
   const [loadingExisting, setLoadingExisting] = useState(Boolean(driverId));

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const dniFRef = useRef<HTMLInputElement>(null);
  const dniBRef = useRef<HTMLInputElement>(null);
  const licFRef = useRef<HTMLInputElement>(null);
  const licBRef = useRef<HTMLInputElement>(null);
  const lintiRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Driver>>({
    role: 'driver',
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    email: "",
    password: "",
    birthDate: "",
    nationality: "Argentina",
    gender: "Masculino",
    address: "",
    bloodType: "0+",
    healthInsurance: "",
    emergencyContact: "",
    emergencyPhone: "",
    licenseNumber: "",
    licenseExpiry: "",
    licenseClasses: [],
    hasLinti: false,
    lintiNumber: "",
    lintiExpiry: "",
    hasCnrt: false,
    hireDate: new Date().toISOString().split('T')[0],
    contractType: "Efectivo",
    experienceYears: 0,
    status: "active",
    avatarUrl: "",
    dniFileUrl: "",
    dniBackFileUrl: "",
    licenseFileUrl: "",
    licenseBackFileUrl: "",
    lintiFileUrl: ""
  });

  useEffect(() => {
      let active = true;

      async function loadExisting() {
         if (!driverId) {
            if (active) setLoadingExisting(false);
            return;
         }

         try {
            const existingDriver = await getDriver(driverId);
            if (active) setFormData(existingDriver);
         } catch (error) {
            if (active) {
               toast({ variant: "destructive", title: "Error al cargar chofer", description: (error as Error).message });
            }
         } finally {
            if (active) setLoadingExisting(false);
         }
      }

      loadExisting();
      return () => {
         active = false;
      };
   }, [driverId, toast]);

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setIsProcessingFile(key);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        const storagePath = `tenants/${tenantId}/drivers/${formData.dni || 'temp'}/${key}_${Date.now()}.jpg`;
        const url = await uploadBase64(storagePath, compressed);
        
        setFormData(prev => ({ ...prev, [key]: url }));
        
        toast({ title: "Documento digitalizado", description: "El archivo se ha guardado en el legajo." });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al subir", description: "No se pudo procesar la imagen." });
      } finally {
        setIsProcessingFile(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => setStep(s => Math.min(6, s + 1));
  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const toggleClass = (cls: string) => {
    const current = formData.licenseClasses || [];
    if (current.includes(cls)) {
      setFormData({ ...formData, licenseClasses: current.filter(c => c !== cls) });
    } else {
      setFormData({ ...formData, licenseClasses: [...current, cls] });
    }
  };

  const handleSubmit = async () => {
   if (!tenantId) return;
    
    setIsSubmitting(true);
    
    const appName = `auth-worker-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      let uid = driverId;
      const cleanEmail = formData.email?.toLowerCase().trim() || "";

      if (!driverId && cleanEmail) {
        if (!formData.password) throw new Error("Debe definir una contraseña inicial para crear el acceso.");
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, formData.password);
        uid = userCredential.user.uid;

        // Perfil canónico que usan useTenant() y /api/auth/backend-session para resolver tenant/rol.
        await setDoc(doc(firestore, `users/${cleanEmail}`), {
          uid,
          email: cleanEmail,
          displayName: `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || null,
          tenantId,
          role: formData.role || 'driver',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      }

      if (!uid) {
        uid = formData.dni || Math.random().toString(36).substring(7);
      }

      const { password, ...restData } = formData;
      const finalData: any = {};
      
      // Sanitizar datos para evitar undefined
      Object.entries(restData).forEach(([key, value]) => {
        if (value !== undefined) finalData[key] = value;
      });

      finalData.id = uid;
      finalData.email = cleanEmail;
      finalData.name = `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || cleanEmail;
      
      if (!driverId) {
            await createDriver(finalData);
      } else {
            await updateDriver(driverId, finalData);
      }
      toast({ title: "Legajo Digital Guardado", description: `El perfil ha sido actualizado correctamente.` });
      router.push('/choferes');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en el alta", description: e.message });
    } finally {
      await deleteApp(secondaryApp);
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && driverId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border border-slate-100">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Legajo Digital de Personal</h1>
            <p className="text-sm text-slate-500 font-medium">Gestión integral de documentación y aptitud técnica.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between overflow-x-auto gap-4 scrollbar-hide">
         {[
           { id: 1, label: "Identidad", icon: User },
           { id: 2, label: "Habilitaciones", icon: Award },
           { id: 3, label: "Contacto/Salud", icon: HeartPulse },
           { id: 4, label: "Laboral", icon: Briefcase },
           { id: 5, label: "Documentos", icon: FileText },
           { id: 6, label: "Acceso", icon: Key }
         ].map(s => (
           <div key={s.id} className={cn("flex flex-col items-center gap-1.5 flex-1 min-w-[90px] relative")}>
             <div className={cn(
               "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all", 
               step === s.id ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-110" : 
               step > s.id ? "bg-green-500 text-white border-green-500" : "bg-white text-slate-300 border-slate-100"
             )}>
               {step > s.id ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
             </div>
             <span className={cn("text-[9px] font-black uppercase text-center", step === s.id ? "text-blue-600" : "text-slate-400")}>{s.label}</span>
             {s.id < 6 && <div className={cn("absolute top-5 left-1/2 w-full h-[2px] -z-0", step > s.id ? "bg-green-200" : "bg-slate-100")}></div>}
           </div>
         ))}
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-300">
        {step === 1 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><User size={18} className="text-blue-400"/> 1. Identidad y Datos Personales</CardTitle></CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-8 p-8">
                <div className="md:col-span-4 flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed rounded-[2rem]">
                   <Avatar className="w-48 h-48 rounded-[2rem] border-4 border-white shadow-2xl relative">
                      <AvatarImage src={formData.avatarUrl} className="object-cover" />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-3xl font-black uppercase">{formData.firstName?.[0] || '?'}{formData.lastName?.[0] || '?'}</AvatarFallback>
                      {isProcessingFile === 'avatarUrl' && <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-[2rem]"><Loader2 className="animate-spin text-blue-600" /></div>}
                   </Avatar>
                   <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('avatarUrl', e)} />
                   <Button variant="outline" className="w-full rounded-xl h-11 font-bold text-xs uppercase" onClick={() => avatarInputRef.current?.click()} disabled={!!isProcessingFile}>
                     <Camera size={16} className="mr-2 text-blue-500" /> Capturar Foto
                   </Button>
                </div>
                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombres</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Apellidos</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">DNI N°</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-black text-lg" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Nacimiento</Label><Input type="date" className="h-12 bg-slate-50 border-none rounded-xl" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nacionalidad</Label><Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} /></div>
                   <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Género</Label>
                      <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                         <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                         <SelectContent><SelectItem value="Masculino">Masculino</SelectItem><SelectItem value="Femenino">Femenino</SelectItem><SelectItem value="Otro">Otro / No especifica</SelectItem></SelectContent>
                      </Select>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 2: PROFESIONAL */}
        {step === 2 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-blue-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Award size={18}/> 2. Habilitaciones y Licencias</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                         <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Licencia Nacional Habilitante</p>
                         <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400">N° de Licencia</Label><Input className="h-11 bg-white border-slate-200 rounded-xl font-mono font-bold" value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} /></div>
                         <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400">Vencimiento</Label><Input type="date" className="h-11 bg-white border-slate-200 rounded-xl" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} /></div>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Clases Habilitadas</Label>
                         <div className="flex flex-wrap gap-2">
                            {LICENSE_CLASSES.map(cls => (
                              <button key={cls} type="button" onClick={() => toggleClass(cls)} className={cn("h-10 w-12 rounded-xl border-2 font-black text-xs transition-all", formData.licenseClasses?.includes(cls) ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "bg-white border-slate-100 text-slate-300")}>{cls}</button>
                            ))}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className={cn("p-6 rounded-3xl border-2 transition-all", formData.hasLinti ? "bg-orange-50 border-orange-200" : "bg-slate-50 border-slate-100 opacity-60")}>
                         <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black uppercase text-orange-700 tracking-widest">LINTI (Interjurisdiccional)</p>
                            <Switch checked={formData.hasLinti} onCheckedChange={v => setFormData({...formData, hasLinti: v})} />
                         </div>
                         {formData.hasLinti && (
                           <div className="space-y-4 animate-in fade-in duration-300">
                              <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-orange-400">N° de Trámite LINTI</Label><Input className="h-11 bg-white border-orange-100 rounded-xl font-bold" value={formData.lintiNumber} onChange={e => setFormData({...formData, lintiNumber: e.target.value})} /></div>
                              <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-orange-400">Vencimiento</Label><Input type="date" className="h-11 bg-white border-orange-100 rounded-xl" value={formData.lintiExpiry} onChange={e => setFormData({...formData, lintiExpiry: e.target.value})} /></div>
                           </div>
                         )}
                      </div>

                      <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
                         <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Aptitud CNRT / Psicofísico</p>
                            <Switch checked={formData.hasCnrt} onCheckedChange={v => setFormData({...formData, hasCnrt: v})} />
                         </div>
                         {formData.hasCnrt && (
                           <div className="space-y-1.5 animate-in fade-in">
                              <Label className="text-[9px] font-black text-white/40">Certificado Médico Vence</Label>
                              <Input type="date" className="h-11 bg-white/10 border-none rounded-xl text-white" value={formData.medicalCertificateExpiry} onChange={e => setFormData({...formData, medicalCertificateExpiry: e.target.value})} />
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 3: CONTACTO Y SALUD */}
        {step === 3 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-green-600 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><HeartPulse size={18}/> 3. Comunicación y Salud</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Teléfono Personal (WhatsApp)</Label><Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" placeholder="+54 9..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Dirección Residencial</Label><Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-slate-400">Grupo Sanguíneo</Label>
                         <Select value={formData.bloodType} onValueChange={v => setFormData({...formData, bloodType: v})}>
                            <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="A+">A+</SelectItem><SelectItem value="A-">A-</SelectItem><SelectItem value="B+">B+</SelectItem><SelectItem value="B-">B-</SelectItem><SelectItem value="0+">0+</SelectItem><SelectItem value="0-">0-</SelectItem><SelectItem value="AB+">AB+</SelectItem><SelectItem value="AB-">AB-</SelectItem></SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Obra Social / Prepaga</Label><Input className="h-12 bg-slate-50 border-none rounded-xl" value={formData.healthInsurance} onChange={e => setFormData({...formData, healthInsurance: e.target.value})} /></div>
                      <div className="col-span-2 p-6 bg-red-50 border-2 border-red-100 rounded-3xl space-y-4">
                         <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">En caso de Emergencia avisar a:</p>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label className="text-[9px] font-bold text-red-400 uppercase">Nombre</Label><Input className="h-10 bg-white border-red-100 rounded-xl font-bold" value={formData.emergencyContact} onChange={e => setFormData({...formData, emergencyContact: e.target.value})} /></div>
                            <div className="space-y-1.5"><Label className="text-[9px] font-bold text-red-400 uppercase">Teléfono</Label><Input className="h-10 bg-white border-red-100 rounded-xl font-mono" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} /></div>
                         </div>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 4: LABORAL */}
        {step === 4 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Briefcase size={18}/> 4. Perfil Laboral y Contractual</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-slate-400">Rol Operativo</Label>
                         <Select value={formData.role} onValueChange={(v: DriverRole) => setFormData({...formData, role: v})}>
                            <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-black text-blue-700 uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent>
                               <SelectItem value="driver">🚚 Chofer Profesional</SelectItem>
                               <SelectItem value="companion">👤 Acompañante / Ayudante</SelectItem>
                               <SelectItem value="manager">📊 Gerente de Área</SelectItem>
                               <SelectItem value="coordinator">🛰️ Coordinador Tráfico</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Años Experiencia</Label><Input type="number" className="h-12 bg-slate-50 border-none rounded-xl font-black text-lg" value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: parseInt(e.target.value) || 0})} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Fecha de Ingreso</Label><Input type="date" className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={formData.hireDate} onChange={e => setFormData({...formData, hireDate: e.target.value})} /></div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-slate-400">Modalidad Contrato</Label>
                         <Select value={formData.contractType} onValueChange={v => setFormData({...formData, contractType: v})}>
                            <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Efectivo">Efectivo (Planta)</SelectItem><SelectItem value="Contratado">Contratado / Temp</SelectItem><SelectItem value="Tercerizado">Tercerizado</SelectItem><SelectItem value="Monotributista">Servicios Profesionales</SelectItem></SelectContent>
                         </Select>
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Observaciones Generales</Label>
                      <Textarea className="min-h-[160px] bg-slate-50 border-none rounded-[2rem] p-6 text-xs" placeholder="Detalle cualquier información relevante..." value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} />
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 5: DOCUMENTOS */}
        {step === 5 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><FileText size={18}/> 5. Legajo Digital (Storage)</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {/* DNI FRENTE */}
                   <div className={cn("p-6 border-2 border-dashed rounded-[2rem] text-center space-y-3 transition-all", formData.dniFileUrl ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-100")}>
                      <input type="file" ref={dniFRef} className="hidden" accept="image/*" onChange={e => onFileChange('dniFileUrl', e)} />
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto text-slate-400">
                         {isProcessingFile === 'dniFileUrl' ? <Loader2 className="animate-spin" /> : <Smartphone size={24} />}
                      </div>
                      <div><p className="text-xs font-black uppercase">DNI (Frente)</p></div>
                      <Button size="sm" variant={formData.dniFileUrl ? "outline" : "default"} className="w-full rounded-xl" onClick={() => dniFRef.current?.click()} disabled={!!isProcessingFile}>
                        {formData.dniFileUrl ? 'Cambiar Archivo' : 'Cargar Archivo'}
                      </Button>
                   </div>
                   
                   {/* DNI DORSO */}
                   <div className={cn("p-6 border-2 border-dashed rounded-[2rem] text-center space-y-3 transition-all", formData.dniBackFileUrl ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-100")}>
                      <input type="file" ref={dniBRef} className="hidden" accept="image/*" onChange={e => onFileChange('dniBackFileUrl', e)} />
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto text-slate-400">
                         {isProcessingFile === 'dniBackFileUrl' ? <Loader2 className="animate-spin" /> : <Smartphone size={24} />}
                      </div>
                      <div><p className="text-xs font-black uppercase">DNI (Dorso)</p></div>
                      <Button size="sm" variant={formData.dniBackFileUrl ? "outline" : "default"} className="w-full rounded-xl" onClick={() => dniBRef.current?.click()} disabled={!!isProcessingFile}>
                        {formData.dniBackFileUrl ? 'Cambiar Archivo' : 'Cargar Archivo'}
                      </Button>
                   </div>

                   {/* LICENCIA FRENTE */}
                   <div className={cn("p-6 border-2 border-dashed rounded-[2rem] text-center space-y-3 transition-all", formData.licenseFileUrl ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-100")}>
                      <input type="file" ref={licFRef} className="hidden" accept="image/*" onChange={e => onFileChange('licenseFileUrl', e)} />
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto text-slate-400">
                         {isProcessingFile === 'licenseFileUrl' ? <Loader2 className="animate-spin" /> : <Award size={24} />}
                      </div>
                      <div><p className="text-xs font-black uppercase">Licencia (Frente)</p></div>
                      <Button size="sm" variant={formData.licenseFileUrl ? "outline" : "default"} className="w-full rounded-xl" onClick={() => licFRef.current?.click()} disabled={!!isProcessingFile}>
                        {formData.licenseFileUrl ? 'Cambiar Archivo' : 'Cargar Archivo'}
                      </Button>
                   </div>
                </div>

                <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-3xl flex items-start gap-4">
                   <Info size={24} className="text-blue-600 shrink-0 mt-1" />
                   <div className="space-y-1">
                      <p className="text-xs font-black text-blue-800 uppercase italic">Seguridad de la Información</p>
                      <p className="text-[10px] text-blue-600 leading-relaxed font-medium">Todos los archivos se cifran y almacenan en servidores dedicados. Solo personal de Administración y el propio usuario pueden visualizar estos documentos.</p>
                   </div>
                </div>
             </CardContent>
          </Card>
        )}

        {/* PASO 6: ACCESO */}
        {step === 6 && (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
             <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2"><Key size={18}/> 6. Credenciales de Acceso al App</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-6">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Institucional / Usuario (Login)</Label>
                   <Input type="email" className="h-12 bg-slate-50 border-none rounded-xl font-bold" placeholder="usuario@empresa.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase().trim()})} />
                </div>
                {!driverId && (
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Contraseña Provisoria</Label>
                     <div className="flex gap-2">
                        <Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-black text-lg flex-1" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        <Button variant="secondary" className="h-12 w-12 rounded-xl" onClick={() => setFormData({...formData, password: Math.random().toString(36).substring(2, 10).toUpperCase()})}><RefreshCw size={18}/></Button>
                     </div>
                  </div>
                )}
                
                <div className="pt-8 border-t flex justify-end">
                   <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 h-16 px-16 rounded-2xl font-black text-lg shadow-2xl shadow-green-100 transition-all active:scale-95">
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} FINALIZAR ALTA
                   </Button>
                </div>
             </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t flex justify-center z-50">
        <div className="max-w-5xl w-full flex justify-between items-center px-4">
          <Button variant="ghost" className="font-black text-slate-400 text-xs uppercase" onClick={handleBack} disabled={step === 1 || isSubmitting}>
            <ChevronLeft className="mr-1" size={16} /> VOLVER
          </Button>
          {step < 6 ? (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 h-11 px-8 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-100">
               SIGUIENTE PASO <ChevronRight className="ml-1" size={16} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
