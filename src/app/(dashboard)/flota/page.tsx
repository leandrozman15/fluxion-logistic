
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
import { Progress } from "@/components/ui/progress";
import { 
  Truck, Plus, Search, MoreHorizontal, Trash2, Edit2, 
  Gauge, Loader2, FileText, User, Wrench, Calendar, AlertTriangle, DollarSign, TrendingUp
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Truck as TruckType, TruckStatus, Driver, Maintenance, Expense } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, parseISO, isBefore, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

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

  const { data: trucks, loading: trucksLoading } = useCollection<TruckType>(trucksQuery);

  const driversQuery = useMemo(() => db ? query(collection(db, "drivers")) : null, [db]);
  const { data: drivers } = useCollection<Driver>(driversQuery);

  const maintenanceQuery = useMemo(() => db ? query(collection(db, "maintenance")) : null, [db]);
  const { data: maintenanceRecords } = useCollection<Maintenance>(maintenanceQuery);

  const fuelExpensesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "global_expenses"), where("category", "==", "fuel"));
  }, [db]);

  const { data: fuelExpenses } = useCollection<Expense>(fuelExpensesQuery);

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
    if (!db || !id) return;
    const ok = window.confirm(`¿Desea eliminar definitivamente la unidad ${plate}? Esta acción no se puede deshacer.`);
    if (!ok) return;

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

  const getDriverObj = (driverId?: string) => {
    if (!driverId || driverId === 'none') return null;
    return drivers?.find(dr => dr.id === driverId) || null;
  };

  const getNextServiceInfo = (truckId: string) => {
    if (!maintenanceRecords) return null;
    const truckMaintenances = maintenanceRecords
      .filter(m => m.truckId === truckId && (m.status === 'scheduled' || m.status === 'in_progress'))
      .sort((a, b) => parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime());

    return truckMaintenances[0] || null;
  };

  const calculateTheoreticalCost = (truck: TruckType) => {
    if (!truck.costs) return 0;
    const costs = truck.costs;
    const kmMensuales = costs.operational.estimatedMonthlyKm || 1;
    
    const sumFixed = Object.values(costs.fixed).reduce((a, b) => a + (b as number), 0);
    const fixedPerKm = sumFixed / kmMensuales;
    
    const oilPerKm = costs.variable.preventiveMaintenance.cost / (costs.variable.preventiveMaintenance.frequencyKm || 1);
    const tiresPerKm = costs.variable.tires.costFullSet / (costs.variable.tires.lifeSpanKm || 1);
    const reservePerKm = costs.variable.unforeseenReservePerKm;

    let fuelPerKm = 0;
    const truckFuel = fuelExpenses?.filter(e => e.truckId === truck.id);
    if (truckFuel && truckFuel.length > 0) {
      const validTickets = truckFuel.filter(e => !!e.pricePerLiter && e.pricePerLiter > 0);
      if (validTickets.length > 0) {
        const avgPrice = validTickets.reduce((acc, e) => acc + (e.pricePerLiter || 0), 0) / validTickets.length;
        fuelPerKm = (avgPrice * (truck.avgConsumption || 32)) / 100;
      }
    }
    
    return fixedPerKm + oilPerKm + tiresPerKm + reservePerKm + fuelPerKm;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flota de Camiones</h1>
          <p className="text-slate-500 text-sm">Gestión integral de unidades pesadas y cumplimiento normativo.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={() => router.push('/flota/nuevo')}>
          <Plus className="w-4 h-4 mr-2" /> Alta de Vehículo Pesado
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Truck size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400">Total Unidades</p>
              <p className="text-xl font-bold text-blue-700">{trucks?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-none shadow-sm text-white">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><TrendingUp size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-white/40">Costo Medio Flota / KM</p>
              <p className="text-xl font-bold text-blue-400">
                ${(trucks?.reduce((acc, t) => acc + calculateTheoreticalCost(t), 0) || 0 / (trucks?.length || 1)).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><Wrench size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-orange-400">En Taller</p>
              <p className="text-xl font-bold text-orange-700">{trucks?.filter(t => t.status === 'maintenance').length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Patente, marca o modelo..." 
              className="bg-white pl-8"
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
          {trucksLoading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Unidad / Marca</TableHead>
                  <TableHead>Titularidad / Chofer</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Costo / KM</TableHead>
                  <TableHead>Documentación</TableHead>
                  <TableHead>Próximo Taller</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-20 text-slate-400 italic">No hay vehículos registrados.</TableCell></TableRow>
                ) : (
                  filteredTrucks.map((truck) => {
                    const docCount = truck.documentation?.length || 0;
                    const validDocs = truck.documentation?.filter(d => d.status === 'valid').length || 0;
                    const isCritical = truck.documentation?.some(d => d.status === 'expired');
                    const costPerKm = calculateTheoreticalCost(truck);
                    const dr = getDriverObj(truck.assignedDriverId);
                    const nextService = getNextServiceInfo(truck.id);

                    return (
                      <TableRow key={truck.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => router.push(`/flota/${truck.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                             <Avatar className="w-10 h-10 rounded-lg shadow-sm border border-white">
                               <AvatarImage src={truck.avatarUrl} className="object-cover" />
                               <AvatarFallback className="bg-blue-50 text-blue-600 rounded-lg"><Truck size={20} /></AvatarFallback>
                             </Avatar>
                             <div>
                               <div className="font-bold text-slate-900">{truck.plate || ''}</div>
                               <div className="text-[10px] text-slate-400 uppercase font-bold">{truck.brand} {truck.model}</div>
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {truck.ownershipType === 'company' ? (
                              <Badge variant="outline" className="h-4 bg-blue-50 text-[8px] text-blue-700 border-blue-100 uppercase">Propio</Badge>
                            ) : (
                              <Badge variant="outline" className="h-4 bg-orange-50 text-[8px] text-orange-700 border-orange-100 uppercase">Tercero</Badge>
                            )}
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <Avatar className="h-5 w-5 border shadow-sm">
                                <AvatarImage src={dr?.avatarUrl} className="object-cover" />
                                <AvatarFallback className="bg-slate-50 text-[8px] text-slate-400">
                                  {dr?.firstName?.[0] || <User size={10} />}
                                </AvatarFallback>
                              </Avatar>
                              {dr ? `${dr.lastName}, ${dr.firstName}` : "Sin asignar"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><div className="flex items-center gap-2"><Gauge size={14} className="text-slate-400" /><span className="font-mono font-bold text-slate-700">{(truck.odometerKm || 0).toLocaleString()} km</span></div></TableCell>
                        <TableCell>
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-blue-600">${costPerKm.toFixed(2)}</span>
                              <span className="text-[8px] uppercase font-bold text-slate-400 tracking-tighter">Costo Teórico</span>
                           </div>
                        </TableCell>
                        <TableCell><div className="flex items-center gap-2"><Progress value={docCount > 0 ? (validDocs / docCount) * 100 : 0} className="h-1.5 w-16" /><span className={cn("text-[10px] font-bold", isCritical ? "text-red-600" : "text-slate-500")}>{validDocs}/{docCount}</span></div></TableCell>
                        <TableCell>
                          {nextService ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-orange-600 flex items-center gap-1">
                                <Wrench size={10}/> {format(parseISO(nextService.scheduledDate), "dd/MM")}
                              </span>
                              <span className="text-[8px] text-slate-400 uppercase font-bold truncate max-w-[80px]">
                                {nextService.type === 'preventive' ? 'Preventivo' : 'Correctivo'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">No prog.</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(truck.status)}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>Gestión de Unidad</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/flota/${truck.id}`)}><FileText className="w-4 h-4 mr-2" /> Ver Detalle / Docs</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/flota/${truck.id}/editar`)}><Edit2 className="w-4 h-4 mr-2" /> Editar Ficha Técnica</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onSelect={() => handleDelete(truck.id, truck.plate)}><Trash2 className="w-4 h-4 mr-2" /> Eliminar Unidad</DropdownMenuItem>
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
