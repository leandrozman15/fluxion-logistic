import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, ShieldCheck } from "lucide-react";

export default function LimitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Limites e Consumo</h1>
        <p className="text-muted-foreground">Acompanhe o uso dos recursos do seu plano em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" /> Limite de Emails Diários
            </CardTitle>
            <CardDescription>Reseta todos os dias à meia-noite (BRT).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Consumido: 450</span>
              <span className="text-muted-foreground">Total: 1000</span>
            </div>
            <Progress value={45} className="h-2" />
            <div className="pt-4 border-t flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Sua conta está operando dentro dos limites de segurança.</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" /> Limite de Emails por Hora
            </CardTitle>
            <CardDescription>Controle de cadência para evitar SPAM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Atual (Última hora): 15</span>
              <span className="text-muted-foreground">Máximo: 50</span>
            </div>
            <Progress value={30} className="h-2" />
            <p className="text-xs text-muted-foreground">Este limite ajuda a manter a reputação do seu domínio alta.</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
             <div className="flex justify-between items-start">
               <div>
                 <CardTitle>Plano Atual: Industrial PRO</CardTitle>
                 <CardDescription>Assinatura ativa desde Janeiro de 2024.</CardDescription>
               </div>
               <Badge className="bg-green-600">ATIVO</Badge>
             </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
               <div className="p-4 rounded-lg bg-secondary/50 border">
                 <div className="text-xs text-muted-foreground mb-1">Próxima Fatura</div>
                 <div className="text-lg font-bold">R$ 499,00</div>
                 <div className="text-xs text-muted-foreground">Vencimento: 15/06/2024</div>
               </div>
               <div className="p-4 rounded-lg bg-secondary/50 border">
                 <div className="text-xs text-muted-foreground mb-1">Prospects no Banco</div>
                 <div className="text-lg font-bold">4.580</div>
                 <div className="text-xs text-muted-foreground">Limite: Ilimitado</div>
               </div>
               <div className="p-4 rounded-lg bg-secondary/50 border">
                 <div className="text-xs text-muted-foreground mb-1">Usuários</div>
                 <div className="text-lg font-bold">5 / 10</div>
                 <div className="text-xs text-muted-foreground text-accent font-semibold cursor-pointer">Upgrade Usuários</div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}