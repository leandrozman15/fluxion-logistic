
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
import { Loader2, Save, Target, BrainCircuit, Mail, ShieldAlert, Sparkles, MapPin, Factory } from "lucide-react";
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
      // Garantir que campos de auto discovery existam
      const currentSettings = tenantData.settings;
      setSettings({
        ...currentSettings,
        autoDiscoveryEnabled: currentSettings.autoDiscoveryEnabled ?? false,
        autoDiscoveryStates: currentSettings.autoDiscoveryStates ?? ["SP"],
        autoDiscoveryCNAE: currentSettings.autoDiscoveryCNAE ?? ["25", "28"],
        autoDiscoveryLimitPerWeek: currentSettings.autoDiscoveryLimitPerWeek ?? 50,
      });
    } else if (tenantData && !tenantData.settings) {
      setSettings({
        scoringWeights: { effective: 0.6, ai: 0.4 },
        finalScoreMode: 'weighted',
        dailyTopLimit: 30,
        requireContactMethod: 'email_or_phone',
        cooldownDays: 7,
        hourlyEmailLimit: 20,
        dailyEmailLimit: 200,
        defaultTemplateId: null,
        autoDiscoveryEnabled: false,
        autoDiscoveryStates: ["SP"],
        autoDiscoveryCNAE: ["25", "28"],
        autoDiscoveryLimitPerWeek: 50
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
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Verifique suas permissões de administrador." });
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
        <Card className={`border-2 transition-all ${settings.autoDiscoveryEnabled ? 'border-accent/30 shadow-md' : 'border-border'}`}>
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
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  O motor de discovery prioriza empresas recém-criadas e localizadas em polos industriais dos estados selecionados.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-accent" /> Radar Diário</CardTitle>
            <CardDescription>Configure como a lista Top do dia é gerada e filtrada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Limite de Prospectos (Top N)</Label>
                <Select 
                  value={settings.dailyTopLimit.toString()} 
                  onValueChange={(v) => setSettings({...settings, dailyTopLimit: parseInt(v)})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">Top 20</SelectItem>
                    <SelectItem value="30">Top 30</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Recomendado: 30 para manter o foco operacional.</p>
              </div>
              <div className="space-y-2">
                <Label>Exigência de Contato</Label>
                <Select 
                  value={settings.requireContactMethod} 
                  onValueChange={(v: any) => setSettings({...settings, requireContactMethod: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email_or_phone">Email ou Telefone</SelectItem>
                    <SelectItem value="email_only">Apenas Email</SelectItem>
                    <SelectItem value="none">Nenhuma (Trazer todos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Janela de Cooldown (Dias)</Label>
                <Input 
                  type="number" 
                  value={settings.cooldownDays} 
                  onChange={(e) => setSettings({...settings, cooldownDays: parseInt(e.target.value)})}
                />
                <p className="text-[10px] text-muted-foreground">Evita sugerir empresas contactadas recentemente.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-primary" /> Pesos do Motor de Scoring</CardTitle>
            <CardDescription>Determine como o algoritmo prioriza as empresas no radar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Regras de Dados ({Math.round(settings.scoringWeights.effective * 100)}%)</Badge>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <Badge className="bg-primary">Análise IA ({Math.round(settings.scoringWeights.ai * 100)}%)</Badge>
                </div>
                <Select 
                  value={settings.finalScoreMode} 
                  onValueChange={(v: any) => setSettings({...settings, finalScoreMode: v})}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weighted">Ponderado</SelectItem>
                    <SelectItem value="max">Maior Nota</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Slider 
                value={[settings.scoringWeights.effective * 100]} 
                max={100} 
                step={5} 
                onValueChange={([v]) => setSettings({
                  ...settings, 
                  scoringWeights: { effective: v/100, ai: (100-v)/100 }
                })}
              />
              <p className="text-xs text-muted-foreground italic">
                {settings.finalScoreMode === 'weighted' 
                  ? "O score final será uma média ponderada entre a qualidade dos datos e a análise de potencial da IA."
                  : "O sistema usará sempre a melhor nota entre os datos e a IA."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-accent" /> Limites de Comunicação</CardTitle>
            <CardDescription>Controle a cadência para proteger a reputación do seu domínio.</CardDescription>
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
