
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
import { Progress } from "@/components/ui/progress";
import { 
  Truck, Plus, Search, MoreHorizontal, Trash2, Edit2, 
  Gauge, Loader2, FileText, Building2, User
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Truck as TruckType, TruckStatus, Driver } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function FlotaPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "trucks"), orderBy("plate"));
  }, [db]);

  const { data: trucks, loading } = useCollection<TruckType>(trucksQuery);

  const driversQuery = useMemo(() => 
    db ? query(collection(db, "drivers")) : null
  , [db]);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const filteredTrucks = useMemo(() => {
    if (!trucks) return [];
    return trucks.filter(t => {
      const matchesSearch = (t.plate || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (t.brand || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (t.model || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [trucks, searchTerm, statusFilter]);

  const handleDelete = async (id: string, plate: string) => {
    if (!db || !confirm(`¿Desea eliminar definitivamente la unidad ${plate}?`)) return;
    try {
      await deleteDoc(doc(db, "trucks", id));
      toast({ title: "Unidad eliminada", description: "El registro ha sido removido del sistema." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const getStatusBadge = (status: TruckStatus) => {
    switch (status) {
      case 'available': return <Badge className="bg-green-100 text-green-700 border-none">Disponible</Badge>;
      case 'in_trip': return <Badge className="bg-blue-100 text-blue-700 border-none">En Viaje</Badge>;
      case 'maintenance': return <Badge className="bg-orange-100 text-orange-700 border-none">Mantenimiento</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId || driverId === 'none') return "Sin asignar";
    const d = drivers?.find(dr => dr.id === driverId);
    return d ? `${d.lastName}, ${d.firstName}` : "Cargando...";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flota de Camiones</h1>
          <p className="text-slate-500 text-sm">Gestión integral de unidades pesadas y cumplimiento normativo.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/flota/nuevo')}>
          <Plus className="w-4 h-4 mr-2" /> Alta de Vehículo Pesado
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Patente, marca o modelo..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>Todos</Button>
            <Button variant={statusFilter === 'available' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('available')}>Disponibles</Button>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidad / Marca</TableHead>
                  <TableHead>Titularidad / Chofer</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Documentación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No hay vehículos registrados.</TableCell>
                  </TableRow>
                ) : (
                  filteredTrucks.map((truck) => {
                    const docCount = truck.documentation?.length || 0;
                    const validDocs = truck.documentation?.filter(d => d.status === 'valid').length || 0;
                    const isCritical = truck.documentation?.some(d => d.status === 'expired');

                    return (
                      <TableRow 
                        key={truck.id} 
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => router.push(`/flota/${truck.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                             <Avatar className="w-10 h-10 rounded-lg shadow-sm border border-white">
                               <AvatarImage src={truck.avatarUrl} className="object-cover" />
                               <AvatarFallback className="bg-blue-50 text-blue-600 rounded-lg">
                                 <Truck size={20} />
                               </AvatarFallback>
                             </Avatar>
                             <div>
                               <div className="font-bold text-slate-900">{truck.plate || ''}</div>
                               <div className="text-[10px] text-slate-400 uppercase font-bold">{truck.brand} {truck.model}</div>
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              {truck.ownershipType === 'company' ? (
                                <Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-700 border-blue-100 uppercase h-4">Propio</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[8px] bg-orange-50 text-orange-700 border-orange-100 uppercase h-4">Tercero</Badge>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <User size={12} className="text-slate-400" />
                              {getDriverName(truck.assignedDriverId)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Gauge size={14} className="text-slate-400" />
                            <span className="font-mono font-bold text-slate-700">{(truck.odometerKm || 0).toLocaleString()} km</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={docCount > 0 ? (validDocs / docCount) * 100 : 0} className="h-1.5 w-16" />
                            <span className={cn("text-[10px] font-bold", isCritical ? "text-red-600" : "text-slate-500")}>
                              {validDocs}/{docCount}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(truck.status)}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Gestión de Unidad</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/flota/${truck.id}`)}>
                                <FileText className="w-4 h-4 mr-2" /> Ver Detalle / Docs
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/flota/${truck.id}/editar`)}>
                                <Edit2 className="w-4 h-4 mr-2" /> Editar Ficha Técnica
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                onSelect={(e) => { e.preventDefault(); handleDelete(truck.id, truck.plate); }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Unidad
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
