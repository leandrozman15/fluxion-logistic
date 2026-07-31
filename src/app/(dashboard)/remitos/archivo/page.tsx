
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, where } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Files, Search, Loader2, ArrowLeft, 
  CheckCircle2, MapPin, 
  FileText, Receipt, Archive, ShoppingBag, Eye
} from "lucide-react";
import { PendingRemito } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { formatSafeDate } from "@/lib/utils/date-utils";

export default function RemitosArchivePage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");

  const remitosQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "pending_remitos"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: allRemitos, loading } = useCollection<PendingRemito>(remitosQuery);

  const archivedRemitos = useMemo(() => {
    if (!allRemitos) return [];
    return allRemitos.filter(r => 
      r.status === 'archived' && (
        r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [allRemitos, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Archivo de Remitos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Historial de entregas finalizadas, auditadas y archivadas manualmente.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-white/30" />
            <Input 
              type="search" 
              placeholder="Buscar en el archivo histórico..." 
              className="bg-white/10 border-white/20 text-white pl-12 h-12 text-sm font-bold rounded-2xl focus:bg-white/20 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
             <Archive className="text-blue-400" />
             <span className="text-sm font-black uppercase italic">{archivedRemitos.length} Documentos Archivados</span>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Remito / Fecha</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Destinatario</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Bultos / Peso</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Estado Final</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedRemitos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">No hay documentos en el archivo.</TableCell></TableRow>
                ) : (
                  archivedRemitos.map((remito) => (
                    <TableRow key={remito.id} className="hover:bg-slate-50/50 transition-all group">
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white border border-slate-700">
                              <Archive size={20} />
                           </div>
                           <div>
                              <p className="font-mono font-black text-slate-900 text-sm">{remito.number}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">ENTREGADO: {formatSafeDate(remito.deliveredAt, "dd/MM/yyyy")}</p>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-slate-800 truncate uppercase">{remito.clientName}</p>
                           <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase mt-1">
                              <MapPin size={10} className="text-blue-500" /> {remito.city}
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <div className="space-y-1">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-black px-3 gap-1">
                               <ShoppingBag size={10} /> {remito.items?.length || 0} ITEMS
                            </Badge>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{remito.weightKg.toLocaleString()} KG</p>
                         </div>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge className="bg-blue-600 text-white border-none text-[8px] font-black uppercase">ARCHIVADO</Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                           {remito.loadId && (
                             <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase gap-2" asChild>
                               <Link href={`/cargas/${remito.loadId}/reporte`}>
                                 <Eye size={14} /> Ver Viaje
                               </Link>
                             </Button>
                           )}
                           {remito.fileUrl && (
                             <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={() => window.open(remito.fileUrl, '_blank')}>
                               <FileText size={18} />
                             </Button>
                           )}
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
