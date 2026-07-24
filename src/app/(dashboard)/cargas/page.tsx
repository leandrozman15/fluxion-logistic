
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Plus, Search, MapPin, Scale, DollarSign, 
  Loader2, MoreVertical, Trash2, Truck, CheckCircle2, 
  Clock, AlertTriangle, FileText, ExternalLink
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
    return loads.filter(l => 
      (l.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.origin?.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.destination?.city || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [loads, searchTerm]);

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
    if (!db || !confirm("¿Desea eliminar este pedido?")) return;
    try {
      await deleteDoc(doc(db, "loads", id));
      toast({ title: "Pedido eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cargas y Fletes</h1>
          <p className="text-slate-500 text-sm">Gestión de pedidos de transporte y seguimiento de entregas.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={() => router.push('/cargas/nuevo')}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Operación / Flete
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por mercadería, cliente o ciudad..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
            <TabsList className="bg-white border">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="on_route">En Ruta</TabsTrigger>
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
                  <TableHead>Ruta (Origen - Destino)</TableHead>
                  <TableHead>Peso / Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay operaciones registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoads.map((load) => (
                    <TableRow key={load.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <Package size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{load.orderNumber}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold truncate max-w-[150px]">{load.clientName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex flex-col items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                            <div className="w-[1px] h-3 bg-slate-200"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-500 truncate max-w-[150px]">{load.origin?.address || "Origen"}</span>
                            <span className="font-bold truncate max-w-[150px]">{load.destination?.address || "Destino"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                            <Scale size={10} /> {load.weightKg?.toLocaleString()} Kg
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                            <DollarSign size={10} /> {load.totalAmount?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(load.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Gestión de Flete</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => updateDoc(doc(db!, "loads", load.id), { status: 'on_route' })}>
                              <Truck className="w-4 h-4 mr-2" /> Iniciar Tránsito
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateDoc(doc(db!, "loads", load.id), { status: 'delivered' })}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Entrega
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(load.id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar Orden
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
