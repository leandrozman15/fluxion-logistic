"use client";

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  doc, 
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Clock, Loader2, Database } from "lucide-react";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect } from "@/app/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ImportsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Consulta real do histórico de importações
  const importsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "imports"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
  }, [db, tenantId]);

  const { data: importHistory, loading: historyLoading } = useCollection<any>(importsQuery);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db || !tenantId) return;

    if (!file.name.endsWith('.csv')) {
      toast({ variant: "destructive", title: "Formato inválido", description: "Por favor, selecione um arquivo CSV." });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        // Parsing robusto considerando vírgula ou ponto-e-vírgula
        const lines = text.split("\n").map(line => {
          const delimiter = line.includes(';') ? ';' : ',';
          return line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
        });

        const dataRows = lines.slice(1).filter(row => row.length > 1 && row[0]);
        const total = dataRows.length;

        if (total === 0) {
          throw new Error("O arquivo CSV está vazio ou não possui cabeçalhos.");
        }

        let importedCount = 0;
        let skippedCount = 0;

        // 1. Carregar CNPJs existentes para evitar duplicidade
        const existingCnpjs = new Set<string>();
        const q = query(collection(db, "tenants", tenantId, "prospects"));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => existingCnpjs.add(doc.data().cnpj));

        const batchSize = 20;
        for (let i = 0; i < dataRows.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = dataRows.slice(i, i + batchSize);

          chunk.forEach(row => {
            const companyName = row[0];
            const cnpj = row[1]?.replace(/\D/g, "");
            const industry = row[2];
            const website = row[3];
            const email = row[4];
            const phone = row[5];

            if (!cnpj || cnpj.length < 11 || existingCnpjs.has(cnpj)) {
              skippedCount++;
              return;
            }

            const id = `csv_${cnpj}`;
            const pRef = doc(db, "tenants", tenantId, "prospects", id);
            
            const prospectData: Partial<Prospect> = {
              id,
              tenantId,
              companyName,
              cnpj,
              industryTags: industry ? [industry] : ["Industrial"],
              websiteUrl: website ? (website.startsWith('http') ? website : `https://${website}`) : undefined,
              status: "new",
              source: "csv",
              aiScore: 60, // Score base para importações manuais
              contacts: [{ 
                name: "Contato CSV", 
                role: "N/A", 
                email: email || "", 
                phone: phone || "",
                source: "csv"
              }],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const effectiveScore = calculateEffectiveScore(prospectData);
            
            batch.set(pRef, {
              ...prospectData,
              effectiveScore,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });

            importedCount++;
            existingCnpjs.add(cnpj);
          });

          await batch.commit();
          setProgress(Math.round(((i + chunk.length) / total) * 100));
        }

        // Registrar a importação no histórico real
        await addDoc(collection(db, "tenants", tenantId, "imports"), {
          fileName: file.name,
          totalRows: total,
          importedCount,
          skippedCount,
          createdAt: serverTimestamp(),
          status: "done"
        });

        toast({
          title: "Importação concluída!",
          description: `${importedCount} indústrias adicionadas ao seu pipeline.`,
        });

      } catch (error: any) {
        console.error("Error parsing CSV:", error);
        toast({
          variant: "destructive",
          title: "Falha na importação",
          description: error.message || "Verifique o formato do arquivo CSV.",
        });
      } finally {
        setIsProcessing(false);
        setProgress(0);
        // Reset input
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Importações de Dados</h1>
          <p className="text-muted-foreground">Conecte sua base legada ao motor de inteligência do Radar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit border-accent/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" /> Ingestão de Leads
            </CardTitle>
            <CardDescription className="text-xs">
              Colunas esperadas: Empresa, CNPJ, Industria, Website, Email, Telefone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="border-2 border-dashed border-muted rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-4 hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group relative overflow-hidden">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
              <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-white transition-colors shadow-sm">
                {isProcessing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
              </div>
              <div className="z-10">
                <p className="text-sm font-bold">
                  {isProcessing ? "Processando..." : "Selecionar arquivo CSV"}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">UTF-8 ou ANSI</p>
              </div>
              {isProcessing && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-accent/10">
                  <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              )}
            </label>

            {isProcessing && (
              <div className="space-y-2 py-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-accent">
                  <span>Sincronizando com o Radar...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                <strong>Inteligência Anti-Duplicidade:</strong> O sistema utiliza o CNPJ como chave primária. Empresas que já existem no seu banco serão ignoradas automaticamente para manter a integridade do seu CRM.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Log de Processamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="py-20 flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-xs text-muted-foreground">Carregando histórico real...</p>
              </div>
            ) : !importHistory || importHistory.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-3">
                <FileSpreadsheet className="w-10 h-10 mx-auto opacity-10" />
                <p className="text-sm text-muted-foreground">Nenhuma importação realizada ainda.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase">Data / Hora</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Arquivo</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((item) => (
                    <TableRow key={item.id} className="hover:bg-accent/5 transition-colors">
                      <TableCell className="text-xs font-medium">
                        {item.createdAt?.toDate ? format(item.createdAt.toDate(), "dd/MM/yyyy HH:mm") : "Agora"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
                          {item.fileName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-bold bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> {item.status === 'done' ? 'CONCLUÍDO' : item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-[10px] font-bold">
                          <span className="text-green-600">+{item.importedCount}</span> <span className="text-muted-foreground">novos</span> / <span className="text-orange-600">{item.skippedCount}</span> <span className="text-muted-foreground">ignorados</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
