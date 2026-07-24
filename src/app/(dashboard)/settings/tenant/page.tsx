
'use client';

import { useEffect, useMemo, useState } from "react";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Map as MapIcon, Globe, ShieldCheck, Key, Settings2, Building2 } from "lucide-react";
import { Tenant, TenantSettings, MapProvider } from "@/app/lib/types";

export default function TenantSettingsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenantData, loading } = useDoc<Tenant>(tenantRef);

  useEffect(() => {
    if (tenantData?.settings) {
      setSettings({
        ...tenantData.settings,
        mapProvider: tenantData.settings.mapProvider || 'google',
        mapApiKey: tenantData.settings.mapApiKey || '',
        fleetEngineEnabled: tenantData.settings.fleetEngineEnabled ?? false
      });
    } else if (tenantData) {
      // Configurações padrão iniciais
      setSettings({
        mapProvider: 'google',
        mapApiKey: '',
        fleetEngineEnabled: false
      });
    }
  }, [tenantData]);

  const handleSave = async () => {
    if (!tenantRef || !settings) return;
    setIsSaving(true);
    try {
      await setDoc(tenantRef, {
        settings,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Configurações salvas!", description: "O motor logístico foi atualizado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
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
          <p className="text-slate-500 text-sm">Ajuste los parámetros globales y la integración de mapas.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Cambios
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Configuración de Mapas */}
        <Card className="border-blue-100 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <MapIcon className="w-5 h-5" /> Motor de Mapas y Navegación
            </CardTitle>
            <CardDescription>Seleccione el proveedor de servicios geoespaciales para el seguimiento de flota.</CardDescription>
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

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3">
              <Globe className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1">
                <p><strong>Diferencia de Datos:</strong> Google Maps ofrece mejor cobertura en Argentina. Mapbox permite personalización total del estilo del mapa.</p>
                <p>El uso de estos servicios puede incurrir en costos adicionales según el volumen de la flota.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos de Organización */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" /> Identidad de Organización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razón Social / Nombre</Label>
                  <Input defaultValue={tenantData?.name || "LogísticaAr HQ"} />
                </div>
                <div className="space-y-2">
                  <Label>CUIT de la Empresa</Label>
                  <Input placeholder="30-XXXXXXXX-X" />
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
