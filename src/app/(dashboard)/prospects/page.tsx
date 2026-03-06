
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, writeBatch, doc, serverTimestamp, runTransaction, increment, limit, setDoc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, Filter, Plus, FileDown, MoreHorizontal, Loader2, 
  Sparkles, ChevronDown, Building2, MapPin, Activity, UserPlus
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Prospect, ProspectStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { calculateEffectiveScore } from "@/lib/utils/scoring";

export default function ProspectsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  // Manual Form State
  const [manualForm, setManualForm] = useState({ name: "", cnpj: "", industry: "", city: "", state: "" });

  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "prospects"), orderBy("effectiveScore", "desc"), limit(200));
  }, [db, tenantId]);

  const { data: prospects, loading } = useCollection<Prospect>(prospectsQuery);

  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    return prospects.filter(p => {
      const matchSearch = p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || p.cnpj.includes(searchTerm);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [prospects, searchTerm, statusFilter]);

  const handleAddManual = async () => {
    if (!db || !tenantId || !manualForm.name) return;
    setIsBulkProcessing(true);
    try {
      const id = `manual_${Date.now()}`;
      const newProspect: Partial<Prospect> = {
        id,
        tenantId,
        companyName: manualForm.name,
        cnpj: manualForm.cnpj.replace(/\D/g, ""),
        industryTags: [manualForm.industry || "Geral"],
        address: { city: manualForm.city, state: manualForm.state, country: "Brasil" },
        status: "new",
        source: "manual",
        contacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiScore: 50,
      };

      const score = calculateEffectiveScore(newProspect);
      await setDoc(doc(db, "tenants", tenantId, "prospects", id), { ...newProspect, effectiveScore: score });
      
      toast({ title: "Prospect cadastrado!" });
      setIsManualOpen(false);
      setManualForm({ name: "", cnpj: "", industry: "", city: "", state: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao cadastrar" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

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
          <p className="text-muted-foreground">Gerencie sua base industrial. Adicione manualmente ou via Discovery.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" /> Cadastro Manual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Prospecto Manual</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2 text-sm">
                <div className="space-y-2">
                  <Label>Nome da Empresa</Label>
                  <Input value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} placeholder="Razão Social ou Nome Fantasia" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={manualForm.cnpj} onChange={e => setManualForm({...manualForm, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Setor Principal</Label>
                    <Input value={manualForm.industry} onChange={e => setManualForm({...manualForm, industry: e.target.value})} placeholder="Ex: Metalurgia" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={manualForm.city} onChange={e => setManualForm({...manualForm, city: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input value={manualForm.state} onChange={e => setManualForm({...manualForm, state: e.target.value})} maxLength={2} placeholder="Ex: SP" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddManual} disabled={isBulkProcessing || !manualForm.name}>Cadastrar Empresa</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button size="sm" className="bg-accent hover:bg-accent/90" asChild>
            <Link href="/discovery"><Search className="w-4 h-4 mr-2" /> Buscar no Radar Nacional</Link>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 bg-muted/20 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Buscar por nome ou CNPJ..." className="pl-8 bg-background" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-background"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="new">Novos</SelectItem>
              <SelectItem value="contacted">Contactados</SelectItem>
              <SelectItem value="interested">Interessados</SelectItem>
              <SelectItem value="demo">Demo Agendada</SelectItem>
              <SelectItem value="client">Clientes</SelectItem>
              <SelectItem value="discarded">Descartados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {loading ? (
          <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa / CNPJ</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.map((prospect) => (
                <TableRow key={prospect.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => window.location.href = `/prospects/${prospect.id}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">{prospect.companyName}</span>
                      <span className="text-[10px] text-muted-foreground">{prospect.cnpj}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <MapPin className="w-3 h-3 inline mr-1" /> {prospect.address?.city}, {prospect.address?.state}
                  </TableCell>
                  <TableCell><Badge className="bg-accent">{prospect.effectiveScore}</Badge></TableCell>
                  <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/prospects/${prospect.id}`}>Ver Detalhes</Link></DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
