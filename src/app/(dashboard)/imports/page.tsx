
"use client";

import { useState, useCallback } from "react";
import { useFirestore } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { calculateEffectiveScore } from "@/lib/utils/scoring";
import { Prospect } from "@/app/lib/types";

export default function ImportsPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importHistory, setImportHistory] = useState([
    { id: "1", date: "20/05/2024", file: "prospects_sul_maio.csv", status: "done", total: 150, imported: 148, skipped: 2 },
  ]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db || !tenantId) return;

    setIsProcessing(true);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").map(line => line.split(",").map(cell => cell.trim()));
        const headers = lines[0];
        const dataRows = lines.slice(1).filter(row => row.length > 1);

        // Mapeo simple de columnas (Asumiendo orden: Empresa, CNPJ, Industria, Web, Email, Tel)
        // En una versión final, permitiríamos al usuario mapear columnas manualmente.
        let importedCount = 0;
        let skippedCount = 0;
        const total = dataRows.length;

        // Obtener CNPJs existentes para evitar duplicados en este batch
        const existingCnpjs = new Set<string>();
        const q = query(collection(db, "tenants", tenantId, "prospects"));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => existingCnpjs.add(doc.data().cnpj));

        const batch = writeBatch(db);
        
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const companyName = row[0];
          const cnpj = row[1]?.replace(/\D/g, "");
          const industry = row[2];
          const website = row[3];
          const email = row[4];
          const phone = row[5];

          if (!cnpj || existingCnpjs.has(cnpj)) {
            skippedCount++;
            continue;
          }

          const prospectData: Partial<Prospect> = {
            tenantId,
            companyName,
            cnpj,
            industryTags: industry ? [industry] : [],
            websiteUrl: website,
            domain: website?.split("//")[1]?.split("/")[0] || "",
            status: "new",
            aiScore: 50, // Default base score
            contacts: [{ name: "Contato Principal", role: "N/A", email, phone }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const effectiveScore = calculateEffectiveScore(prospectData);
          prospectData.effectiveScore = effectiveScore;

          const newDocRef = doc(collection(db, "tenants", tenantId, "prospects"));
          batch.set(newDocRef, {
            ...prospectData,
            effectiveScore,
            source: "csv",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          importedCount++;
          existingCnpjs.add(cnpj); // Evitar duplicados dentro del mismo CSV

          if (importedCount % 20 === 0) {
            setProgress(Math.round(((i + 1) / total) * 100));
          }
        }

        await batch.commit();

        // Registrar la importación
        await addDoc(collection(db, "tenants", tenantId, "imports"), {
          fileName: file.name,
          totalRows: total,
          importedCount,
          skippedCount,
          createdAt: serverTimestamp(),
          status: "done"
        });

        toast({
          title: "Importação concluída",
          description: `${importedCount} empresas adicionadas. ${skippedCount} duplicadas ou inválidas ignoradas.`,
        });

        // Actualizar UI local (sería mejor un hook useCollection para esto)
        setImportHistory(prev => [
          { 
            id: Date.now().toString(), 
            date: new Date().toLocaleDateString(), 
            file: file.name, 
            status: "done", 
            total, 
            imported: importedCount, 
            skipped: skippedCount 
          },
          ...prev
        ]);

      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast({
          variant: "destructive",
          title: "Erro no processamento",
          description: "Verifique o formato do arquivo CSV.",
        });
      } finally {
        setIsProcessing(false);
        setProgress(0);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Importações CSV</h1>
          <p className="text-muted-foreground">Carregue listas de empresas e contatos em massa para o radar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Nova Importação</CardTitle>
            <CardDescription>O CSV deve conter: Empresa, CNPJ, Industria, Website, Email, Telefone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="border-2 border-dashed border-muted rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer group">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-white transition-colors">
                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {isProcessing ? "Processando arquivo..." : "Clique para selecionar CSV"}
                </p>
                <p className="text-xs text-muted-foreground">ou arraste seu arquivo aqui</p>
              </div>
            </label>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Enviando para o banco...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-700">
                O sistema utiliza o CNPJ como chave única. Empresas já cadastradas no seu tenant serão ignoradas automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de Importações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                        {item.file}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === 'done' ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Concluído
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="animate-pulse">
                          <Clock className="w-3 h-3 mr-1" /> Processando
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="font-bold text-primary">{item.imported}</span> importados / <span className="text-destructive">{item.skipped}</span> ignorados
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
