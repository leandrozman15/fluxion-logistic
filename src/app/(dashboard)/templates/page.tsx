import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus, Edit, Copy, Trash2 } from "lucide-react";

export default function TemplatesPage() {
  const templates = [
    { id: "1", name: "Primeiro Contato Industrial", subject: "Apresentação: Soluções para {{companyName}}", body: "Olá, notamos que a {{companyName}} está em plena expansão..." },
    { id: "2", name: "Follow-up Demo", subject: "Sobre nossa demonstração na {{companyName}}", body: "Gostaria de agradecer o tempo hoje cedo..." },
    { id: "3", name: "Convite Evento Manufatura", subject: "Convite VIP: Fluxion Radar no ExpoIndustrial", body: "Olá, gostaria de convidar seu time para..." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Templates de Email</h1>
          <p className="text-muted-foreground">Crie modelos personalizados com variáveis dinâmicas.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription className="text-xs">Assunto: {template.subject}</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
               <div className="p-3 bg-secondary/50 rounded text-sm text-muted-foreground line-clamp-3 font-mono italic">
                 {template.body}
               </div>
               <div className="mt-3 flex gap-2">
                 <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{"{{companyName}}"}</span>
                 <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{"{{city}}"}</span>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}