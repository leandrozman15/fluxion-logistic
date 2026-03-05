import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Play, Pause, Clock, CheckCircle2 } from "lucide-react";

export default function CampaignsPage() {
  const campaigns = [
    { id: "1", name: "Indústrias Sul - Abril", state: "finished", sent: 450, failed: 12, scheduled: "Concluída em 15/05" },
    { id: "2", name: "Fábricas Metalúrgicas SP", state: "running", sent: 124, failed: 3, scheduled: "Em progresso" },
    { id: "3", name: "Logística Nacional 2024", state: "paused", sent: 0, failed: 0, scheduled: "Pausada" },
    { id: "4", name: "Prospects New Batch", state: "draft", sent: 0, failed: 0, scheduled: "Rascunho" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Campanhas</h1>
          <p className="text-muted-foreground">Dispare comunicações em massa para seus prospects filtrados.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> Nova Campanha
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${
              campaign.state === 'running' ? 'bg-blue-500' : 
              campaign.state === 'finished' ? 'bg-green-500' :
              campaign.state === 'paused' ? 'bg-orange-500' : 'bg-muted'
            }`}></div>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge variant={campaign.state === 'running' ? 'default' : 'secondary'} className="mb-2">
                  {campaign.state === 'running' ? 'Ativa' : 
                   campaign.state === 'finished' ? 'Finalizada' :
                   campaign.state === 'paused' ? 'Pausada' : 'Rascunho'}
                </Badge>
                <div className="flex gap-1">
                  {campaign.state === 'running' && <Button variant="ghost" size="icon" className="h-6 w-6"><Pause className="w-3 h-3" /></Button>}
                  {campaign.state === 'paused' && <Button variant="ghost" size="icon" className="h-6 w-6"><Play className="w-3 h-3" /></Button>}
                </div>
              </div>
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" /> {campaign.scheduled}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Enviados</div>
                  <div className="text-lg font-bold">{campaign.sent}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Falhas</div>
                  <div className="text-lg font-bold text-destructive">{campaign.failed}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between">
                <Button variant="link" className="p-0 h-auto text-xs">Ver Relatório</Button>
                <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground">Configurações</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}