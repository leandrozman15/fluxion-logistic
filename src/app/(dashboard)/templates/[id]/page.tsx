'use client';

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { renderTemplate, extractVariables, PERMITTED_VARIABLES } from "@/lib/utils/template-renderer";
import { Loader2, ArrowLeft, Save, Eye, Info, Image as ImageIcon, Bold, Type } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTemplate, getTemplate, updateTemplate } from "@/lib/templates-api";
import { getProspectById } from "@/lib/prospects-api";

type ProspectPreview = {
  id: string;
  companyName?: string;
  cnpj?: string;
  websiteUrl?: string;
  domain?: string;
  address?: {
    city?: string;
    state?: string;
  };
  contacts?: Array<{
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
  }>;
};

export default function TemplateEditorPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const isNew = !id || id === "new";

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [prospects, setProspects] = useState<ProspectPreview[]>([]);

  useEffect(() => {
    let active = true;

    async function loadTemplate() {
      if (isNew) return;
      try {
        if (active) setLoading(true);
        const template = await getTemplate(id);
        if (!active) return;
        setName(template.name || "");
        setSubject(template.subject || "");
        setBody(template.body || "");
      } catch (error) {
        if (!active) return;
        toast({ variant: "destructive", title: "Erro ao carregar template", description: (error as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTemplate();
    return () => {
      active = false;
    };
  }, [id, isNew, toast]);

  useEffect(() => {
    let active = true;

    async function loadPreviewProspects() {
      try {
        const ids = ["preview-a", "preview-b", "preview-c", "preview-d", "preview-e"];
        const previews: ProspectPreview[] = [];

        for (const candidate of ids) {
          try {
            const prospect = await getProspectById(candidate);
            previews.push({
              id: prospect.id,
              companyName: (prospect as any).companyName,
              cnpj: (prospect as any).cnpj,
              websiteUrl: (prospect as any).websiteUrl,
              domain: (prospect as any).domain,
              address: (prospect as any).address,
              contacts: (prospect as any).contacts,
            });
          } catch {
            // Ignore preview candidates not found
          }
        }

        if (!active) return;

        const fallback: ProspectPreview[] = previews.length > 0
          ? previews
          : [{
              id: "preview-fallback",
              companyName: "Empresa Exemplo",
              cnpj: "00.000.000/0000-00",
              websiteUrl: "https://example.com",
              domain: "example.com",
              address: { city: "São Paulo", state: "SP" },
              contacts: [{ name: "Contato", role: "Compras", email: "contato@example.com", phone: "+55 11 99999-9999" }],
            }];

        setProspects(fallback);
        if (!selectedProspectId) {
          setSelectedProspectId(fallback[0].id);
        }
      } catch {
        if (!active) return;
        setProspects([]);
      }
    }

    loadPreviewProspects();
    return () => {
      active = false;
    };
  }, [selectedProspectId]);

  const selectedProspect = prospects.find((prospect) => prospect.id === selectedProspectId) || prospects[0] || null;

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Por favor, preencha o nome, assunto e corpo do e-mail." });
      return;
    }

    setIsSaving(true);

    try {
      if (isNew) {
        await createTemplate({
          name: name.trim(),
          subject: subject.trim(),
          body: body.trim(),
          variablesUsed: extractVariables(subject + " " + body),
        });
      } else {
        await updateTemplate(id, {
          name: name.trim(),
          subject: subject.trim(),
          body: body.trim(),
          variablesUsed: extractVariables(subject + " " + body),
        });
      }

      toast({ title: "Template salvo!", description: "As alterações foram registradas com sucesso." });

      if (isNew) {
        router.push("/templates");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const insertHtml = (html: string) => {
    setBody((prev) => prev + html);
  };

  const insertImage = () => {
    const url = prompt("Insira a URL da imagem (hospedada em Firebase Storage ou CDN):", "https://picsum.photos/seed/industrial/600/200");
    if (url) {
      insertHtml(`<img src="${url}" width="100%" style="max-width: 600px; border-radius: 8px;" alt="Imagem Industrial">`);
    }
  };

  if (loading && !isNew) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderedPreviewBody = selectedProspect ? renderTemplate(body, selectedProspect as any) : body;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/templates"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold text-primary">
            {isNew ? "Novo Template" : "Editar Template"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-accent hover:bg-accent/90">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conteúdo do E-mail</CardTitle>
                <CardDescription>Suporte a HTML e imagens hospedadas.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => insertHtml("<b></b>")} title="Negrito">
                  <Bold className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => insertHtml("<br>")} title="Quebra de Linha">
                  <Type className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={insertImage} title="Inserir Imagem">
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template (Interno)</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Primeiro Contato Industrial" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto do E-mail</Label>
                <Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Olá {{contactName}}, solução para {{companyName}}" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Corpo do E-mail (HTML permitido)</Label>
                <Textarea
                  id="body"
                  className="min-h-[350px] font-mono text-sm leading-relaxed"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Olá {{contactName}}, <br><br> Veja nossa nova solução..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4" /> Variáveis Dinâmicas
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {PERMITTED_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  className="text-[10px] bg-card border px-2 py-1 rounded hover:bg-accent hover:text-white transition-colors"
                  onClick={() => insertHtml(`{{${variable}}}`)}
                >
                  {"{{" + variable + "}}"}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-5 h-5 text-accent" /> Preview Real
                </CardTitle>
                <Select value={selectedProspectId} onValueChange={setSelectedProspectId}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Escolha um prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    {prospects.map((prospect) => (
                      <SelectItem key={prospect.id} value={prospect.id}>{prospect.companyName || prospect.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-6 bg-white border rounded-xl shadow-inner min-h-[400px]">
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Assunto</div>
                  <div className="text-sm font-semibold text-primary border-b pb-2">
                    {selectedProspect ? renderTemplate(subject, selectedProspect as any) : subject || "..."}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Mensagem (HTML Renderizado)</div>
                  <div
                    className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700"
                    dangerouslySetInnerHTML={{ __html: renderedPreviewBody || "<i>Corpo vazio...</i>" }}
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-[11px] text-amber-700">
                  <strong>Dica:</strong> Evite imagens muito pesadas (&gt;200kb) para não cair em filtros de SPAM. Use URLs absolutas (https://...).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
