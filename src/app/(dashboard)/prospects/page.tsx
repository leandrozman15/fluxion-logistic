'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, where, writeBatch, doc, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Filter, 
  Plus, 
  FileDown, 
  MoreHorizontal, 
  Loader2, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  ChevronDown,
  Building2,
  MapPin
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Prospect, ProspectStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";

export default function ProspectsPage() {
  const { db } = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const prospectsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    let q = query(collection(db, "tenants", tenantId, "prospects"), orderBy("effectiveScore", "desc"));
    
    if (statusFilter !== "all") {
      q = query(collection(db, "tenants", tenantId, "prospects"), where("status", "==", statusFilter), orderBy("effectiveScore", "desc"));
    }
    return q;
  }, [db, tenantId, statusFilter]);

  const { data: prospects, loading } = useCollection<Prospect>(prospectsQuery);

  const filteredProspects = useMemo(() => {
    if (!prospects) return [];
    return prospects.filter(p => 
      p.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cnpj.includes(searchTerm)
    );
  }, [prospects, searchTerm]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProspects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProspects.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkClaim = async () => {
    if (!db || !tenantId || !user || selectedIds.length === 0) return;
    
    setIsBulkProcessing(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const statsRef = doc(db, "tenants", tenantId, "dailyStats", todayStr);

    try {
      await runTransaction(db, async (transaction) => {
        const statsDoc = await transaction.get(statsRef);
        let currentQuota = 0;
        let quotaLimit = 30;

        if (statsDoc.exists()) {
          currentQuota = statsDoc.data().quotaUsed || 0;
          quotaLimit = statsDoc.data().quotaLimit || 30;
        }

        const remainingQuota = quotaLimit - currentQuota;
        const toProcess = selectedIds.slice(0, remainingQuota);

        if (toProcess.length === 0) {
          throw new Error("Quota diária atingida ou selecionados já atingem o limite.");
        }

        toProcess.forEach(id => {
          const pRef = doc(db, "tenants", tenantId, "prospects", id);
          transaction.update(pRef, {
            isClaimedToday: true,
            claimedAt: new Date().toISOString(),
            status: 'contacted',
            updatedAt: new Date().toISOString()
          });
        });

        if (!statsDoc.exists()) {
          transaction.set(statsRef, {
            date: todayStr,
            quotaUsed: toProcess.length,
            quotaLimit: 30,
            emailsSent: 0,
            emailsFailed: 0,
            newProspects: 0,
            radarAvgFinalScore: 0,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(statsRef, {
            quotaUsed: currentQuota + toProcess.length
          });
        }
      });

      toast({ 
        title: "Ativação em massa concluída", 
        description: `${selectedIds.length} prospectos enviados para o Radar de hoje.` 
      });
      setSelectedIds([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na ativação", description: e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkStatusChange = async (newStatus: ProspectStatus) => {
    if (!db || !tenantId || selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    
    try {
      const today = new Date();
      const yearWeek = `${today.getFullYear()}-${Math.ceil((today.getDate() + 6 - today.getDay()) / 7)}`;
      const weeklyStatsRef = doc(db, "tenants", tenantId, "weeklyStats", yearWeek);

      await runTransaction(db, async (transaction) => {
        selectedIds.forEach(id => {
          const pRef = doc(db, "tenants", tenantId, "prospects", id);
          transaction.update(pRef, { 
            status: newStatus,
            updatedAt: new Date().toISOString()
          });
        });

        const field = `statusChangedTo_${newStatus}`;
        const statsDoc = await transaction.get(weeklyStatsRef);
        if (statsDoc.exists()) {
          transaction.update(weeklyStatsRef, { [field]: increment(selectedIds.length) });
        } else {
          transaction.set(weeklyStatsRef, { 
            id: yearWeek, 
            weekId: yearWeek, 
            [field]: selectedIds.length,
            statusChangedTo_contacted: newStatus === 'contacted' ? selectedIds.length : 0,
            statusChangedTo_interested: newStatus === 'interested' ? selectedIds.length : 0,
            statusChangedTo_demo: newStatus === 'demo' ? selectedIds.length : 0,
            statusChangedTo_client: newStatus === 'client' ? selectedIds.length : 0
          });
        }
      });

      toast({ title: "Status atualizado", description: `${selectedIds.length} registros modificados.` });
      setSelectedIds([]);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na operação" });
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
          <p className="text-muted-foreground">Gerencie sua base industrial com filtros e ações em massa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileDown className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90" asChild>
            <Link href="/prospects/new">
               <Plus className="w-4 h-4 mr-2" /> Novo Prospect
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        {/* Filtros y Barra de Acciones */}
        <div className="p-4 bg-muted/20 border-b space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por nome ou CNPJ..."
                  className="pl-8 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
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
          </div>

          {/* Acciones en Masa */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between bg-primary/5 p-2 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3 ml-2">
                <span className="text-sm font-semibold text-primary">{selectedIds.length} selecionados</span>
                <div className="h-4 w-px bg-primary/20"></div>
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 h-8" 
                  onClick={handleBulkClaim}
                  disabled={isBulkProcessing}
                >
                  {isBulkProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                  Ativar para Hoje
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8" disabled={isBulkProcessing}>
                      Mudar Status <ChevronDown className="w-3 h-3 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {['new', 'contacted', 'interested', 'demo', 'client', 'discarded'].map(s => (
                      <DropdownMenuItem key={s} onClick={() => handleBulkStatusChange(s as ProspectStatus)} className="capitalize">
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => setSelectedIds([])}>
                Desmarcar todos
              </Button>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedIds.length === filteredProspects.length && filteredProspects.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Empresa / CNPJ</TableHead>
                <TableHead>Local / Tags</TableHead>
                <TableHead>Score Radar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-10 h-10 opacity-20" />
                      <p>Nenhum prospecto encontrado com esses filtros.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProspects.map((prospect) => (
                  <TableRow key={prospect.id} className={selectedIds.includes(prospect.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(prospect.id)}
                        onCheckedChange={() => toggleSelect(prospect.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link href={`/prospects/${prospect.id}`} className="font-bold hover:underline text-primary">
                          {prospect.companyName}
                        </Link>
                        <span className="text-[10px] font-mono text-muted-foreground">{prospect.cnpj}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1">
                         <div className="text-xs flex items-center gap-1">
                           <MapPin className="w-3 h-3 text-muted-foreground" />
                           {prospect.address?.city || "-"}, {prospect.address?.state || "-"}
                         </div>
                         <div className="flex flex-wrap gap-1">
                           {prospect.industryTags?.slice(0, 2).map(tag => (
                             <Badge key={tag} variant="secondary" className="text-[8px] px-1 py-0">{tag}</Badge>
                           ))}
                           {prospect.industryTags?.length > 2 && <span className="text-[8px] text-muted-foreground">+{prospect.industryTags.length - 2}</span>}
                         </div>
                       </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className={`h-full ${prospect.effectiveScore > 80 ? 'bg-accent' : 'bg-primary'}`} 
                            style={{ width: `${prospect.effectiveScore}%` }}
                          ></div>
                        </div>
                        <Badge className={prospect.effectiveScore > 80 ? 'bg-accent' : 'bg-primary/80'}>
                          {prospect.effectiveScore}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/prospects/${prospect.id}`}>Ver Detalhes</Link>
                          </DropdownMenuItem>
                          {!prospect.isClaimedToday && (
                            <DropdownMenuItem onClick={() => toggleSelect(prospect.id)}>
                              Selecionar para massa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
