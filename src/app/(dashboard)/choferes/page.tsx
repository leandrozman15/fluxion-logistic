
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, UserPlus, Search, Phone, Mail, MoreHorizontal, 
  Trash2, Edit2, Loader2, ShieldCheck, AlertTriangle, 
  CheckCircle2, MessageCircle, MoreVertical, User, Download, FileText, Calendar, Clock
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Driver, DriverStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, addDays, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  const { data: drivers, loading } = useCollection<Driver>(driversQuery);

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
    if (!db || !confirm(`¿Está seguro de eliminar a ${name}?`)) return;
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
  };

  const handleDownload = (url: string | undefined, filename: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Descarga iniciada", description: filename });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Choferes</h1>
          <p className="text-slate-500 text-sm">Control de personal habilitado y cumplimiento de licencias profesionales.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/choferes/nuevo')}>
          <UserPlus className="w-4 h-4 mr-2" /> Alta de Chofer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400">Total Choferes</p>
              <p className="text-xl font-bold text-blue-700">{drivers?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-green-400">Disponibles</p>
              <p className="text-xl font-bold text-green-700">
                {drivers?.filter(d => d.status === 'active').length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-orange-400">Vencimientos Próximos</p>
              <p className="text-xl font-bold text-orange-700">
                {drivers?.filter(d => (d.licenseExpiry && differenceInDays(parseISO(d.licenseExpiry), new Date()) <= 30) || (d.lintiExpiry && differenceInDays(parseISO(d.lintiExpiry), new Date()) <= 30)).length || 0}
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
              className="pl-8 bg-white"
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
                  <TableHead>Habilitación LINTI</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400 italic">
                      No se encontraron choferes registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrivers.map((driver) => (
                    <TableRow key={driver.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 rounded-full border shadow-sm">
                            <AvatarImage src={driver.avatarUrl} className="object-cover" />
                            <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">
                              {driver.firstName.charAt(0)}{driver.lastName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-bold text-slate-900">{driver.lastName}, {driver.firstName}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                              DNI: {driver.dni}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-700">Lic: {driver.licenseNumber}</div>
                          <div className="text-[10px] flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" />
                            {driver.licenseExpiry ? format(parseISO(driver.licenseExpiry), "dd/MM/yyyy") : '-'}
                          </div>
                          <div className="text-[9px] uppercase font-bold tracking-tighter">
                            {getExpiryLabel(driver.licenseExpiry)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {!driver.hasLinti ? (
                          <Badge variant="outline" className="text-[9px] text-slate-400 uppercase">Sin LINTI</Badge>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-blue-700">N° {driver.lintiNumber}</div>
                            <div className="text-[10px] flex items-center gap-1">
                              <ShieldCheck size={10} className="text-blue-400" />
                              {driver.lintiExpiry ? format(parseISO(driver.lintiExpiry), "dd/MM/yyyy") : '-'}
                            </div>
                            <div className="text-[9px] uppercase font-bold tracking-tighter">
                              {getExpiryLabel(driver.lintiExpiry)}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(driver.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Gestión de Chofer</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => router.push(`/choferes/${driver.id}/editar`)}>
                              <Edit2 className="w-4 h-4 mr-2" /> Editar Perfil
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase text-slate-400">Documentación</DropdownMenuLabel>
                            
                            <DropdownMenuItem 
                              disabled={!driver.dniFileUrl} 
                              onClick={() => handleDownload(driver.dniFileUrl, `DNI_${driver.lastName}.jpg`)}
                            >
                              <Download className="w-4 h-4 mr-2" /> Descargar DNI
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              disabled={!driver.licenseFileUrl} 
                              onClick={() => handleDownload(driver.licenseFileUrl, `Licencia_${driver.lastName}.jpg`)}
                            >
                              <FileText className="w-4 h-4 mr-2" /> Descargar Licencia
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              disabled={!driver.lintiFileUrl} 
                              onClick={() => handleDownload(driver.lintiFileUrl, `LINTI_${driver.lastName}.jpg`)}
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" /> Descargar LINTI
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:bg-red-50 focus:text-red-600" 
                              onClick={() => handleDeleteDriver(driver.id, `${driver.firstName} ${driver.lastName}`)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar Registro
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
