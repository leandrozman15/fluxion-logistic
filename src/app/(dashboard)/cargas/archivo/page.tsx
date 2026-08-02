
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, where, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Archive, Search, Loader2, ArrowLeft, 
  History, MapPin, Eye, Package, RotateCcw
} from "lucide-react";
import { Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { formatSafeDate } from "@/lib/utils/date-utils";

export default function CargasArchivePage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");

  const loadsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(
      collection(db, "tenants", tenantId, "loads"), 
      where("status", "==", "archived"),
      orderBy("updatedAt", "desc")
    );
  }, [db, tenantId]);

  const { data: archivedLoads, loading } = useCollection<Load>(loadsQuery);

  const filteredLoads = useMemo(() => {
    if (!archivedLoads) return [];
    return archivedLoads.filter(l => 
      (l.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.clientName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [archivedLoads, searchTerm]);

  const handleRestoreLoad = async (id: string) => {
    if (!db || !tenantId) return;
    try {
      await updateDoc(doc(db, "tenants", tenantId, "loads", id), {
        status: 'delivered', // Restaurar a un estado final lógico
        updatedAt: serverTimestamp()
      });
      toast({ title: "Flete Restaurado", description: "La operación volvió al panel activo." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al restaurar" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Archivo de Fletes</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Historial de operaciones finalizadas y auditadas.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-white/30" />
            <Input 
              type="search" 
              placeholder="Buscar por orden o cliente..." 
              className="bg-white/10 border-white/20 text-white pl-12 h-12 text-sm font-bold rounded-2xl focus:bg-white/20 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
             <History className="text-blue-400" />
             <span className="text-sm font-black uppercase italic">{filteredLoads.length} Viajes en Archivo</span>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Orden / Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Itinerario</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Distancia Real</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Estado al Archivar</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">No hay fletes en el archivo.</TableCell></TableRow>
                ) : (
                  filteredLoads.map((load) => (
                    <TableRow key={load.id} className="hover:bg-slate-50/50 transition-all">
                      <TableCell className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                              <Archive size={20} />
                           </div>
                           <div>
                              <p className="font-black text-slate-900 text-sm italic tracking-tighter">{load.orderNumber}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[180px]">{load.clientName}</p>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                          <MapPin size={10} className="text-blue-500" /> {load.origin.city} → {load.outboundStops?.length} Destinos
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-black text-slate-700 italic">
                        {Math.round(load.tracking?.distanceTraveledKm || 0)} KM
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none text-[8px] font-black uppercase">
                            FINALIZADO
                         </Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                           <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" asChild>
                               <Link href={`/cargas/${load.id}/reporte`}>
                                 <Eye size={18} />
                               </Link>
                           </Button>
                           <Button variant="ghost" size="icon" className="h-9 w-9 text-orange-600 hover:bg-orange-50" onClick={() => handleRestoreLoad(load.id)}>
                              <RotateCcw size={18} />
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
