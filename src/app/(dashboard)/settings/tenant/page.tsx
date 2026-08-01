
'use client';

import { useEffect, useMemo, useState, useRef } from "react";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Map as MapIcon, Globe, ShieldCheck, Key, Settings2, Building2, Phone, Camera, Image as ImageIcon, Satellite } from "lucide-react";
import { Tenant, TenantSettings, MapProvider } from "@/app/lib/types";
import { compressImage } from "@/lib/utils/image-compression";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadBase64 } from "@/lib/storage-service";

export default function TenantSettingsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [tenantName, setTenantName] = useState("");

  const tenantRef = useMemo(() => (db && tenantId) ? doc(db, "tenants", tenantId) : null, [db, tenantId]);
  const { data: tenantData, loading } = useDoc<Tenant>(tenantRef);

  useEffect(() => {
    if (tenantData) {
      setTenantName(tenantData.name || "");
      setSettings(tenantData.settings || { mapProvider: 'google', mapApiKey: '', fleetEngineEnabled: false, gpsIntervalSeconds: 60, centralPhone: '', logoUrl: '', cuit: '' });
    }
  }, [tenantData]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settings && tenantId) {
      setIsProcessingLogo(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressed = await compressImage(base64, 400, 400, 0.8);
          const url = await uploadBase64(`tenants/${tenantId}/branding/logo.jpg`, compressed);
          setSettings({ ...settings, logoUrl: url });
          toast({ title: "Logo actualizado en Storage" });
        } catch (err) {
          toast({ variant: "destructive", title: "Error al subir logo" });
        } finally {
          setIsProcessingLogo(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!tenantRef || !settings) return;
    setIsSaving(true);
    try {
      await updateDoc(tenantRef, { name: tenantName, settings, updatedAt: serverTimestamp() });
      toast({ title: "Configuraciones guardadas" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pt-6">
        <div><h1 className="text-2xl font-bold">Configuración del Sistema</h1></div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600">{isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} Guardar</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Identidad Corporativa</CardTitle></CardHeader>
        <CardContent className="flex items-start gap-8">
           <div className="flex flex-col items-center gap-3">
              <Avatar className="w-24 h-24 rounded-2xl border shadow-sm"><AvatarImage src={settings.logoUrl} className="object-contain p-2" /><AvatarFallback><ImageIcon size={32}/></AvatarFallback></Avatar>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleLogoChange} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isProcessingLogo}>{isProcessingLogo ? <Loader2 className="animate-spin" /> : 'Cambiar Logo'}</Button>
           </div>
           <div className="flex-1 space-y-4">
              <div className="space-y-1"><Label>Razón Social</Label><Input value={tenantName} onChange={e => setTenantName(e.target.value)} /></div>
              <div className="space-y-1"><Label>CUIT</Label><Input value={settings.cuit} onChange={e => setSettings({...settings, cuit: e.target.value})} /></div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
