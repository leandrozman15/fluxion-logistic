
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Target, 
  Rocket, 
  Settings, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  Building2,
  BrainCircuit,
  Upload,
  Search
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Tenant, TenantSettings } from "@/app/lib/types";

export default function OnboardingPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // Settings Local State
  const [weights, setWeights] = useState({ effective: 0.6, ai: 0.4 });
  const [dailyLimit, setDailyLimit] = useState(30);
  const [templateName, setTemplateName] = useState("Primeiro Contato Industrial");

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const handleCompleteStep = () => {
    setStep(prev => prev + 1);
  };

  const handleFinishOnboarding = async () => {
    if (!tenantRef || !db || !user) return;
    setIsSaving(true);
    try {
      // 1. Update Tenant Settings
      await setDoc(tenantRef, {
        settings: {
          scoringWeights: weights,
          dailyTopLimit: dailyLimit,
          onboardingCompleted: true,
          finalScoreMode: 'weighted',
          requireContactMethod: 'email_or_phone',
          cooldownDays: 7,
          hourlyEmailLimit: 20,
          dailyEmailLimit: 200,
          defaultTemplateId: null
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Create Default Template
      await addDoc(collection(db, "tenants", tenantId!, "templates"), {
        name: templateName,
        subject: "Olá {{contactName}}, solução para {{companyName}}",
        body: `Olá {{contactName}}, <br><br> Vi que a <b>{{companyName}}</b> atua fortemente no setor industrial em {{city}}/{{state}} e gostaria de apresentar nossa solução.<br><br>Atenciosamente,`,
        variablesUsed: ['contactName', 'companyName', 'city', 'state'],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        tenantId
      });

      toast({ title: "Onboarding Concluído!", description: "Seu motor de prospecção está configurado." });
      router.push("/dashboard");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary">Bem-vindo ao Fluxion Radar</h1>
          <p className="text-muted-foreground text-sm">Vamos configurar seu motor de vendas em 3 minutos.</p>
        </div>
      </div>

      <div className="space-y-8">
        {step === 1 && (
          <Card className="border-2 border-primary/10 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-accent" /> Começando a Jornada
              </CardTitle>
              <CardDescription>O Fluxion Radar identifica e prioriza diariamente as melhores oportunidades industriais para seu time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-secondary/50 border text-center space-y-2">
                  <Upload className="w-6 h-6 mx-auto text-primary" />
                  <div className="text-xs font-bold uppercase">Importe</div>
                  <p className="text-[10px] text-muted-foreground">Suba seu CSV ou use nosso motor de busca.</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 border text-center space-y-2">
                  <BrainCircuit className="w-6 h-6 mx-auto text-accent" />
                  <div className="text-xs font-bold uppercase">Priorize</div>
                  <p className="text-[10px] text-muted-foreground">IA analisa potencial industrial real.</p>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50 border text-center space-y-2">
                  <CheckCircle2 className="w-6 h-6 mx-auto text-green-600" />
                  <div className="text-xs font-bold uppercase">Converta</div>
                  <p className="text-[10px] text-muted-foreground">Abordagens via E-mail e WhatsApp.</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-primary" onClick={handleCompleteStep}>
                Configurar Meu Motor <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="animate-in fade-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Ajuste o Algoritmo
              </CardTitle>
              <CardDescription>Determine como o sistema deve priorizar as empresas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 py-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Mix de Scoring</Label>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{Math.round(weights.effective * 100)}% Dados</Badge>
                    <Badge className="bg-accent">{Math.round(weights.ai * 100)}% IA</Badge>
                  </div>
                </div>
                <Slider 
                  value={[weights.effective * 100]} 
                  max={100} 
                  step={5} 
                  onValueChange={([v]) => setWeights({ effective: v/100, ai: (100-v)/100 })}
                />
                <p className="text-xs text-muted-foreground italic text-center">
                  Recomendado: 60% Dados / 40% IA para começar com equilíbrio.
                </p>
              </div>

              <div className="space-y-4">
                <Label>Meta de Prospecção Diária (Radar)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 30, 50].map(val => (
                    <Button 
                      key={val} 
                      variant={dailyLimit === val ? "default" : "outline"} 
                      onClick={() => setDailyLimit(val)}
                      className="text-xs"
                    >
                      Top {val}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleCompleteStep}>Próximo Passo</Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="animate-in fade-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Comunicação Inicial
              </CardTitle>
              <CardDescription>Criaremos um template padrão para você começar hoje mesmo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Modelo</Label>
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} />
              </div>
              <div className="bg-secondary/20 p-4 rounded-lg border text-xs space-y-2">
                <p className="font-bold text-muted-foreground uppercase">Conteúdo Recomendado:</p>
                <p className="text-muted-foreground leading-relaxed">
                  "Olá <b>{`{{contactName}}`}</b>, vi que a <b>{`{{companyName}}`}</b> atua fortemente no setor industrial em <b>{`{{city}}`}</b> e gostaria de apresentar nossa solução..."
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-accent hover:bg-accent/90" onClick={handleFinishOnboarding} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Finalizar e Ir para o Dashboard
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <div className="mt-8 flex justify-center gap-1">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-muted'}`}></div>
        ))}
      </div>
    </div>
  );
}
