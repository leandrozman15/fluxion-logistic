
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Files, Search, Loader2, Plus, 
  CheckCircle2, Clock, MapPin, 
  ArrowRight, FileText, Scale, Receipt, Trash2, Archive, ShoppingBag, Calendar
} from "lucide-react";
import { PendingRemito } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { formatSafeDate } from "@/lib/utils/date-utils";

export default function RemitosDashboardPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");

  const remitosQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "pending_remitos"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: allRemitos, loading } = useCollection<PendingRemito>(remitosQuery);

  // Filtramos remitos que NO estén entregados para el buzón activo
  const filteredRemitos = useMemo(() => {
    if (!allRemitos) return [];
    return allRemitos.filter(r => 
      r.status !== 'delivered' && (
        r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [allRemitos, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este remito definitivamente?")) return;
    try {
      await deleteDoc(doc(db, "pending_remitos", id));
      toast({ title: "Remito eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const getStatusBadge = (remito: PendingRemito) => {
    if (remito.status === 'dispatched') {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[8px] font-black uppercase flex items-center gap-1">
           <Calendar size={10} /> PROGRAMADO: {remito.dispatchedDate ? formatSafeDate(remito.dispatchedDate, "dd/MM") : 'Hoy'}
        </Badge>
      );
    }
    return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 text-[8px] font-black uppercase animate-pulse">ESPERANDO TRÁFICO</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Buzón de Remitos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Área de Ventas y Administración: Ingrese los documentos para despacho.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="font-black uppercase text-[11px] h-12 px-6 rounded-2xl border-slate-200" asChild>
            <Link href="/remitos/archivo">
              <Archive className="w-4 h-4 mr-2" /> Ver Archivo
            </Link>
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 font-black uppercase text-[11px] h-12 px-6 rounded-2xl" asChild>
            <Link href="/remitos/nuevo">
              <Plus className="w-5 h-5 mr-2" /> Ingresar Nuevo Remito
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-indigo-600 text-white rounded-[2rem]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Remitos en Buzón</p>
              <p className="text-4xl font-black italic">{filteredRemitos.filter(r => r.status === 'pending').length}</p>
            </div>
            <Files size={40} className="text-white/20" />
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md bg-white rounded-[2rem]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ya Programados</p>
              <p className="text-4xl font-black italic text-slate-800">
                {filteredRemitos.filter(r => r.status === 'dispatched').length}
              </p>
            </div>
            <Calendar size={40} className="text-slate-100" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-slate-900 text-white rounded-[2rem]">
          <CardContent className="p-6 flex items-center justify-between">
             <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Acción de Tráfico</p>
                <p className="text-sm font-bold leading-tight">Organice los pendientes en el motor de despacho.</p>
             </div>
             <Button variant="outline" size="icon" className="rounded-full bg-white/10 border-white/20 text-white" asChild><Link href="/despacho"><ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-50/50 border-b flex items-center justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por N° Remito o Cliente..." 
              className="bg-white pl-12 h-12 text-sm font-bold border-none shadow-inner rounded-2xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="bg-white text-[10px] font-black uppercase h-8 px-4 border-slate-200">Buzón Operativo</Badge>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Remito / Fecha</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Destino / Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Bultos / Peso</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Estado de Despacho</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRemitos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">No hay remitos activos en el buzón.</TableCell></TableRow>
                ) : (
                  filteredRemitos.map((remito) => (
                    <TableRow key={remito.id} className="hover:bg-slate-50/50 transition-all group">
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                              <Receipt size={20} />
                           </div>
                           <div>
                              <p className="font-mono font-black text-slate-900 text-sm">{remito.number}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{formatSafeDate(remito.createdAt, "dd/MM/yyyy")}</p>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-slate-800 truncate uppercase">{remito.clientName}</p>
                           <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-1">
                              <MapPin size={10} className="text-blue-500" /> {remito.city}, {remito.province}
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <div className="space-y-1">
                            <Badge className="bg-indigo-50 text-indigo-700 border-none font-black px-3 gap-1">
                               <ShoppingBag size={10} /> {remito.items?.length || 0} ITEMS
                            </Badge>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{remito.weightKg.toLocaleString()} KG TOTAL</p>
                         </div>
                      </TableCell>
                      <TableCell className="text-center">
                         {getStatusBadge(remito)}
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                           {remito.fileUrl && (
                             <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={() => window.open(remito.fileUrl, '_blank')}>
                               <FileText size={18} />
                             </Button>
                           )}
                           <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => handleDelete(remito.id)}>
                             <Trash2 size={18} />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
