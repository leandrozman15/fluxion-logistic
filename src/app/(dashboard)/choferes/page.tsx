
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, UserPlus, Search, Phone, Mail, MoreHorizontal, 
  Trash2, Edit2, Loader2, ShieldCheck, AlertTriangle, 
  Calendar, HeartPulse, CheckCircle2, MessageCircle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Driver, DriverStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function ChoferesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Driver>>({
    name: "",
    dni: "",
    licenseNumber: "",
    phone: "",
    email: "",
    status: "active",
    lintiVencimiento: "",
    bloodType: "",
    emergencyContact: ""
  });

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "drivers"), orderBy("name"));
  }, [db]);

  const { data: drivers, loading } = useCollection<Driver>(driversQuery);

  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    return drivers.filter(d => {
      const matchesSearch = (d.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (d.dni || "").includes(searchTerm) ||
                           (d.licenseNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [drivers, searchTerm, statusFilter]);

  const handleAddDriver = async () => {
    if (!db || !formData.name || !formData.dni) {
      toast({ variant: "destructive", title: "Datos incompletos", description: "Nombre y DNI son obligatorios." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "drivers"), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Chofer Registrado", description: `${formData.name} ha sido dado de alta.` });
      setIsAddOpen(false);
      setFormData({ name: "", dni: "", licenseNumber: "", phone: "", email: "", status: "active", lintiVencimiento: "", bloodType: "", emergencyContact: "" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al registrar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: DriverStatus) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Activo</Badge>;
      case 'resting': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Descanso</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Suspendido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLintiBadge = (expiry?: string) => {
    if (!expiry) return <Badge variant="outline" className="text-slate-400">Sin Dato</Badge>;
    
    const expiryDate = parseISO(expiry);
    const now = new Date();
    
    if (isBefore(expiryDate, now)) {
      return <Badge className="bg-red-500 text-white border-none">LINTI Vencida</Badge>;
    }
    if (isBefore(expiryDate, addDays(now, 15))) {
      return <Badge className="bg-orange-500 text-white border-none">Vence Pronto</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Vigente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Choferes</h1>
          <p className="text-slate-500 text-sm">Control de personal habilitado y cumplimiento de licencias LINTI.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <UserPlus className="w-4 h-4 mr-2" /> Alta de Chofer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="text-blue-600" /> Registro de Personal
              </DialogTitle>
              <DialogDescription>Ingrese los datos personales y de habilitación nacional del conductor.</DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input placeholder="Ej: Juan Pérez" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>DNI</Label>
                <Input placeholder="Sin puntos" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>N° Licencia de Conducir</Label>
                <Input placeholder="Nacional / Provincial" value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Vencimiento LINTI</Label>
                <Input type="date" value={formData.lintiVencimiento} onChange={e => setFormData({...formData, lintiVencimiento: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono de Contacto</Label>
                <Input placeholder="Con código de área" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Grupo Sanguíneo</Label>
                <Select value={formData.bloodType} onValueChange={v => setFormData({...formData, bloodType: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Contacto de Emergencia (Nombre y Tel)</Label>
                <Input placeholder="Ej: María (Esposa) - 11 5555-4444" value={formData.emergencyContact} onChange={e => setFormData({...formData, emergencyContact: e.target.value})} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddDriver} className="bg-blue-600" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck size={16} className="mr-2" />}
                Habilitar Chofer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-blue-50 border-blue-100">
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
        <Card className="bg-green-50 border-green-100">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-green-400">Disponibles Ahora</p>
              <p className="text-xl font-bold text-green-700">
                {drivers?.filter(d => d.status === 'active').length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-orange-400">LINTI por Vencer</p>
              <p className="text-xl font-bold text-orange-700">
                {drivers?.filter(d => d.lintiVencimiento && isBefore(parseISO(d.lintiVencimiento), addDays(new Date(), 15))).length || 0}
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
                  <TableHead>Identificación</TableHead>
                  <TableHead>Estado LINTI</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400 italic">
                      No se encontraron choferes con los criterios de búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDrivers.map((driver) => (
                    <TableRow key={driver.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                            {driver.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{driver.name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Phone size={10} /> {driver.phone || "Sin tel"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="font-semibold">DNI: {driver.dni}</p>
                          <p className="text-[10px] text-slate-400">Lic: {driver.licenseNumber || "N/A"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getLintiBadge(driver.lintiVencimiento)}
                          {driver.lintiVencimiento && (
                            <span className="text-[9px] text-slate-400">
                              Vence: {format(parseISO(driver.lintiVencimiento), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(driver.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600">
                            <MessageCircle size={16} />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Gestión de Chofer</DropdownMenuLabel>
                              <DropdownMenuItem>
                                <Edit2 className="w-4 h-4 mr-2" /> Editar Perfil
                              </DropdownMenuItem>
                              <DropdownMenuItem className={cn(driver.status === 'active' ? 'text-blue-600' : 'text-green-600')} onClick={() => updateDoc(doc(db!, "drivers", driver.id), { status: driver.status === 'active' ? 'resting' : 'active' })}>
                                <Calendar className="w-4 h-4 mr-2" /> {driver.status === 'active' ? 'Pasar a Descanso' : 'Poner Activo'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => deleteDoc(doc(db!, "drivers", driver.id))}>
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <div className="p-4 bg-slate-100/50 rounded-xl border border-dashed flex items-start gap-3">
        <HeartPulse className="text-red-500 mt-0.5" size={18} />
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-700">Protocolo de Seguridad Vial</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Recordatorio: Los choferes deben cumplir con los períodos de descanso obligatorios según la Ley 24.449. 
            El sistema bloqueará la asignación de cargas si el chofer se encontra en estado "Suspendido" o con LINTI vencida.
          </p>
        </div>
      </div>
    </div>
  );
}
