
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
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Target, BrainCircuit, Mail, ShieldAlert, Sparkles, MapPin, Factory, ShieldCheck } from "lucide-react";
import { Tenant, TenantSettings } from "@/app/lib/types";
import { Checkbox } from "@/components/ui/checkbox";

const BRAZIL_STATES = ["SP", "SC", "PR", "RS", "MG", "RJ", "BA", "PE", "CE"];
const INDUSTRIAL_SECTORS = [
  { id: "25", label: "Metalurgia / Fabricação Metal" },
  { id: "28", label: "Máquinas e Equipamentos" },
  { id: "29", label: "Automotivo / Autopeças" },
  { id: "30", label: "Outros Equip. Transporte" },
  { id: "31", label: "Móveis / Marcenaria Industrial" }
];

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
        autoDiscoveryEnabled: tenantData.settings.autoDiscoveryEnabled ?? false,
        autoDiscoveryStates: tenantData.settings.autoDiscoveryStates ?? ["SP"],
        autoDiscoveryCNAE: tenantData.settings.autoDiscoveryCNAE ?? ["25", "28"],
        autoDiscoveryLimitPerWeek: tenantData.settings.autoDiscoveryLimitPerWeek ?? 50,
        warmupModeEnabled: tenantData.settings.warmupModeEnabled ?? true,
        spamProtectionLevel: tenantData.settings.spamProtectionLevel ?? 'medium',
        maxAttemptsPerProspect: tenantData.settings.maxAttemptsPerProspect ?? 3
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
      toast({ title: "Configurações salvas!", description: "O motor de prospeção foi atualizado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleState = (state: string) => {
    if (!settings) return;
    const current = settings.autoDiscoveryStates || [];
    const updated = current.includes(state) 
      ? current.filter(s => s !== state) 
      : [...current, state];
    setSettings({ ...settings, autoDiscoveryStates: updated });
  };

  const toggleCnae = (cnae: string) => {
    if (!settings) return;
    const current = settings.autoDiscoveryCNAE || [];
    const updated = current.includes(cnae) 
      ? current.filter(c => c !== cnae) 
      : [...current, cnae];
    setSettings({ ...settings, autoDiscoveryCNAE: updated });
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Configurações da Organização</h1>
          <p className="text-muted-foreground">Ajuste os parâmetros de scoring, limites e operação do radar.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-accent">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="border-2 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-green-600" /> Proteção de Entregabilidade</CardTitle>
            <CardDescription>Evite que seu domínio caia em listas de SPAM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div className="space-y-0.5">
                <Label>Modo Warmup (Aquecimento)</Label>
                <p className="text-xs text-muted-foreground">Aumenta gradualmente os limites de envio para novos domínios.</p>
              </div>
              <Switch 
                checked={settings.warmupModeEnabled} 
                onCheckedChange={(v) => setSettings({...settings, warmupModeEnabled: v})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nível de Proteção Anti-Spam</Label>
                <Select 
                  value={settings.spamProtectionLevel} 
                  onValueChange={(v: any) => setSettings({...settings, spamProtectionLevel: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Leve (Avisa pouco)</SelectItem>
                    <SelectItem value="medium">Médio (Recomendado)</SelectItem>
                    <SelectItem value="high">Rigoroso (Bloqueia riscos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Máximo de Tentativas por Prospect</Label>
                <Input 
                  type="number" 
                  value={settings.maxAttemptsPerProspect} 
                  onChange={(e) => setSettings({...settings, maxAttemptsPerProspect: parseInt(e.target.value)})}
                />
                <p className="text-[10px] text-muted-foreground">Recomendado: 3 e-mails antes do descarte.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> Auto Discovery (Weekly)
              </CardTitle>
              <CardDescription>O sistema buscará novas indústrias automaticamente toda segunda-feira.</CardDescription>
            </div>
            <Switch 
              checked={settings.autoDiscoveryEnabled} 
              onCheckedChange={(v) => setSettings({...settings, autoDiscoveryEnabled: v})}
            />
          </CardHeader>
          {settings.autoDiscoveryEnabled && (
            <CardContent className="space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-4">
                  <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Estados de Atuação</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {BRAZIL_STATES.map(state => (
                      <div key={state} className="flex items-center space-x-2 p-2 border rounded hover:bg-secondary/50 cursor-pointer" onClick={() => toggleState(state)}>
                        <Checkbox id={`state-${state}`} checked={settings.autoDiscoveryStates?.includes(state)} />
                        <label className="text-xs font-semibold cursor-pointer">{state}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="flex items-center gap-2"><Factory className="w-4 h-4" /> Setores Industriais (CNAE)</Label>
                  <div className="space-y-2">
                    {INDUSTRIAL_SECTORS.map(sector => (
                      <div key={sector.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-secondary/50 cursor-pointer" onClick={() => toggleCnae(sector.id)}>
                        <Checkbox id={`cnae-${sector.id}`} checked={settings.autoDiscoveryCNAE?.includes(sector.id)} />
                        <label className="text-[10px] font-medium leading-none cursor-pointer">{sector.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <Label>Volume de Novos Leads (Semanal)</Label>
                  <Badge variant="outline" className="text-accent border-accent">{settings.autoDiscoveryLimitPerWeek} empresas</Badge>
                </div>
                <Slider 
                  value={[settings.autoDiscoveryLimitPerWeek]} 
                  max={100} 
                  min={10} 
                  step={5} 
                  onValueChange={([v]) => setSettings({...settings, autoDiscoveryLimitPerWeek: v})}
                />
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-accent" /> Limites de Comunicação</CardTitle>
            <CardDescription>Controle a cadência para proteger a reputação do seu domínio.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Limite de Envios por Hora</Label>
              <Input 
                type="number" 
                value={settings.hourlyEmailLimit} 
                onChange={(e) => setSettings({...settings, hourlyEmailLimit: parseInt(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <Label>Limite de Envios por Dia</Label>
              <Input 
                type="number" 
                value={settings.dailyEmailLimit} 
                onChange={(e) => setSettings({...settings, dailyEmailLimit: parseInt(e.target.value)})}
              />
            </div>
            <div className="md:col-span-2 bg-amber-50 border border-amber-200 p-3 rounded flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-[11px] text-amber-800">
                Atenção: Limites altos podem marcar seus emails como SPAM. Recomendamos começar com 20/hora e escalar gradualmente conforme o engajamento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
