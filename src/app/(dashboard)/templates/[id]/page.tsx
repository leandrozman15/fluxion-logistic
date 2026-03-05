
'use client';

import { useState, useMemo, useEffect } from "react";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, setDoc, serverTimestamp, collection, query, limit } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { EmailTemplate, Prospect } from "@/app/lib/types";
import { renderTemplate, extractVariables, PERMITTED_VARIABLES } from "@/lib/utils/template-renderer";
import { Loader2, ArrowLeft, Save, Eye, Info } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TemplateEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const isNew = id === 'new';

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Cargar template si existe
  const templateRef = useMemo(() => {
    if (!db || !tenantId || isNew) return null;
    return doc(db, "tenants", tenantId, "templates", id as string);
  }, [db, tenantId, id, isNew]);

  const { data: template, loading: templateLoading } = useDoc<EmailTemplate>(templateRef);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template]);

  // Cargar prospectos para preview
  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"), limit(5));
  }, [db, tenantId]);

  const { data: prospects } = useCollection<Prospect>(prospectsQuery);
  const selectedProspect = prospects.find(p => p.id === selectedProspectId) || prospects[0];

  useEffect(() => {
    if (prospects.length > 0 && !selectedProspectId) {
      setSelectedProspectId(prospects[0].id);
    }
  }, [prospects, selectedProspectId]);

  const handleSave = async () => {
    if (!db || !tenantId) return;
    if (!name || !subject || !body) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Preencha todos los campos." });
      return;
    }

    setIsSaving(true);
    const templateId = isNew ? doc(collection(db, "tenants", tenantId, "templates")).id : id as string;
    const finalRef = doc(db, "tenants", tenantId, "templates", templateId);

    try {
      await setDoc(finalRef, {
        name,
        subject,
        body,
        tenantId,
        variablesUsed: extractVariables(subject + " " + body),
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : {})
      }, { merge: true });

      toast({ title: "Template salvo com sucesso!" });
      if (isNew) router.push("/templates");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  if (templateLoading && !isNew) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/templates"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold text-primary">
            {isNew ? "Novo Template" : "Editar Template"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-accent">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo do E-mail</CardTitle>
              <CardDescription>Use chaves como {"{{companyName}}"} para inserir dados dinâmicos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template (Interno)</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Primeiro Contato Industrial" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto do E-mail</Label>
                <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Olá {{contactName}}, solução para {{companyName}}" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Corpo do E-mail</Label>
                <Textarea 
                  id="body" 
                  className="min-h-[300px] font-mono" 
                  value={body} 
                  onChange={e => setBody(e.target.value)} 
                  placeholder="Escreva sua mensagem aqui..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4" /> Variáveis Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {PERMITTED_VARIABLES.map(v => (
                <button 
                  key={v} 
                  className="text-[10px] bg-card border px-2 py-1 rounded hover:bg-accent hover:text-white transition-colors"
                  onClick={() => setBody(prev => prev + ` {{${v}}}`)}
                >
                  {"{{" + v + "}}"}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-accent" /> Preview Real
                </CardTitle>
                <Select value={selectedProspectId} onValueChange={setSelectedProspectId}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Escolha um prospect" />
                  </SelectTrigger>
                  <SelectContent>
                    {prospects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Assunto</div>
                  <div className="text-sm font-semibold">
                    {selectedProspect ? renderTemplate(subject, selectedProspect) : subject}
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Mensagem</div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed italic text-muted-foreground">
                    {selectedProspect ? renderTemplate(body, selectedProspect) : body}
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-[11px] text-blue-700">
                  O preview utiliza dados reais do prospect selecionado. Se alguma variable aparecer como "-", é porque o dado não está cadastrado.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
