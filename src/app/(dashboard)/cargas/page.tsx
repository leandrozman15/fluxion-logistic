
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Plus, Search, Scale, 
  Loader2, MoreVertical, Trash2, CheckCircle2, 
  Clock, AlertTriangle, FileText, Printer, Wallet, Navigation, Edit
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Load, LoadStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function CargasPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: loads, loading } = useCollection<Load>(loadsQuery);

  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    return loads.filter(l => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (l.orderNumber || "").toLowerCase().includes(search) ||
        (l.outboundStops?.[0]?.name || "").toLowerCase().includes(search);
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loads, searchTerm, statusFilter]);

  const getStatusBadge = (status: LoadStatus) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Pendiente</Badge>;
      case 'assigned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Asignada</Badge>;
      case 'on_route': return <Badge className="bg-blue-600 text-white border-none">En Ruta</Badge>;
      case 'delivered': return <Badge className="bg-green-600 text-white border-none">Entregada</Badge>;
      case 'incident': return <Badge variant="destructive">Incidente</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !id) return;
    
    const ok = window.confirm("¿Está seguro de eliminar esta operación definitivamente? Esta acción no se puede deshacer.");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "loads", id));
      toast({ title: "Operación eliminada con éxito" });
    } catch (e) {
      console.error("Delete error:", e);
      toast({ variant: "destructive", title: "Error al intentar eliminar el flete" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cargas y Fletes</h1>
          <p className="text-slate-500 text-sm">Gestión de pedidos multi-destino y seguimiento.</p>
        </div>
        <Button className="bg-blue-600 shadow-lg shadow-blue-100" onClick={() => router.push('/cargas/nuevo')}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Operación / Flete
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por N° Orden o destino..." 
              className="bg-white pl-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-white border">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="on_route">En Ruta</TabsTrigger>
              <TabsTrigger value="delivered">Entregadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Orden / Carga</TableHead>
                  <TableHead>Itinerario (Puntos)</TableHead>
                  <TableHead>Carga / Docs</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">No hay operaciones registradas.</TableCell></TableRow>
                ) : (
                  filteredLoads.map((load) => {
                    const totalStops = (load.outboundStops?.length || 0) + (load.returnStops?.length || 0);
                    const totalWeight = (load.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0) + (load.returnStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0);
                    const totalDocs = (load.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0) + (load.returnStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0);
                    const firstDest = load.outboundStops?.[0]?.name || "Sin destinos";

                    return (
                      <TableRow key={load.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => router.push(`/cargas/${load.id}/orden`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><Package size={20} /></div>
                            <div>
                              <div className="font-bold text-slate-900">{load.orderNumber}</div>
                              <div className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[120px]">{firstDest}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                             <Navigation size={12} className="text-blue-500" />
                             <span className="font-bold">{totalStops} Puntos</span>
                             {load.isRoundTrip && <Badge className="bg-orange-100 text-orange-700 border-none text-[8px] h-4">IDA + VTA</Badge>}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[200px]">
                            {load.origin?.province} → {load.outboundStops?.[0]?.province} ...
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-600"><Scale size={10} /> {totalWeight.toLocaleString()} Kg</div>
                            <Badge variant="secondary" className="text-[9px] h-4 bg-slate-100"><FileText size={10} className="mr-1" /> {totalDocs} Documentos</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(load.status)}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Gestión de Flete</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/cargas/${load.id}/editar`)}>
                                <Edit className="w-4 h-4 mr-2" /> Editar Flete / Itinerario
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/cargas/${load.id}/orden`)}>
                                <Printer className="w-4 h-4 mr-2" /> Ver Orden (PDF)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/cargas/${load.id}/billetera`)}>
                                <Wallet className="w-4 h-4 mr-2" /> Billetera de Viaje
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:bg-red-50 focus:text-red-600" 
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
