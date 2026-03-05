import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Plus, FileDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";

export default function ProspectsPage() {
  const prospects = [
    { id: "1", name: "Indústrias Matarazzo", cnpj: "12.345.678/0001-90", state: "SP", score: 85, status: "interested", lastContact: "20/05/2024" },
    { id: "2", name: "Logística Expressa", cnpj: "23.456.789/0001-01", state: "PR", score: 62, status: "contacted", lastContact: "19/05/2024" },
    { id: "3", name: "Alimentos Doce Vida", cnpj: "34.567.890/0001-12", state: "RS", score: 91, status: "demo", lastContact: "21/05/2024" },
    { id: "4", name: "Tech Soluções", cnpj: "45.678.901/0001-23", state: "MG", score: 44, status: "new", lastContact: "-" },
    { id: "5", name: "Metalúrgica Gerdau", cnpj: "56.789.012/0001-34", state: "SC", score: 78, status: "contacted", lastContact: "18/05/2024" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new': return <Badge variant="secondary">Novo</Badge>;
      case 'contacted': return <Badge variant="outline">Contactado</Badge>;
      case 'interested': return <Badge variant="default" className="bg-blue-600">Interessado</Badge>;
      case 'demo': return <Badge variant="default" className="bg-purple-600">Demo</Badge>;
      case 'client': return <Badge variant="default" className="bg-green-600">Cliente</Badge>;
      case 'discarded': return <Badge variant="destructive">Descartado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Prospects</h1>
          <p className="text-muted-foreground">Gerencie sua lista de empresas e contatos industriais.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileDown className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" /> Novo Prospect
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome ou CNPJ..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" /> Filtros
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Contato</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prospects.map((prospect) => (
              <TableRow key={prospect.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <Link href={`/prospects/${prospect.id}`} className="font-semibold hover:underline text-primary">
                      {prospect.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{prospect.cnpj}</span>
                  </div>
                </TableCell>
                <TableCell>{prospect.state}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${prospect.score > 80 ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${prospect.score}%` }}></div>
                    </div>
                    <span className="text-xs font-medium">{prospect.score}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                <TableCell className="text-sm">{prospect.lastContact}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}