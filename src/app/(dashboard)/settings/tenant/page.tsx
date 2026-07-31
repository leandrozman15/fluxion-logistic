
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

export default function TenantSettingsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [tenantName, setTenantName] = useState("");

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenantData, loading } = useDoc<Tenant>(tenantRef);

  useEffect(() => {
    if (tenantData) {
      setTenantName(tenantData.name || "");
      if (tenantData.settings) {
        setSettings({
          ...tenantData.settings,
          mapProvider: tenantData.settings.mapProvider || 'google',
          mapApiKey: tenantData.settings.mapApiKey || '',
          fleetEngineEnabled: tenantData.settings.fleetEngineEnabled ?? false,
          gpsIntervalSeconds: tenantData.settings.gpsIntervalSeconds || 60,
          centralPhone: tenantData.settings.centralPhone || '',
          logoUrl: tenantData.settings.logoUrl || '',
          cuit: tenantData.settings.cuit || ''
        });
      } else {
        setSettings({
          mapProvider: 'google',
          mapApiKey: '',
          fleetEngineEnabled: false,
          gpsIntervalSeconds: 60,
          centralPhone: '',
          logoUrl: '',
          cuit: ''
        });
      }
    }
  }, [tenantData]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settings) {
      setIsProcessingLogo(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const compressed = await compressImage(base64, 400, 400, 0.8);
          setSettings({ ...settings, logoUrl: compressed });
          toast({ title: "Logo optimizado", description: "La imagen está lista para aplicarse." });
        } catch (err) {
          setSettings({ ...settings, logoUrl: base64 });
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
      await updateDoc(tenantRef, {
        name: tenantName,
        settings,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Configuraciones guardadas!", description: "La identidad de la organización ha sido actualizada." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro al salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración del Sistema</h1>
          <p className="text-slate-500 text-sm">Ajuste los parámetros globales y la identidad de marca.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Cambios
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Identidad de Marca */}
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Building2 className="w-5 h-5 text-blue-600" /> Identidad de Organización
             </CardTitle>
             <CardDescription>Configure el nombre, CUIT y logo de su empresa para documentos oficiales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="flex flex-col items-center gap-3">
                   <Label className="text-[10px] uppercase font-bold text-slate-400">Logo de Empresa</Label>
                   <Avatar className="w-24 h-24 rounded-2xl border-2 border-slate-100 shadow-inner">
                      <AvatarImage src={settings.logoUrl} className="object-contain p-2" />
                      <AvatarFallback className="bg-slate-50 text-slate-300">
                         <ImageIcon size={32} />
                      </AvatarFallback>
                   </Avatar>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                   <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold" onClick={() => fileInputRef.current?.click()} disabled={isProcessingLogo}>
                      {isProcessingLogo ? <Loader2 className="animate-spin w-3 h-3 mr-1" /> : <Camera size={12} className="mr-1" />}
                      CAMBIAR LOGO
                   </Button>
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                   <div className="space-y-2">
                      <Label>Razón Social / Nombre Comercial</Label>
                      <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Ej: Molauf S.A." />
                   </div>
                   <div className="space-y-2">
                      <Label>CUIT de la Empresa</Label>
                      <Input value={settings.cuit} onChange={e => setSettings({...settings, cuit: e.target.value})} placeholder="30-XXXXXXXX-X" />
                   </div>
                   <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-blue-600 font-bold">
                        <Phone size={14} /> Teléfono Central de Ayuda
                      </Label>
                      <Input value={settings.centralPhone} onChange={e => setSettings({...settings, centralPhone: e.target.value})} placeholder="Ej: 0800-555-1234" />
                      <p className="text-[10px] text-slate-400 italic">Este número aparecerá en la App del Chofer para comunicación directa.</p>
                   </div>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Parámetros de Telemetría */}
        <Card className="border-blue-100 shadow-sm">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Satellite className="w-5 h-5 text-blue-600" /> Parámetros de Telemetría
             </CardTitle>
             <CardDescription>Regule la intensidad del rastreo GPS para toda la flota.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <Label className="flex items-center gap-2">Intervalo de Disparo GPS (Segundos)</Label>
                   <Input 
                    type="number" 
                    min="5" 
                    max="300"
                    placeholder="Estandar: 60" 
                    className="bg-white font-bold"
                    value={settings.gpsIntervalSeconds} 
                    onChange={e => setSettings({...settings, gpsIntervalSeconds: parseInt(e.target.value) || 60})}
                   />
                   <p className="text-[10px] text-slate-400 italic">Menos segundos = mayor precisión pero más consumo de batería.</p>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Configuración de Mapas */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <MapIcon className="w-5 h-5 text-blue-600" /> Motor de Mapas y Navegación
            </CardTitle>
            <CardDescription>Servicios geoespaciales para el seguimiento de flota.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Proveedor de Mapas</Label>
                <Select 
                  value={settings.mapProvider} 
                  onValueChange={(v: MapProvider) => setSettings({...settings, mapProvider: v})}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Maps Platform</SelectItem>
                    <SelectItem value="mapbox">Mapbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">API Key / Access Token <Key className="w-3 h-3 text-slate-400" /></Label>
                <Input 
                  type="password"
                  placeholder="Inserte su clave de API" 
                  className="bg-white"
                  value={settings.mapApiKey} 
                  onChange={e => setSettings({...settings, mapApiKey: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  Habilitar Fleet Engine / Tracking Avanzado
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[8px] uppercase">PRO</Badge>
                </Label>
                <p className="text-xs text-slate-500">Permite sincronización de alta frecuencia y algoritmos de optimización de rutas.</p>
              </div>
              <Switch 
                checked={settings.fleetEngineEnabled} 
                onCheckedChange={v => setSettings({...settings, fleetEngineEnabled: v})}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
