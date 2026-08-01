
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, serverTimestamp, doc, updateDoc, setDoc, writeBatch } from "firebase/firestore";
import { initializeApp, deleteApp, getApps, getApp } from "firebase/app";
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
import { uploadBase64 } from "@/lib/storage-service";

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
      if (!formData.firstName) return toast({ variant: "destructive", title: "Información Faltante", description: "Ingrese Nombres." });
      if (!formData.lastName) return toast({ variant: "destructive", title: "Información Faltante", description: "Ingrese Apellidos." });
      if (!formData.dni) return toast({ variant: "destructive", title: "Información Faltante", description: "DNI obligatorio." });
    }
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleFileClick = (key: string) => {
    const refs: any = { avatarUrl: avatarInputRef, dniFileUrl: dniInputRef, dniBackFileUrl: dniBackInputRef, licenseFileUrl: licenseInputRef, licenseBackFileUrl: licenseBackInputRef, lintiFileUrl: lintiInputRef };
    refs[key]?.current?.click();
  };

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;

    setIsProcessingFile(key);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        
        // Subir a Storage inmediatamente para obtener URL
        const fileName = `${key}_${Date.now()}.jpg`;
        const storagePath = `tenants/${tenantId}/drivers/${formData.dni || 'temp'}/${fileName}`;
        const downloadUrl = await uploadBase64(storagePath, compressed);
        
        setFormData(prev => ({ ...prev, [key]: downloadUrl }));
        toast({ title: "Archivo subido con éxito" });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al subir archivo" });
      } finally {
        setIsProcessingFile(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const generateProvisionalPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let pass = "";
    for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const handleSubmit = async () => {
    if (!db || !tenantId || !formData.email) return;
    setIsSubmitting(true);
    
    const appName = `invite-auth-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      let uid = driverId;
      const batch = writeBatch(db);

      if (!driverId) {
        if (!formData.password) throw new Error("Debe definir una contraseña.");
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        uid = userCredential.user.uid;

        const globalUserRef = doc(db, "users", formData.email.toLowerCase().trim());
        batch.set(globalUserRef, { uid, email: formData.email.toLowerCase().trim(), tenantId, role: formData.role, status: "active", createdAt: serverTimestamp() });
      }

      const tenantUserRef = doc(db, "tenants", tenantId, "drivers", uid!);
      const { password, ...dataToSave } = formData;
      const finalData = { ...dataToSave, id: uid, email: formData.email.toLowerCase().trim(), updatedAt: serverTimestamp(), ...(driverId ? {} : { createdAt: serverTimestamp() }) };

      if (driverId) batch.update(tenantUserRef, finalData);
      else batch.set(tenantUserRef, finalData);

      await batch.commit();
      toast({ title: driverId ? "Perfil Actualizado" : "Alta Exitosa" });
      router.push('/choferes');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      await deleteApp(secondaryApp);
      setIsSubmitting(false);
    }
  };

  const toggleLicenseClass = (cls: string) => {
    const current = formData.licenseClasses || [];
    setFormData({ ...formData, licenseClasses: current.includes(cls) ? current.filter(c => c !== cls) : [...current, cls] });
  };

  if (loadingExisting && driverId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between px-4 pt-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold">Registro de Personal</h1>
            <p className="text-sm text-slate-500">Documentación digitalizada en la nube.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm mx-4 flex justify-between">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", step >= s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>{s}</div>
          ))}
      </div>

      <div className="mx-4">
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Identificación</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                  <AvatarImage src={formData.avatarUrl} className="object-cover" />
                  <AvatarFallback><User size={48} /></AvatarFallback>
                </Avatar>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('avatarUrl', e)} />
                <Button variant="outline" size="sm" onClick={() => handleFileClick('avatarUrl')} disabled={isProcessingFile === 'avatarUrl'}>
                  {isProcessingFile === 'avatarUrl' ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Camera size={14} className="mr-2" />} 
                  Cambiar Foto
                </Button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1"><Label>Rol</Label>
                  <Select value={formData.role} onValueChange={(v: any) => setFormData({...formData, role: v})}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="manager">Gerente</SelectItem><SelectItem value="driver">Chofer</SelectItem><SelectItem value="companion">Acompañante</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-1"><Label>DNI</Label><Input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} /></div>
                <div className="space-y-1"><Label>Nombres</Label><Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /></div>
                <div className="space-y-1"><Label>Apellidos</Label><Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /></div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Habilitaciones</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1"><Label>Licencia Nacional</Label><Input value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} /></div>
                <div className="space-y-1"><Label>Vencimiento</Label><Input type="date" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} /></div>
              </div>
              <div className="p-4 bg-blue-50 border rounded-xl space-y-4">
                <div className="flex justify-between items-center"><Label>LINTI</Label><Switch checked={formData.hasLinti} onCheckedChange={v => setFormData({...formData, hasLinti: v})} /></div>
                {formData.hasLinti && <Input type="date" value={formData.lintiExpiry} onChange={e => setFormData({...formData, lintiExpiry: e.target.value})} />}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Acceso</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1"><Label>Email de Login</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
              {!driverId && <div className="space-y-1"><Label>Contraseña Provisoria</Label><div className="flex gap-2"><Input value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /><Button variant="secondary" onClick={generateProvisionalPassword}><Sparkles size={16}/></Button></div></div>}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Legajo Digital (Storage)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <input type="file" ref={dniInputRef} className="hidden" onChange={e => onFileChange('dniFileUrl', e)} />
              <input type="file" ref={dniBackInputRef} className="hidden" onChange={e => onFileChange('dniBackFileUrl', e)} />
              <input type="file" ref={licenseInputRef} className="hidden" onChange={e => onFileChange('licenseFileUrl', e)} />
              <input type="file" ref={licenseBackInputRef} className="hidden" onChange={e => onFileChange('licenseBackFileUrl', e)} />
              <input type="file" ref={lintiInputRef} className="hidden" onChange={e => onFileChange('lintiFileUrl', e)} />
              
              {[
                { label: "DNI F", key: "dniFileUrl" }, { label: "DNI D", key: "dniBackFileUrl" },
                { label: "LIC F", key: "licenseFileUrl" }, { label: "LIC D", key: "licenseBackFileUrl" },
                { label: "LINTI", key: "lintiFileUrl" }
              ].map(doc => (
                <div key={doc.key} className={cn("p-3 border-2 border-dashed rounded-xl text-center space-y-2", formData[doc.key as keyof typeof formData] ? "border-green-500 bg-green-50" : "border-slate-200")}>
                   {isProcessingFile === doc.key ? <Loader2 className="animate-spin mx-auto" /> : <Upload className="mx-auto" size={16}/>}
                   <p className="text-[9px] font-bold uppercase">{doc.label}</p>
                   <Button size="sm" className="h-6 text-[8px] w-full" variant="outline" onClick={() => handleFileClick(doc.key)}>Subir</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center gap-4">
        <Button variant="ghost" onClick={handleBack} disabled={step === 1}>Volver</Button>
        {step < 4 ? <Button onClick={handleNext} className="bg-blue-600">Siguiente</Button> : <Button onClick={handleSubmit} className="bg-green-600" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />} Guardar</Button>}
      </div>
    </div>
  );
}
