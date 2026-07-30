
'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Files, Search, Loader2, Filter, 
  CheckCircle2, Clock, MapPin, 
  ArrowRight, FileText, ScanBarcode, Ship, Truck, User
} from "lucide-react";
import { Load, Truck as TruckType, Driver } from "@/app/lib/types";
import { cn } from "@/lib/utils";

export default function RemitosDashboardPage() {
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    // Simplificamos la consulta para no requerir índices compuestos manuales
    return query(
      collection(db, "loads"), 
      orderBy("createdAt", "desc")
    );
  }, [db]);

  const trucksQuery = useMemo(() => db ? collection(db, "trucks") : null, [db]);
  const driversQuery = useMemo(() => db ? collection(db, "drivers") : null, [db]);

  const { data: loads, loading } = useCollection<Load>(loadsQuery);
  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    
    // Estados que requieren auditoría de remitos
    const validStatuses = ["on_route", "delivered", "incident", "assigned"];

    return loads.filter(l => {
      // 1. Filtro por estado operativo (Filtro base)
      if (!validStatuses.includes(l.status)) return false;

      // 2. Filtro por búsqueda de texto
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (l.orderNumber || "").toLowerCase().includes(search) ||
        (l.clientName || "").toLowerCase().includes(search);
      
      if (!matchesSearch) return false;

      // 3. Filtro de auditoría (Pendientes vs Completos)
      const totalStops = (l.outboundStops?.length || 0);
      const docsCount = l.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0;
      const isComplete = docsCount >= totalStops && totalStops > 0;

      if (filter === 'pending') return !isComplete;
      if (filter === 'completed') return isComplete;
      
      return true;
    });
  }, [loads, searchTerm, filter]);

  if (!mounted) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Gestión de Remitos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Centro de auditoría y digitalización de documentos de carga.</p>
        </div>
        <div className="flex gap-2">
           <button 
            className={cn(
              "px-4 h-9 rounded-xl text-[9px] font-black uppercase transition-all border",
              filter === 'all' ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
            )}
            onClick={() => setFilter('all')}
           >
             Todos
           </button>
           <button 
            className={cn(
              "px-4 h-9 rounded-xl text-[9px] font-black uppercase transition-all border",
              filter === 'pending' ? "bg-orange-600 text-white border-orange-600 shadow-md" : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50"
            )}
            onClick={() => setFilter('pending')}
           >
             Pendientes
           </button>
           <button 
            className={cn(
              "px-4 h-9 rounded-xl text-[9px] font-black uppercase transition-all border",
              filter === 'completed' ? "bg-green-600 text-white border-green-600 shadow-md" : "bg-white text-green-600 border-green-200 hover:bg-green-50"
            )}
            onClick={() => setFilter('completed')}
           >
             Completos
           </button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-50/50 border-b">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por flete o cliente..." 
              className="bg-white pl-12 h-12 text-sm font-bold border-none shadow-inner rounded-2xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">Orden / Operación</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Transporte y Personal</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Progreso de Digitalización</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">No hay documentos pendientes de auditoría.</TableCell></TableRow>
                ) : (
                  filteredLoads.map((load) => {
                    const totalStops = load.outboundStops?.length || 0;
                    const docsCount = load.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0;
                    const progress = totalStops > 0 ? (docsCount / totalStops) * 100 : 0;
                    
                    const truck = trucks?.find(t => t.id === load.assignedTruckId);
                    const driver = drivers?.find(d => d.id === load.assignedDriverId);

                    return (
                      <TableRow key={load.id} className="hover:bg-slate-50/50 transition-all group">
                        <TableCell className="px-8 py-6">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                 <FileText size={24} />
                              </div>
                              <div>
                                 <p className="text-sm font-black text-slate-900 tracking-tighter uppercase italic">{load.orderNumber}</p>
                                 <p className="text-[10px] text-slate-400 font-black uppercase truncate max-w-[180px]">{load.clientName}</p>
                                 {load.international?.containerNumber && (
                                   <Badge variant="outline" className="mt-1 bg-white text-[7px] font-mono border-slate-200">
                                      <ScanBarcode size={8} className="mr-1" /> {load.international.containerNumber}
                                   </Badge>
                                 )}
                              </div>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700 uppercase">
                                 <Truck size={12} className="text-blue-500" /> {truck?.plate || 'S/D'}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                 <User size={12} /> {driver ? `${driver.lastName}, ${driver.firstName[0]}.` : 'S/D'}
                              </div>
                           </div>
                        </TableCell>
                        <TableCell>
                           <div className="w-full max-w-[200px] space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-black uppercase">
                                 <span className={cn(progress === 100 ? "text-green-600" : "text-indigo-600")}>
                                    {progress === 100 ? <CheckCircle2 size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
                                    {docsCount} de {totalStops} remitos
                                 </span>
                                 <span className="text-slate-400">{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progress} className="h-1.5 bg-slate-100" />
                           </div>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                           <Button 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase rounded-xl h-10 px-6 shadow-lg shadow-indigo-100"
                            onClick={() => router.push(`/cargas/${load.id}/documentos`)}
                           >
                              Digitalizar <ArrowRight size={14} className="ml-2" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem] flex items-start gap-4 mx-1 shadow-sm">
         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
            <Ship size={24} />
         </div>
         <div className="space-y-1">
            <p className="text-xs font-black text-indigo-800 uppercase tracking-tight italic">Protocolo de Digitalización Certificada</p>
            <p className="text-[10px] text-indigo-600 leading-relaxed font-medium">
               Esta pantalla centraliza la auditoría de remitos de toda la flota activa. Los documentos cargados aquí por los choferes o administrativos son validados automáticamente para la liquidación final del transporte y el cumplimiento de las normativas de aduana y COT.
            </p>
         </div>
      </div>
    </div>
  );
}
