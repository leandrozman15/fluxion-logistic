
'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Files, Search, Loader2, Plus, 
  CheckCircle2, MapPin, Archive, Receipt, MoreVertical, Trash2, Calendar
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { PendingRemito } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { formatSafeDate } from "@/lib/utils/date-utils";
import { deleteRemito, listRemitos, updateRemito } from "@/lib/remitos-api";

export default function RemitosDashboardPage() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [allRemitos, setAllRemitos] = useState<PendingRemito[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setAllRemitos([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const rows = await listRemitos();
        if (active) setAllRemitos(rows);
      } catch (error) {
        if (active) {
          setAllRemitos([]);
          toast({ variant: "destructive", title: "Error al cargar remitos", description: (error as Error).message });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const filteredRemitos = useMemo(() => {
    if (!allRemitos) return [];
    return allRemitos.filter(r => 
      r.status !== 'archived' && (
        r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [allRemitos, searchTerm]);

  const handleArchive = async (id: string) => {
    if (!tenantId) return;
    try {
      await updateRemito(id, { status: 'archived' });
      setAllRemitos((prev) => prev.map((remito) => (remito.id === id ? { ...remito, status: 'archived' } : remito)));
      toast({ title: "Remito Archivado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: (e as Error).message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId || !confirm("¿Eliminar definitivamente?")) return;
    try {
      await deleteRemito(id);
      setAllRemitos((prev) => prev.filter((remito) => remito.id !== id));
      toast({ title: "Remito eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Buzón de Remitos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión administrativa de órdenes de despacho.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-xl font-black uppercase text-[11px] h-12 px-6 rounded-2xl" asChild>
          <Link href="/remitos/nuevo"><Plus className="w-5 h-5 mr-2" /> Nuevo Remito</Link>
        </Button>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-50/50 border-b flex items-center justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="Buscar por N° Remito o Cliente..." 
              className="bg-white pl-12 h-12 text-sm font-bold border-none shadow-inner rounded-2xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="bg-white text-[10px] font-black uppercase h-8 px-4">Buzón Operativo</Badge>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">Documento</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Destinatario</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Peso</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Estado</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRemitos.map((remito) => (
                  <TableRow key={remito.id} className="hover:bg-slate-50 transition-all">
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border shadow-sm"><Receipt size={20} /></div>
                        <div><p className="font-mono font-black text-slate-900 text-sm">{remito.number}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{formatSafeDate(remito.createdAt, "dd/MM/yyyy")}</p></div>
                      </div>
                    </TableCell>
                    <TableCell><p className="text-sm font-black text-slate-800 uppercase">{remito.clientName}</p><p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1"><MapPin size={10} className="text-blue-500" /> {remito.city}</p></TableCell>
                    <TableCell className="text-center font-black text-slate-700">{remito.weightKg} KG</TableCell>
                    <TableCell className="text-center">
                       {remito.status === 'dispatched' ? (
                         <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[8px] font-black uppercase">EN RUTA</Badge>
                       ) : (
                         <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black uppercase animate-pulse">PENDIENTE</Badge>
                       )}
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={18} /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                             <DropdownMenuItem onClick={() => handleArchive(remito.id)}><Archive className="w-4 h-4 mr-2" /> Archivar</DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(remito.id)}><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
