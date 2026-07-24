
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Plus, Search, MapPin, Scale, DollarSign, 
  Loader2, MoreVertical, Trash2, Truck, CheckCircle2, 
  Clock, AlertTriangle, FileText, ExternalLink, Printer, Wallet
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
import Link from "next/link";

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
      const matchesSearch = (l.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.clientName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.origin?.address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.destination?.address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
      
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

  const handleDelete = (id: string | undefined) => {
    if (!id) {
      toast({ variant: "destructive", title: "Error", description: "ID de carga no válido." });
      return;
    }
    
    if (!db || !confirm("¿Está seguro de eliminar esta operación? Esta acción no se puede deshacer.")) return;
    
    const docRef = doc(db, "loads", id);
    
    // No usamos await para permitir actualización optimista en la UI
    deleteDoc(docRef).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
    
    toast({ title: "Pedido eliminado correctamente" });
  };

  const handleUpdateStatus = (id: string | undefined, newStatus: LoadStatus) => {
    if (!id || !db) return;
    
    const docRef = doc(db, "loads", id);
    
    updateDoc(docRef, { 
      status: newStatus,
      updatedAt: new Date().toISOString()
    }).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus },
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });

    toast({ title: `Estado actualizado: ${newStatus.replace('_', ' ')}` });
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
            <input 
              type="search" 
              placeholder="Buscar por N° Orden, cliente o ciudad..." 
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
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
                      No hay operaciones que coincidan con los filtros.
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
                            <span className="text-slate-500 truncate max-w-[200px]">{load.origin?.address || "Origen"}</span>
                            <span className="font-bold truncate max-w-[200px]">{load.destination?.address || "Destino"}</span>
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
                            <DropdownMenuItem onSelect={() => router.push(`/cargas/${load.id}/orden`)}>
                              <Printer className="w-4 h-4 mr-2" /> Generar Orden (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(`/cargas/${load.id}/billetera`)}>
                              <Wallet className="w-4 h-4 mr-2" /> Ver Billetera / Gastos
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => handleUpdateStatus(load.id, 'on_route')}>
                              <Truck className="w-4 h-4 mr-2" /> Iniciar Tránsito
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleUpdateStatus(load.id, 'delivered')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar Entrega
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onSelect={() => handleDelete(load.id)}>
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
