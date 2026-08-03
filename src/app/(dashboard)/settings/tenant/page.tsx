'use client';

import { useEffect, useRef, useState } from "react";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  Building2,
  Phone,
  Camera,
  Image as ImageIcon,
  User,
  MapPin,
  Info,
  Smartphone,
} from "lucide-react";
import { TenantSettings, Country } from "@/app/lib/types";
import { compressImage } from "@/lib/utils/image-compression";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadBase64 } from "@/lib/storage-service";
import { getTenantProfile, updateTenantProfile } from "@/lib/settings-api";

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];

const DEFAULT_SETTINGS: TenantSettings = {
  mapProvider: "google",
  mapApiKey: "",
  fleetEngineEnabled: false,
  gpsIntervalSeconds: 60,
  centralPhone: "",
  logoUrl: "",
  cuit: "",
  legalAddress: "",
  legalCityState: "",
  responsibleName: "",
  country: "Argentina",
  enabledModules: [],
};

export default function TenantSettingsPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [tenantName, setTenantName] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTenant() {
      if (!tenantId) {
        if (active) {
          setTenantName("");
          setSettings({ ...DEFAULT_SETTINGS });
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const tenantData = await getTenantProfile();
        if (!active) return;

        setTenantName(tenantData.name || "");
        setSettings({ ...DEFAULT_SETTINGS, ...(tenantData.settings || {}) });
      } catch (error) {
        if (!active) return;
        setTenantName("");
        setSettings({ ...DEFAULT_SETTINGS });
        toast({
          variant: "destructive",
          title: "No se pudo cargar configuración",
          description: (error as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTenant();
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings || !tenantId) return;

    setIsProcessingLogo(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const compressed = await compressImage(base64, 400, 400, 0.8);
      const url = await uploadBase64(`tenants/${tenantId}/branding/logo.jpg`, compressed);
      setSettings({ ...settings, logoUrl: url });
      toast({ title: "Logo actualizado", description: "La imagen corporativa ha sido guardada." });
    } catch {
      toast({ variant: "destructive", title: "Error al subir logo" });
    } finally {
      setIsProcessingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await updateTenantProfile({
        name: tenantName,
        settings,
      });
      toast({ title: "Configuraciones guardadas", description: "Los cambios se han aplicado a toda la organización." });
    } catch {
      toast({ variant: "destructive", title: "Error al salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter">Parámetros de Organización</h1>
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-1">Gestión de identidad, contacto y operativa multi-tenant</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 rounded-2xl shadow-xl shadow-blue-100 font-black uppercase text-xs">
          {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR CAMBIOS
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 text-white p-8">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Building2 size={18} className="text-blue-400" /> 1. Identidad y Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row gap-10 items-start">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="w-32 h-32 rounded-[2rem] border-4 border-slate-50 shadow-2xl relative">
                  <AvatarImage src={settings.logoUrl} className="object-contain p-4" />
                  <AvatarFallback className="bg-slate-50 text-slate-200"><ImageIcon size={48} /></AvatarFallback>
                  {isProcessingLogo && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-[2rem]">
                      <Loader2 className="animate-spin text-blue-600" />
                    </div>
                  )}
                </Avatar>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                <Button variant="outline" size="sm" className="w-full rounded-xl font-bold text-[10px] uppercase" onClick={() => fileInputRef.current?.click()} disabled={isProcessingLogo || !tenantId}>
                  <Camera size={14} className="mr-2" /> Cambiar Logo
                </Button>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Razón Social</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">CUIT / ID Tributario</Label>
                  <Input className="h-12 bg-slate-50 border-none rounded-xl font-mono font-black" value={settings.cuit} onChange={(e) => setSettings({ ...settings, cuit: e.target.value })} />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Responsable Legal / Titular</Label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-3 text-slate-300" />
                    <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12" value={settings.responsibleName} onChange={(e) => setSettings({ ...settings, responsibleName: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-blue-600 text-white p-8">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <MapPin size={18} /> 2. Ubicación Fiscal y Operativa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dirección de Oficina Central</Label>
              <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" placeholder="Calle, Número, Piso/Depto" value={settings.legalAddress} onChange={(e) => setSettings({ ...settings, legalAddress: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ciudad / Provincia</Label>
                <Input className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={settings.legalCityState} onChange={(e) => setSettings({ ...settings, legalCityState: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">País Sede</Label>
                <Select value={(settings.country || "Argentina") as Country} onValueChange={(v: Country) => setSettings({ ...settings, country: v })}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-100/50 border-b p-8">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-600">
              <Smartphone size={18} className="text-blue-600" /> 3. Canales de Asistencia al Chofer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-3xl flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 shrink-0">
                <Phone size={24} />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs font-black uppercase text-blue-800">Línea Directa de Central (SOS)</Label>
                <p className="text-[10px] text-blue-600 leading-relaxed font-medium mb-3">
                  Este número aparecerá en la aplicación móvil de los conductores. Será el destino de las llamadas de emergencia y reportes de ruta.
                </p>
                <Input
                  className="h-12 bg-white border-blue-200 rounded-xl font-mono font-black text-xl text-blue-900"
                  placeholder="+54 9 11 XXXX-XXXX"
                  value={settings.centralPhone}
                  onChange={(e) => setSettings({ ...settings, centralPhone: e.target.value })}
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-start gap-4">
              <Info size={24} className="text-slate-400 shrink-0 mt-1" />
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-700 uppercase italic">Seguridad de Datos</p>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                  Toda la información aquí vertida es utilizada para la generación de documentos oficiales (Hojas de Ruta, Rendiciones y Presupuestos) y para el enlace técnico con las unidades en tránsito.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
