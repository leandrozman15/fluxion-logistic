import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export default function ImportsPage() {
  const imports = [
    { id: "1", date: "20/05/2024", file: "prospects_sul_maio.csv", status: "done", total: 150, imported: 148, skipped: 2 },
    { id: "2", date: "18/05/2024", file: "leads_automotivo_v2.csv", status: "done", total: 300, imported: 295, skipped: 5 },
    { id: "3", date: "21/05/2024", file: "new_contacts_test.csv", status: "processing", total: 50, imported: 12, skipped: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Importações CSV</h1>
          <p className="text-muted-foreground">Carregue listas de empresas e contatos em massa.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Nova Importação</CardTitle>
            <CardDescription>Formatos aceitos: .csv (UTF-8)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-4 hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-primary">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">Clique para selecionar</p>
                <p className="text-xs text-muted-foreground">ou arraste seu arquivo aqui</p>
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-700">Certifique-se de que as colunas CNPJ e Nome da Empresa estão presentes para evitar duplicidades.</p>
            </div>
            <Button className="w-full bg-accent hover:bg-accent/90">Iniciar Processamento</Button>
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
                {imports.map((item) => (
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
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluído</Badge>
                      ) : (
                        <Badge variant="outline" className="animate-pulse"><Clock className="w-3 h-3 mr-1" /> Processando</Badge>
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