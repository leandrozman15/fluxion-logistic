
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Wrench, Plus, Calendar, Gauge, DollarSign, 
  Loader2, MoreVertical, Trash2, CheckCircle2, 
  AlertTriangle, Clock, History, Truck as TruckIcon, User, Search
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Maintenance, MaintenanceStatus, MaintenanceType, Truck } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function MaintenancePage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<Maintenance>>({
    truckId: "",
    type: "preventive",
    status: "scheduled",
    description: "",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
    estimatedCost: 0,
    workshopName: ""
  });

  const maintenanceQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "maintenance"), orderBy("scheduledDate", "desc"));
  }, [db]);

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "trucks"), orderBy("plate"));
  }, [db]);

  const { data: maintenanceRecords, loading } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);

  const filteredRecords = useMemo(() => {
    if (!maintenanceRecords) return [];
    return maintenanceRecords.filter(m => {
      const truck = trucks?.find(t => t.id === m.truckId);
      return (
        (truck?.plate || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.workshopName || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [maintenanceRecords, trucks, searchTerm]);

  const handleAddMaintenance = async () => {
    if (!db || !formData.truckId || !formData.description) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "maintenance"), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Si el estado es "in_progress", marcar el camión como mantenimiento
      if (formData.status === 'in_progress') {
        await updateDoc(doc(db, "trucks", formData.truckId), { status: 'maintenance' });
      }

      toast({ title: "Mantenimiento Programado" });
      setIsAddOpen(false);
      setFormData({ truckId: "", type: "preventive", status: "scheduled", description: "", scheduledDate: format(new Date(), "yyyy-MM-dd"), estimatedCost: 0, workshopName: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (record: Maintenance, newStatus: MaintenanceStatus) => {
    if (!db) return;
    try {
      const recordRef = doc(db, "maintenance", record.id);
      await updateDoc(recordRef, { 
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'completed' ? { completedDate: new Date().toISOString() } : {})
      });

      // Actualizar estado del camión
      if (newStatus === 'in_progress') {
        await updateDoc(doc(db, "trucks", record.truckId), { status: 'maintenance' });
      } else if (newStatus === 'completed' || newStatus === 'cancelled') {
        await updateDoc(doc(db, "trucks", record.truckId), { status: 'available' });
      }

      toast({ title: `Estado actualizado a ${newStatus}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este registro de mantenimiento?")) return;
    try {
      await deleteDoc(doc(db, "maintenance", id));
      toast({ title: "Registro eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">Programado</Badge>;
      case 'in_progress': return <Badge className="bg-orange-500 text-white border-none animate-pulse">En Taller</Badge>;
      case 'completed': return <Badge className="bg-green-600 text-white border-none">Finalizado</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: MaintenanceType) => {
    switch (type) {
      case 'preventive': return <Badge variant="outline" className="text-blue-600 border-blue-200">Preventivo</Badge>;
      case 'corrective': return <Badge variant="outline" className="text-red-600 border-red-200">Correctivo</Badge>;
      case 'inspection': return <Badge variant="outline" className="text-slate-600 border-slate-200">Inspección</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Control de Mantenimiento</h1>
          <p className="text-slate-500 text-sm">Gestión de paradas técnicas, reparaciones y costos de taller.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Programar Mantenimiento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nueva Orden de Taller</DialogTitle>
              <DialogDescription>Asigne una unidad y detalle el trabajo a realizar.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Unidad Pesada</Label>
                <Select value={formData.truckId} onValueChange={v => setFormData({...formData, truckId: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar Camión" /></SelectTrigger>
                  <SelectContent>
                    {trucks?.map(t => <SelectItem key={t.id} value={t.id}>{t.plate} - {t.brand} {t.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo de Mantenimiento</Label>
                  <Select value={formData.type} onValueChange={(v: MaintenanceType) => setFormData({...formData, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventive">🔧 Preventivo (Programado)</SelectItem>
                      <SelectItem value="corrective">🚨 Correctivo (Rotura)</SelectItem>
                      <SelectItem value="inspection">📋 Inspección / VTV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Fecha Programada</Label>
                  <Input type="date" value={formData.scheduledDate} onChange={e => setFormData({...formData, scheduledDate: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Taller / Proveedor</Label>
                <Input placeholder="Nombre del taller" value={formData.workshopName} onChange={e => setFormData({...formData, workshopName: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Descripción del Trabajo</Label>
                <Input placeholder="Ej: Cambio de aceite y filtros" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Presupuesto Estimado (ARS)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="number" className="pl-9" value={formData.estimatedCost} onChange={e => setFormData({...formData, estimatedCost: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddMaintenance} disabled={isSubmitting} className="bg-blue-600">
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Wrench className="mr-2" size={16} />}
                Confirmar Orden
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Calendar size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-400">Programados</p>
              <p className="text-xl font-bold text-blue-700">{maintenanceRecords?.filter(m => m.status === 'scheduled').length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600"><Wrench size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-orange-400">En Taller Hoy</p>
              <p className="text-xl font-bold text-orange-700">{maintenanceRecords?.filter(m => m.status === 'in_progress').length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-none">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600"><DollarSign size={20} /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-green-400">Inversión Mes</p>
              <p className="text-xl font-bold text-green-700">$0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por patente, taller o trabajo..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidad / Fecha</TableHead>
                  <TableHead>Tipo / Trabajo</TableHead>
                  <TableHead>Taller / Proveedor</TableHead>
                  <TableHead>Costo Est.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">
                      No hay registros de mantenimiento.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const truck = trucks?.find(t => t.id === record.truckId);
                    return (
                      <TableRow key={record.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{truck?.plate || 'S/D'}</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-bold uppercase">
                              <Calendar size={10}/> {format(parseISO(record.scheduledDate), "dd/MM/yyyy")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="space-y-1">
                              {getTypeBadge(record.type)}
                              <p className="text-xs font-medium text-slate-600 line-clamp-1">{record.description}</p>
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                             <History size={12} className="text-slate-400" /> {record.workshopName || "Taller Externo"}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-700">${record.estimatedCost?.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="w-52">
                               <DropdownMenuLabel>Gestión de Taller</DropdownMenuLabel>
                               {record.status === 'scheduled' && (
                                 <DropdownMenuItem onClick={() => handleUpdateStatus(record, 'in_progress')}>
                                   <Wrench className="w-4 h-4 mr-2" /> Ingresar a Taller
                                 </DropdownMenuItem>
                               )}
                               {record.status === 'in_progress' && (
                                 <DropdownMenuItem onClick={() => handleUpdateStatus(record, 'completed')}>
                                   <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar Trabajo
                                 </DropdownMenuItem>
                               )}
                               <DropdownMenuSeparator />
                               <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(record.id)}>
                                 <Trash2 className="w-4 h-4 mr-2" /> Eliminar Registro
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
