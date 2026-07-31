
'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, where, writeBatch, getDocs, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Plus, Search, Scale, 
  Loader2, MoreVertical, Trash2, CheckCircle2, 
  Clock, AlertTriangle, FileText, Printer, Wallet, Navigation, Edit, Calendar, Truck, User, History,
  BarChart3, Ship, ScanBarcode, Receipt, Files, Download
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Load, LoadStatus, Truck as TruckType, Driver, PendingRemito } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function CargasPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "trucks");
  }, [db]);

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "drivers");
  }, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    return loads.filter(l => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (l.orderNumber || "").toLowerCase().includes(search) ||
        (l.clientName || "").toLowerCase().includes(search) ||
        (l.international?.containerNumber || "").toLowerCase().includes(search);
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loads, searchTerm, statusFilter]);

  const getStatusBadge = (status: LoadStatus) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 uppercase text-[9px] font-black italic">Pendiente</Badge>;
      case 'assigned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[9px] font-black italic">Asignada</Badge>;
      case 'on_route': return <Badge className="bg-blue-600 text-white border-none uppercase text-[9px] font-black italic animate-pulse">En Ruta</Badge>;
      case 'delivered': return <Badge className="bg-green-600 text-white border-none uppercase text-[9px] font-black italic">Entregada</Badge>;
      case 'incident': return <Badge variant="destructive" className="uppercase text-[9px] font-black italic">Incidente</Badge>;
      default: return <Badge variant="secondary" className="uppercase text-[9px] font-black italic">{status}</Badge>;
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !id) return;
    
    const ok = window.confirm("¿Está seguro de eliminar esta operación? Los remitos vinculados volverán a estar pendientes para ser reprogramados.");
    if (!ok) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Buscar remitos asociados a este flete usando el loadId como ancla
      const remitosQuery = query(collection(db, "pending_remitos"), where("loadId", "==", id));
      const remitosSnap = await getDocs(remitosQuery);
      
      remitosSnap.docs.forEach(docSnap => {
        // 2. Devolver remito a estado 'pending' y quitar vinculación
        batch.update(docSnap.ref, {
          status: 'pending',
          loadId: null,
          dispatchedDate: null,
          updatedAt: serverTimestamp()
        });
      });

      // 3. Eliminar el flete
      batch.delete(doc(db, "loads", id));

      await batch.commit();
      toast({ title: "Operación eliminada", description: "Los remitos han sido devueltos al buzón de pendientes." });
    } catch (e) {
      console.error("Delete error:", e);
      toast({ variant: "destructive", title: "Error al eliminar la operación" });
    }
  };

  if (!mounted) return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Cargas y Fletes</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Cargando sistema centralizado...</p>
        </div>
      </div>
      <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Cargas y Fletes</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión de pedidos multi-destino y auditoría COMEX.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 font-black italic uppercase text-[11px] h-12 px-6 rounded-2xl" onClick={() => router.push('/cargas/nuevo')}>
          <Plus className="w-5 h-5 mr-2" /> Nueva Operación / Flete
        </Button>
      </div>

      <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-50/50 border-b flex flex-col lg:flex-row gap-6 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por N° Orden, cliente o contenedor..." 
              className="bg-white pl-10 h-10 text-xs font-bold border-none shadow-inner rounded-xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
            <TabsList className="bg-white border h-10 p-1 rounded-xl shadow-sm">
              <TabsTrigger value="all" className="text-[9px] font-black uppercase px-4 rounded-lg">Todas</TabsTrigger>
              <TabsTrigger value="pending" className="text-[9px] font-black uppercase px-4 rounded-lg">Pendientes</TabsTrigger>
              <TabsTrigger value="on_route" className="text-[9px] font-black uppercase px-4 rounded-lg">En Ruta</TabsTrigger>
              <TabsTrigger value="delivered" className="text-[9px] font-black uppercase px-4 rounded-lg">Entregadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CardContent className="p-0">
          {loadsLoading ? (
            <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">N° Orden / Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Itinerario y Recursos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Remitos / Docs</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">No hay operaciones registradas en este período.</TableCell></TableRow>
                ) : (
                  filteredLoads.map((load) => {
                    const totalStops = (load.outboundStops?.length || 0) + (load.returnStops?.length || 0);
                    const totalDocs = (load.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0) + (load.returnStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0);
                    
                    const truckObj = trucks?.find(t => t.id === load.assignedTruckId);
                    const driverObj = drivers?.find(d => d.id === load.assignedDriverId);

                    return (
                      <TableRow key={load.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => router.push(`/cargas/${load.id}/reporte`)}>
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 shrink-0 shadow-sm border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
                               {load.serviceType === 'customs' ? <Ship size={24}/> : <Package size={24} />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-black text-slate-900 tracking-tighter text-sm uppercase italic leading-none">{load.orderNumber}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-black truncate max-w-[150px] mt-1">{load.clientName}</div>
                              <div className="flex items-center gap-2 text-[9px] text-blue-600 font-black mt-1 uppercase">
                                <Calendar size={10} /> {load.pickupDate ? format(parseISO(load.pickupDate), "dd/MM") : '-'} • {load.pickupTime}hs
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-800">
                               <Navigation size={12} className="text-blue-500" />
                               <span>{totalStops} Puntos</span>
                               {load.isRoundTrip && <Badge className="bg-orange-100 text-orange-700 border-none text-[7px] h-3 px-1 font-black">IDA + VTA</Badge>}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase">
                                <Truck size={10} className="text-slate-300" /> {truckObj?.plate || 'SIN UNIDAD'}
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase">
                                <User size={10} className="text-slate-300" /> {driverObj ? `${driverObj.lastName}, ${driverObj.firstName}` : 'SIN CHOFER'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={cn(
                                "h-10 px-3 rounded-xl border-dashed border-2 transition-all font-black text-[10px] uppercase",
                                totalDocs > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-slate-200 text-slate-400 hover:bg-slate-50"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/cargas/${load.id}/documentos`);
                              }}
                            >
                              <Files size={14} className="mr-2" /> {totalDocs} DOCS
                            </Button>
                            {load.international?.containerNumber && (
                              <Badge variant="secondary" className="bg-blue-900 text-white border-none font-mono text-[8px] h-4 gap-1.5 px-2">
                                <ScanBarcode size={10} /> {load.international.containerNumber}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(load.status)}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100 transition-all"><MoreVertical size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl shadow-2xl border-none">
                              <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-2">Análisis de Operación</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/cargas/${load.id}/reporte`)} className="font-black text-blue-600 h-10 rounded-xl">
                                <BarChart3 className="w-4 h-4 mr-2" /> Auditoría de Telemetría
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/cargas/${load.id}/documentos`)} className="font-black text-indigo-600 bg-indigo-50 h-10 rounded-xl my-1">
                                <Files className="w-4 h-4 mr-2" /> Gestión de Remitos
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-2">Documentación PDF (Texto Real)</DropdownMenuLabel>
                              
                              <DropdownMenuItem 
                                onClick={() => router.push(`/cargas/${load.id}/orden?print=true`)} 
                                className="font-black text-blue-700 bg-blue-50 h-12 rounded-xl mb-1"
                              >
                                <Download className="w-5 h-5 mr-3" /> Descargar Hoja de Ruta
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem 
                                onClick={() => router.push(`/cargas/${load.id}/billetera?print=true`)} 
                                className="font-black text-green-700 bg-green-50 h-12 rounded-xl mb-1"
                              >
                                <Download className="w-5 h-5 mr-3" /> Descargar Rendición
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-2">Gestión Administrativa</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/cargas/${load.id}/editar`)} className="font-bold h-10 rounded-xl">
                                <Edit className="w-4 h-4 mr-2" /> Editar Flete
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem 
                                className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-10 rounded-xl" 
                                onSelect={() => handleDelete(load.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Flete Definitivo
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    </div>
  );
}

