'use client';

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Plus, Edit, Trash2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { deleteTemplate, listTemplates } from "@/lib/templates-api";

type TemplateItem = {
  id: string;
  name: string;
  subject: string;
  body: string;
  variablesUsed?: string[];
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        if (active) setLoading(true);
        const rows = await listTemplates();
        if (!active) return;
        setTemplates(rows);
      } catch (error) {
        if (!active) return;
        setTemplates([]);
        toast({ variant: "destructive", title: "Erro ao carregar templates", description: (error as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [toast]);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((row) => row.id !== id));
      toast({ title: "Template removido" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: (error as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Templates de Email</h1>
          <p className="text-muted-foreground">Crie modelos personalizados para sua prospecção industrial.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90" asChild>
          <Link href="/templates/new">
            <Plus className="w-4 h-4 mr-2" /> Novo Template
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.length === 0 ? (
            <div className="col-span-2 py-20 text-center bg-card border rounded-lg">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground">Você ainda não tem templates salvos.</p>
              <Button variant="link" asChild><Link href="/templates/new">Criar meu primeiro modelo</Link></Button>
            </div>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-xs truncate max-w-[200px]">
                      {template.subject}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <Link href={`/templates/${template.id}`}><Edit className="w-4 h-4" /></Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-secondary/50 rounded text-sm text-muted-foreground line-clamp-3 font-mono italic h-20 overflow-hidden">
                    {template.body}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {template.variablesUsed?.map((variable) => (
                      <span key={variable} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{"{{" + variable + "}}"}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
