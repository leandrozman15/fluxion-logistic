"use client";

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
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
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Clock, Loader2, Database, FileCode } from "lucide-react";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect } from "@/app/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';

export default function ImportsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

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

    const isCsv = file.name.endsWith('.csv');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCsv && !isExcel) {
      toast({ variant: "destructive", title: "Formato inválido", description: "Por favor, selecione um arquivo CSV ou Excel (.xlsx, .xls)." });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converte para array de arrays (header: 1)
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Remove o cabeçalho e linhas vazias
      const dataRows = rows.slice(1).filter(row => row.length > 0 && row[0]);
      const total = dataRows.length;

      if (total === 0) {
        throw new Error("O arquivo está vazio ou não possui dados válidos após o cabeçalho.");
      }

      let importedCount = 0;
      let skippedCount = 0;

      // 1. Carregar CNPJs existentes para evitar duplicidade
      const existingCnpjs = new Set<string>();
      const q = query(collection(db, "tenants", tenantId, "prospects"));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.cnpj) existingCnpjs.add(data.cnpj);
      });

      const batchSize = 20;
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = dataRows.slice(i, i + batchSize);

        chunk.forEach(row => {
          const companyName = String(row[0] || '').trim();
          const cnpj = String(row[1] || '').replace(/\D/g, "");
          const industry = String(row[2] || '').trim();
          const website = String(row[3] || '').trim();
          const email = String(row[4] || '').trim();
          const phone = String(row[5] || '').trim();

          if (!companyName || !cnpj || cnpj.length < 11 || existingCnpjs.has(cnpj)) {
            skippedCount++;
            return;
          }

          const id = `imp_${cnpj}`;
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
            aiScore: 60,
            contacts: [{ 
              name: "Contato Importado", 
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

      await addDoc(collection(db, "tenants", tenantId, "imports"), {
        fileName: file.name,
        fileType: isExcel ? 'excel' : 'csv',
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
      console.error("Error parsing file:", error);
      toast({
        variant: "destructive",
        title: "Falha na importação",
        description: error.message || "Verifique o formato do arquivo selecionado.",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Importações de Dados</h1>
          <p className="text-muted-foreground">Conecte sua base Excel ou CSV ao motor de inteligência do Radar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit border-accent/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" /> Ingestão de Leads
            </CardTitle>
            <CardDescription className="text-xs">
              Excel ou CSV com colunas: Empresa, CNPJ, Industria, Website, Email, Telefone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="border-2 border-dashed border-muted rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-4 hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group relative overflow-hidden">
              <input 
                type="file" 
                accept=".csv, .xlsx, .xls" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
              <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-white transition-colors shadow-sm">
                {isProcessing ? <Loader2 className="w-7 h-7 animate-spin" /> : <FileSpreadsheet className="w-7 h-7" />}
              </div>
              <div className="z-10">
                <p className="text-sm font-bold">
                  {isProcessing ? "Lendo Planilha..." : "Selecionar Excel ou CSV"}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">.xlsx, .xls ou .csv</p>
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
                <strong>Inteligência de Formato:</strong> O sistema detecta automaticamente se o arquivo é Excel ou CSV. Certifique-se de que os dados comecem na primeira aba da planilha.
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
                <p className="text-xs text-muted-foreground">Consultando histórico...</p>
              </div>
            ) : !importHistory || importHistory.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl space-y-3">
                <FileCode className="w-10 h-10 mx-auto opacity-10" />
                <p className="text-sm text-muted-foreground">Nenhuma importação realizada ainda.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase">Data / Hora</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Arquivo</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Formato</TableHead>
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
                        <Badge variant="outline" className={`text-[9px] font-bold ${item.fileType === 'excel' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                          {item.fileType?.toUpperCase() || 'CSV'}
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
