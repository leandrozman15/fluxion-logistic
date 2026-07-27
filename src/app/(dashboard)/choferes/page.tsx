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
  Users, UserPlus, Search, Loader2, ShieldCheck, AlertTriangle, 
  CheckCircle2, MoreVertical, Eye, FileText, Calendar, Truck as TruckIcon, Package,
  Camera,
  Edit2
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Driver, DriverStatus, Truck, Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ChoferesPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "drivers"), orderBy("lastName"));
  }, [db]);

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "trucks");
  }, [db]);

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "loads");
  }, [db]);

  const { data: drivers, loading } = useCollection<Driver>(driversQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: loads } = useCollection<Load>(loadsQuery);

  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    return drivers.filter(d => {
      const fullName = `${d.firstName} ${d.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                           (d.dni || "").includes(searchTerm) ||
                           (d.licenseNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchTerm, statusFilter]);

  const handleDeleteDriver = async (id: string, name: string) => {
    if (!db || !id) return;
    const ok = window.confirm(`¿Está seguro de eliminar a ${name}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "drivers", id));
      toast({ title: "Chofer eliminado", description: "El registro ha sido removido del sistema." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const getStatusBadge = (status: DriverStatus) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700 border-none">Activo</Badge>;
      case 'in_trip': return <Badge className="bg-blue-100 text-blue-700 border-none">En Viaje</Badge>;
      case 'resting': return <Badge className="bg-orange-100 text-orange-700 border-none">Descanso</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-700 border-none">Suspendido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExpiryLabel = (expiryDateStr?: string) => {
    if (!expiryDateStr) return null;
    try {
      const expiryDate = parseISO(expiryDateStr);
      const now = new Date();
      const days = differenceInDays(expiryDate, now);

      if (days < 0) {
        return <span className="text-red-600 font-bold">Vencido ({Math.abs(days)}d)</span>;
      }
      if (days <= 30) {
        return <span className="text-orange-600 font-bold">Vence en {days}d</span>;
      }
      return <span className="text-green-600">Vigente ({days}d)</span>;
    } catch (e) {
      return null;
    }
  };

  const getDocPhotoStats = (d: Driver) => {
    const checkList = [
      { key: 'dni', present: !!d.dniFileUrl },
      { key: 'dni_back', present: !!d.dniBackFileUrl },
      { key: 'lic', present: !!d.licenseFileUrl },
      { key: 'lic_back', present: !!d.licenseBackFileUrl }
    ];
    
    if (d.hasLinti) {
      checkList.push({ key: 'linti', present: !!d.lintiFileUrl });
    }

    const count = checkList.filter(item => item.present).length;
    const total = checkList.length;
    
    return { count, total, all: count === total };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Choferes</h1>
          <p className="text-slate-500 text-sm">Control de personal habilitado y cumplimiento de licencias profesionales.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={() => router.push('/choferes/nuevo')}>
          <UserPlus className="w-4 h-4 mr-2" /> Alta de Chofer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Users size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400">Total Choferes</p>
              <p className="text-xl font-bold text-blue-700">{drivers?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600"><CheckCircle2 size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-green-400">Disponibles</p>
              <p className="text-xl font-bold text-green-700">{drivers?.filter(d => d.status === 'active').length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><AlertTriangle size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-orange-400">Vencimientos Próximos</p>
              <p className="text-xl font-bold text-orange-700">
                {drivers?.filter(d => {
                  const licExp = d.licenseExpiry ? differenceInDays(parseISO(d.licenseExpiry), new Date()) : 999;
                  const lintiExp = d.lintiExpiry ? differenceInDays(parseISO(d.lintiExpiry), new Date()) : 999;
                  return licExp <= 30 || lintiExp <= 30;
                }).length || 0}
              </p>
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
              placeholder="Buscar por nombre, DNI o licencia..." 
              className="bg-white pl-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>Todos</Button>
            <Button variant={statusFilter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('active')}>Activos</Button>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Licencia Nacional</TableHead>
                  <TableHead>Unidad / Viajes</TableHead>
                  <TableHead>Habilitación LINTI</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No se encontraron choferes.</TableCell></TableRow>
                ) : (
                  filteredDrivers.map((driver) => {
                    const assignedTruck = trucks?.find(t => t.assignedDriverId === driver.id);
                    const tripCount = loads?.filter(l => l.assignedDriverId === driver.id).length || 0;
                    const photoStats = getDocPhotoStats(driver);

                    return (
                      <TableRow key={driver.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <Link href={`/choferes/${driver.id}`} className="flex items-center gap-3 group">
                            <Avatar className="w-10 h-10 rounded-full border shadow-sm group-hover:border-blue-400 transition-colors">
                              <AvatarImage src={driver.avatarUrl} className="object-cover" />
                              <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">{driver.firstName[0]}{driver.lastName[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{driver.lastName}, {driver.firstName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">DNI: {driver.dni}</div>
                              {/* INDICADOR DE FOTOS */}
                              <div className="flex items-center gap-1 mt-1">
                                <Camera size={10} className={cn(photoStats.all ? "text-green-600" : "text-slate-400")} />
                                <span className={cn("text-[9px] font-black uppercase tracking-tighter", photoStats.all ? "text-green-700" : "text-slate-500")}>
                                  Legajo: {photoStats.count}/{photoStats.total} fotos
                                </span>
                                {photoStats.all && <CheckCircle2 size={8} className="text-green-600" />}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-slate-700">Lic: {driver.licenseNumber}</div>
                            <div className="text-[10px] flex items-center gap-1">
                              <Calendar size={10} className="text-slate-400" />
                              {driver.licenseExpiry ? format(parseISO(driver.licenseExpiry), "dd/MM/yyyy") : '-'}
                            </div>
                            <div className="text-[9px] uppercase font-bold tracking-tighter">{getExpiryLabel(driver.licenseExpiry)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {assignedTruck ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600"><TruckIcon size={12} /> {assignedTruck.plate}</div>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic">Sin unidad fija</div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase"><Package size={12} className="text-slate-400" /> {tripCount} Viajes realizados</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {!driver.hasLinti ? (
                            <Badge variant="outline" className="text-[9px] text-slate-400 uppercase">Sin LINTI</Badge>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-[11px] font-bold text-blue-700">N° {driver.lintiNumber}</div>
                              <div className="text-[10px] flex items-center gap-1"><ShieldCheck size={10} className="text-blue-400" /> {driver.lintiExpiry ? format(parseISO(driver.lintiExpiry), "dd/MM/yyyy") : '-'}</div>
                              <div className="text-[9px] uppercase font-bold tracking-tighter">{getExpiryLabel(driver.lintiExpiry)}</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Gestión de Chofer</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/choferes/${driver.id}`)}>
                                <Eye className="w-4 h-4 mr-2" /> Ver Expediente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/choferes/${driver.id}/editar`)}>
                                <Edit2 className="w-4 h-4 mr-2" /> Editar Perfil
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onSelect={() => handleDeleteDriver(driver.id, `${driver.firstName} ${driver.lastName}`)}>Eliminar Registro</DropdownMenuItem>
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
