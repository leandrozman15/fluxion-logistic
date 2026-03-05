import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Globe, MapPin, Mail, Phone, ExternalLink, MessageSquare, History, Sparkles } from "lucide-react";

export default function ProspectDetailPage({ params }: { params: { id: string } }) {
  // Mock data for a detailed view
  const prospect = {
    id: params.id,
    companyName: "Indústrias Matarazzo S.A.",
    cnpj: "12.345.678/0001-90",
    status: "interested",
    score: 85,
    scoreReasons: [
      "Possui website industrial ativo",
      "CNPJ validado no sistema",
      "Tags de manufatura detectadas",
      "Localização em polo industrial"
    ],
    websiteUrl: "https://matarazzoindustria.com.br",
    domain: "matarazzoindustria.com.br",
    address: { city: "São Paulo", state: "SP", country: "Brasil" },
    contacts: [
      { name: "Carlos Silva", role: "Diretor Comercial", email: "carlos@matarazzoindustria.com.br", phone: "+55 11 98888-7777", whatsapp: "5511988887777" },
      { name: "Ana Paula", role: "Compradora", email: "ana.paula@matarazzoindustria.com.br", phone: "+55 11 97777-6666" }
    ],
    notes: "Empresa expandindo planta em 2024. Interessados em automação de linha de montagem."
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{prospect.companyName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{prospect.cnpj}</Badge>
              <Badge variant="default" className="bg-accent">Score: {prospect.score}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Editar</Button>
          <Button size="sm">Falar no WhatsApp</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visão Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a href={prospect.websiteUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                      {prospect.domain} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{prospect.address.city}, {prospect.address.state}</span>
                  </div>
                </div>
                <div className="space-y-2">
                   <h4 className="text-xs font-bold uppercase text-muted-foreground">Análise de IA (Score)</h4>
                   <ul className="space-y-1">
                     {prospect.scoreReasons.map((reason, i) => (
                       <li key={i} className="text-sm flex items-start gap-2">
                         <Sparkles className="w-3 h-3 text-accent mt-1" />
                         {reason}
                       </li>
                     ))}
                   </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="contacts">
            <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
              <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Contatos ({prospect.contacts.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Histórico
              </TabsTrigger>
              <TabsTrigger value="enrich" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Enriquecimento
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contacts" className="mt-6 space-y-4">
              {prospect.contacts.map((contact, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary">
                        {contact.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">{contact.role}</div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email}</span>
                        <span className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</span>
                      </div>
                      {contact.whatsapp && (
                        <Button variant="outline" size="icon" className="text-green-600 border-green-200">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="history" className="mt-6">
               <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div className="w-0.5 h-full bg-border"></div>
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-semibold">Campanha "Fábricas SP" disparada</div>
                      <div className="text-xs text-muted-foreground">Ontem às 14:30</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-border"></div>
                      <div className="w-0.5 h-full bg-border"></div>
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-semibold">Prospect criado manualmente</div>
                      <div className="text-xs text-muted-foreground">20/05/2024 às 10:15</div>
                    </div>
                  </div>
               </div>
            </TabsContent>
            <TabsContent value="enrich" className="mt-6">
               <Card className="border-dashed">
                 <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                   <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                     <Sparkles className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-semibold">Sugerir Enriquecimento de Dados</h3>
                     <p className="text-sm text-muted-foreground">Nossa IA pode buscar emails corporativos e domínios adicionais para esta empresa.</p>
                   </div>
                   <Button variant="outline">Executar Busca</Button>
                 </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status do Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-2 gap-2">
                 <Button variant={prospect.status === 'new' ? 'default' : 'outline'} size="sm">Novo</Button>
                 <Button variant={prospect.status === 'contacted' ? 'default' : 'outline'} size="sm">Contactado</Button>
                 <Button variant={prospect.status === 'interested' ? 'default' : 'outline'} size="sm">Interessado</Button>
                 <Button variant={prospect.status === 'demo' ? 'default' : 'outline'} size="sm">Demo</Button>
                 <Button variant={prospect.status === 'client' ? 'default' : 'outline'} size="sm">Cliente</Button>
                 <Button variant={prospect.status === 'discarded' ? 'destructive' : 'outline'} size="sm">Descartado</Button>
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas de Negócio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <Textarea placeholder="Adicione uma observação técnica ou comercial..." className="min-h-[120px]" defaultValue={prospect.notes} />
               <Button className="w-full" size="sm">Salvar Notas</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}