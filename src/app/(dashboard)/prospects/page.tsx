'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, where } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Plus, FileDown, MoreHorizontal, Loader2 } from "lucide-react";
import Link from "next/link";
import { Prospect } from "@/app/lib/types";

export default function ProspectsPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");

  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "prospects"),
      orderBy("effectiveScore", "desc")
    );
  }, [db, tenantId]);

  const { data: prospects, loading } = useCollection<Prospect>(prospectsQuery);

  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    return prospects.filter(p => 
      p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cnpj.includes(searchTerm)
    );
  }, [prospects, searchTerm]);

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
              placeholder="Buscar por nome o CNPJ..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" /> Filtros
            </Button>
          </div>
        </div>
        
        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
              {filteredProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum prospecto encontrado. Importe um CSV para começar.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProspects.map((prospect) => (
                  <TableRow key={prospect.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/prospects/${prospect.id}`} className="font-semibold hover:underline text-primary">
                          {prospect.companyName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{prospect.cnpj}</span>
                      </div>
                    </TableCell>
                    <TableCell>{prospect.address?.state || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${prospect.effectiveScore > 80 ? 'bg-accent' : 'bg-primary'}`} 
                            style={{ width: `${prospect.effectiveScore}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium">{prospect.effectiveScore}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                    <TableCell className="text-sm">
                      {prospect.lastContactAt ? new Date(prospect.lastContactAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
