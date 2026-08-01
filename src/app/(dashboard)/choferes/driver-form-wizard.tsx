
'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useDoc, useUser } from "@/firebase";
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
import { 
  ArrowLeft, Save, Loader2, User, FileText, Phone, Camera, Upload, CheckCircle2, ShieldCheck, Sparkles, Key, ChevronRight
} from "lucide-react";
import { Driver } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compressImage } from "@/lib/utils/image-compression";
import { uploadBase64 } from "@/lib/storage-service";
import { logSystemEvent } from "@/lib/audit-service";

interface DriverFormWizardProps {
  driverId?: string;
}

export default function DriverFormWizard({ driverId }: DriverFormWizardProps) {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const dniInputRef = useRef<HTMLInputElement>(null);
  const licInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Driver>>({
    role: 'driver', firstName: "", lastName: "", dni: "", phone: "", email: "", password: "",
    licenseNumber: "", licenseExpiry: "", status: "active",
    avatarUrl: "", dniFileUrl: "", licenseFileUrl: ""
  });

  const driverRef = useMemo(() => 
    (driverId && db && tenantId) ? doc(db, "tenants", tenantId, "drivers", driverId) : null
  , [db, tenantId, driverId]);

  const { data: existingDriver, loading: loadingExisting } = useDoc<Driver>(driverRef);

  useEffect(() => {
    if (existingDriver) setFormData(existingDriver);
  }, [existingDriver]);

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
        
        await logSystemEvent(db, tenantId, user, 'document_upload', 'driver', formData.dni || 'unknown', { documentType: key });
        
        toast({ title: "Archivo cargado" });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al subir" });
      } finally {
        setIsProcessingFile(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.dni) return toast({ variant: "destructive", title: "Faltan datos", description: "Nombre, Apellido y DNI son obligatorios." });
    }
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!db || !tenantId || !formData.email) return;
    setIsSubmitting(true);
    
    const appName = `auth-worker-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      let uid = driverId;
      const batch = writeBatch(db);

      if (!driverId) {
        if (!formData.password) throw new Error("Debe definir una contraseña.");
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        uid = userCredential.user.uid;

        // Registro Global (Mapping)
        batch.set(doc(db, "users", formData.email.toLowerCase().trim()), {
          uid, email: formData.email.toLowerCase().trim(), tenantId, role: formData.role, status: "active", createdAt: serverTimestamp()
        });
        
        await logSystemEvent(db, tenantId, user, 'create', 'driver', uid, { email: formData.email, dni: formData.dni });
      } else {
        await logSystemEvent(db, tenantId, user, 'update', 'driver', uid!, { email: formData.email, dni: formData.dni });
      }

      const tenantUserRef = doc(db, "tenants", tenantId, "drivers", uid!);
      const { password, ...dataToSave } = formData;
      const finalData = { ...dataToSave, id: uid, updatedAt: serverTimestamp(), createdAt: driverId ? undefined : serverTimestamp() };

      if (driverId) batch.update(tenantUserRef, finalData);
      else batch.set(tenantUserRef, finalData);

      await batch.commit();
      toast({ title: "Personal Registrado OK" });
      router.push('/choferes');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      await deleteApp(secondaryApp);
      setIsSubmitting(false);
    }
  };

  if (loadingExisting && driverId) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4 pt-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
        <div><h1 className="text-2xl font-bold">Alta de Personal Operativo</h1><p className="text-sm text-slate-500">Legajo digital con almacenamiento en Storage.</p></div>
      </div>

      <div className="bg-white p-4 rounded-xl border flex justify-between shadow-sm">
         {[1, 2, 3, 4].map(s => (
           <div key={s} className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", step >= s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>{s}</div>
         ))}
      </div>

      <div className="space-y-6">
        {step === 1 && (
          <Card className="border-none shadow-sm p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed rounded-2xl">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                  <AvatarImage src={formData.avatarUrl} className="object-cover" />
                  <AvatarFallback><User size={48} /></AvatarFallback>
                </Avatar>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('avatarUrl', e)} />
                <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={!!isProcessingFile}><Camera size={14} className="mr-2" /> Foto Perfil</Button>
             </div>
             <div className="space-y-4">
                <div className="space-y-1"><Label>Nombres</Label><Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /></div>
                <div className="space-y-1"><Label>Apellidos</Label><Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /></div>
                <div className="space-y-1"><Label>DNI</Label><Input value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} /></div>
             </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-sm p-8 space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Licencia Nacional</Label><Input value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} /></div>
                <div className="space-y-1"><Label>Vencimiento</Label><Input type="date" value={formData.licenseExpiry} onChange={e => setFormData({...formData, licenseExpiry: e.target.value})} /></div>
             </div>
             <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex items-center justify-between">
                <div><Label className="text-orange-800 font-bold">Posee LINTI</Label><p className="text-[10px] text-orange-600">Habilitación de carga interjurisdiccional</p></div>
                <Switch checked={formData.hasLinti} onCheckedChange={v => setFormData({...formData, hasLinti: v})} />
             </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-sm p-8 space-y-6">
             <div className="space-y-1"><Label>Email de Login (AUTH)</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.toLowerCase().trim()})} /></div>
             {!driverId && (
               <div className="space-y-1"><Label>Contraseña Provisoria</Label>
                  <div className="flex gap-2"><Input value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /><Button variant="secondary" onClick={() => setFormData({...formData, password: Math.random().toString(36).substring(2, 10)})}><Key size={16}/></Button></div>
               </div>
             )}
          </Card>
        )}

        {step === 4 && (
          <Card className="border-none shadow-sm p-8 space-y-6">
             <h3 className="font-bold text-sm uppercase">Documentación Escaneada (Storage)</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className={cn("p-6 border-2 border-dashed rounded-2xl text-center space-y-3", formData.dniFileUrl ? "bg-green-50 border-green-200" : "bg-slate-50")}>
                   <input type="file" ref={dniInputRef} className="hidden" onChange={e => onFileChange('dniFileUrl', e)} />
                   <Upload className="mx-auto text-slate-300" />
                   <p className="text-xs font-bold uppercase">DNI Escaneado</p>
                   <Button size="sm" variant="outline" className="w-full" onClick={() => dniInputRef.current?.click()}>{formData.dniFileUrl ? 'Cambiar' : 'Subir'}</Button>
                </div>
                <div className={cn("p-6 border-2 border-dashed rounded-2xl text-center space-y-3", formData.licenseFileUrl ? "bg-green-50 border-green-200" : "bg-slate-50")}>
                   <input type="file" ref={licInputRef} className="hidden" onChange={e => onFileChange('licenseFileUrl', e)} />
                   <Upload className="mx-auto text-slate-300" />
                   <p className="text-xs font-bold uppercase">Licencia Conducir</p>
                   <Button size="sm" variant="outline" className="w-full" onClick={() => licInputRef.current?.click()}>{formData.licenseFileUrl ? 'Cambiar' : 'Subir'}</Button>
                </div>
             </div>
             <div className="pt-6 border-t flex justify-end">
                <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 h-14 px-12 font-black shadow-xl">
                   {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} FINALIZAR ALTA
                </Button>
             </div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex justify-center gap-4">
        <Button variant="ghost" onClick={handleBack} disabled={step === 1}>VOLVER</Button>
        {step < 4 ? <Button onClick={handleNext} className="bg-blue-600">SIGUIENTE <ChevronRight size={16} /></Button> : null}
      </div>
    </div>
  );
}
