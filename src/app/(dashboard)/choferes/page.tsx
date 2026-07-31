
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
  Users, UserPlus, Search, Loader2, ShieldCheck, AlertTriangle, 
  CheckCircle2, MoreVertical, Eye, FileText, Calendar, Truck as TruckIcon, Package,
  Camera, Edit2, Shield, BadgeCheck, HardHat, Briefcase, UserCircle2
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Driver, DriverStatus, Truck, Load, DriverRole } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays, isBefore } from "date-fns";
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
      toast({ title: "Registro eliminado", description: "El registro ha sido removido del sistema." });
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

  const getRoleBadge = (role: DriverRole) => {
    switch (role) {
      case 'admin': return <Badge className="bg-red-100 text-red-700 border-none text-[8px] uppercase font-black"><Shield className="w-2.5 h-2.5 mr-1" /> Super Admin</Badge>;
      case 'manager': return <Badge className="bg-blue-100 text-blue-700 border-none text-[8px] uppercase font-black"><BadgeCheck className="w-2.5 h-2.5 mr-1" /> Gerente</Badge>;
      case 'sales_admin': 
      case 'purchasing_admin': return <Badge className="bg-slate-100 text-slate-700 border-none text-[8px] uppercase font-black"><Briefcase className="w-2.5 h-2.5 mr-1" /> Administración</Badge>;
      case 'coordinator': return <Badge className="bg-orange-100 text-orange-700 border-none text-[8px] uppercase font-black"><UserCircle2 className="w-2.5 h-2.5 mr-1" /> Coordinador</Badge>;
      case 'warehouse': return <Badge className="bg-slate-100 text-slate-700 border-none text-[8px] uppercase font-black"><HardHat className="w-2.5 h-2.5 mr-1" /> Depósito</Badge>;
      case 'driver': return <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] uppercase font-black"><TruckIcon className="w-2.5 h-2.5 mr-1" /> Chofer</Badge>;
      case 'companion': return <Badge className="bg-slate-100 text-slate-500 border-none text-[8px] uppercase font-black">Acompañante</Badge>;
      default: return <Badge variant="outline" className="text-[8px] uppercase">{role}</Badge>;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Personal</h1>
          <p className="text-slate-500 text-sm">Control de personal habilitado (Operaciones y Administración).</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" onClick={() => router.push('/choferes/nuevo')}>
          <UserPlus className="w-4 h-4 mr-2" /> Alta de Personal
        </Button>
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
                  <TableHead>Personal</TableHead>
                  <TableHead>Rol / Función</TableHead>
                  <TableHead>Licencia Nacional</TableHead>
                  <TableHead>Unidad / Viajes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No se encontraron registros.</TableCell></TableRow>
                ) : (
                  filteredDrivers.map((driver) => {
                    const assignedTruck = trucks?.find(t => t.assignedDriverId === driver.id || t.assignedCompanionIds?.includes(driver.id));
                    const tripCount = loads?.filter(l => l.assignedDriverId === driver.id).length || 0;
                    
                    const isLicenseExpired = driver.licenseExpiry && isBefore(parseISO(driver.licenseExpiry), new Date());
                    const isLintiExpired = driver.hasLinti && driver.lintiExpiry && isBefore(parseISO(driver.lintiExpiry), new Date());
                    const hasExpiredDocs = (driver.role === 'driver' && isLicenseExpired) || (driver.hasLinti && isLintiExpired);

                    return (
                      <TableRow key={driver.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <Link href={`/choferes/${driver.id}`} className="flex items-center gap-3 group">
                            <Avatar className="w-10 h-10 rounded-full border shadow-sm group-hover:border-blue-400 transition-colors">
                              <AvatarImage src={driver.avatarUrl} className="object-cover" />
                              <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">{driver.firstName[0]}{driver.lastName[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className={cn(
                                "font-bold transition-all",
                                hasExpiredDocs 
                                  ? "text-red-600 animate-pulse font-black" 
                                  : "text-slate-900 group-hover:text-blue-600"
                              )}>
                                {driver.lastName}, {driver.firstName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">DNI: {driver.dni}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(driver.role)}
                        </TableCell>
                        <TableCell>
                          {driver.role === 'driver' ? (
                            <div className="space-y-1">
                              <div className="text-[11px] font-bold text-slate-700">{driver.licenseNumber ? `Lic: ${driver.licenseNumber}` : 'S/L'}</div>
                              <div className="text-[9px] uppercase font-bold tracking-tighter">{getExpiryLabel(driver.licenseExpiry)}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">No aplica</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {assignedTruck ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600"><TruckIcon size={12} /> {assignedTruck.plate}</div>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic">Personal Administrativo</div>
                            )}
                            {driver.role === 'driver' && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase"><Package size={12} className="text-slate-400" /> {tripCount} Viajes realizados</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(driver.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Gestión de Personal</DropdownMenuLabel>
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
