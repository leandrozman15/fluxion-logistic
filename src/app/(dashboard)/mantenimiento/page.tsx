
'use client';

import { useState, useMemo, useEffect } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Wrench, Plus, Calendar, Gauge, DollarSign, 
  Loader2, MoreVertical, Trash2, CheckCircle2, 
  AlertTriangle, Clock, History, Truck as TruckIcon, User, Search, FileText
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Maintenance, MaintenanceStatus, MaintenanceType, Truck } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function MaintenancePage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingNumber, setIsLoadingNumber] = useState(false);

  const [formData, setFormData] = useState<Partial<Maintenance>>({
    orderNumber: "",
    truckId: "",
    type: "preventive",
    status: "scheduled",
    description: "",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
    estimatedCost: 0,
    workshopName: ""
  });

  const maintenanceQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "maintenance"), orderBy("scheduledDate", "desc"));
  }, [db, tenantId]);

  const trucksQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "trucks"), orderBy("plate"));
  }, [db, tenantId]);

  const { data: maintenanceRecords, loading } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);

  // LÓGICA DE GENERACIÓN DE NÚMERO DE ORDEN (OT)
  useEffect(() => {
    async function fetchNextOrderNumber() {
      if (!isAddOpen || !db || !tenantId) return;
      
      setIsLoadingNumber(true);
      try {
        const today = new Date();
        const datePart = format(today, "yyyy-MM-dd");
        
        // Consultar el último registro del día para el contador
        const q = query(collection(db, "tenants", tenantId, "maintenance"), orderBy("orderNumber", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        
        let nextSeq = 1;
        if (!querySnapshot.empty) {
          const lastRecord = querySnapshot.docs[0].data() as Maintenance;
          if (lastRecord.orderNumber && lastRecord.orderNumber.startsWith(`OT-${datePart}`)) {
             const lastSeqStr = lastRecord.orderNumber.split("-").pop();
             if (lastSeqStr) nextSeq = parseInt(lastSeqStr) + 1;
          }
        }

        const paddedSeq = String(nextSeq).padStart(3, '0');
        setFormData(prev => ({
          ...prev,
          orderNumber: `OT-${datePart}-${paddedSeq}`
        }));
      } catch (e) {
        console.error("Error generating OT number:", e);
      } finally {
        setIsLoadingNumber(false);
      }
    }

    fetchNextOrderNumber();
  }, [isAddOpen, db, tenantId]);

  const filteredRecords = useMemo(() => {
    if (!maintenanceRecords) return [];
    return maintenanceRecords.filter(m => {
      const truck = trucks?.find(t => t.id === m.truckId);
      return (
        (m.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (truck?.plate || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.workshopName || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [maintenanceRecords, trucks, searchTerm]);

  const handleAddMaintenance = async () => {
    if (!db || !tenantId || !formData.truckId || !formData.description) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "tenants", tenantId, "maintenance"), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      if (formData.status === 'in_progress') {
        await updateDoc(doc(db, "tenants", tenantId, "trucks", formData.truckId), { status: 'maintenance' });
      }

      toast({ title: "Orden de Taller Confirmada", description: `Se ha generado la ${formData.orderNumber}.` });
      setIsAddOpen(false);
      setFormData({ orderNumber: "", truckId: "", type: "preventive", status: "scheduled", description: "", scheduledDate: format(new Date(), "yyyy-MM-dd"), estimatedCost: 0, workshopName: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (record: Maintenance, newStatus: MaintenanceStatus) => {
    if (!db || !tenantId) return;
    try {
      const recordRef = doc(db, "tenants", tenantId, "maintenance", record.id);
      await updateDoc(recordRef, { 
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...(newStatus === 'completed' ? { completedDate: new Date().toISOString() } : {})
      });

      if (newStatus === 'in_progress') {
        await updateDoc(doc(db, "tenants", tenantId, "trucks", record.truckId), { status: 'maintenance' });
      } else if (newStatus === 'completed' || newStatus === 'cancelled') {
        await updateDoc(doc(db, "tenants", tenantId, "trucks", record.truckId), { status: 'available' });
      }

      toast({ title: `Estado actualizado a ${newStatus}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !tenantId || !confirm("¿Eliminar este registro de mantenimiento?")) return;
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "maintenance", id));
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
      case 'preventive': return <Badge variant="outline" className="text-blue-600 border-blue-200 uppercase text-[9px] font-black">🔧 Preventivo</Badge>;
      case 'corrective': return <Badge variant="outline" className="text-red-600 border-red-200 uppercase text-[9px] font-black">🚨 Correctivo</Badge>;
      case 'inspection': return <Badge variant="outline" className="text-slate-600 border-slate-200 uppercase text-[9px] font-black">📋 Inspección</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Taller y Mantenimiento</h1>
          <p className="text-slate-500 text-sm">Emisión de órdenes de trabajo, seguimiento técnico y control de reparaciones.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Nueva Orden de Taller
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-xl">Orden de Taller (OT)</DialogTitle>
                  <DialogDescription>Asigne la unidad y detalle el protocolo de reparación.</DialogDescription>
                </div>
                <Badge variant="outline" className="font-mono text-blue-600 bg-blue-50 border-blue-200 h-8 px-4">
                  {isLoadingNumber ? <Loader2 size={12} className="animate-spin" /> : formData.orderNumber}
                </Badge>
              </div>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-slate-400">1. Unidad Asignada</Label>
                  <Select value={formData.truckId} onValueChange={v => setFormData({...formData, truckId: v})}>
                    <SelectTrigger className="bg-slate-50"><SelectValue placeholder="Seleccionar Camión" /></SelectTrigger>
                    <SelectContent>
                      {trucks?.map(t => <SelectItem key={t.id} value={t.id}>{t.plate} - {t.brand} {t.model}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-slate-400">2. Programa de Mantenimiento</Label>
                  <Select value={formData.type} onValueChange={(v: MaintenanceType) => setFormData({...formData, type: v})}>
                    <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventive">🔧 Preventivo (Programado)</SelectItem>
                      <SelectItem value="corrective">🚨 Correctivo (Rotura)</SelectItem>
                      <SelectItem value="inspection">📋 Inspección / VTV / RTO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-slate-400">Fecha Programada</Label>
                  <Input type="date" value={formData.scheduledDate} onChange={e => setFormData({...formData, scheduledDate: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-slate-400">Taller / Proveedor</Label>
                  <Input placeholder="Nombre del taller o mecánico" value={formData.workshopName} onChange={e => setFormData({...formData, workshopName: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-slate-400">3. Descripción Detallada del Trabajo</Label>
                <Textarea 
                  placeholder="Diagnóstico inicial, repuestos a cambiar, pruebas de ruta..." 
                  className="min-h-[150px] font-mono text-xs leading-relaxed"
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-slate-400">4. Presupuesto Estimado (ARS)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="number" className="pl-9" value={formData.estimatedCost} onChange={e => setFormData({...formData, estimatedCost: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="text-red-500 font-bold">CANCELAR</Button>
              <Button onClick={handleAddMaintenance} disabled={isSubmitting || !formData.truckId} className="bg-blue-600 font-bold min-w-[150px]">
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={16} />}
                CONFIRMAR ORDEN
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white border-none shadow-sm">
          <CardContent className="pt-4 flex flex-col gap-1">
            <p className="text-[10px] uppercase font-bold text-white/40">Total Órdenes</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black italic">{maintenanceRecords?.length || 0}</p>
              <Wrench size={24} className="text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100 shadow-none">
          <CardContent className="pt-4 flex flex-col gap-1 text-blue-700">
            <p className="text-[10px] uppercase font-bold opacity-50">Programados</p>
            <p className="text-2xl font-black italic">{maintenanceRecords?.filter(m => m.status === 'scheduled').length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100 shadow-none">
          <CardContent className="pt-4 flex flex-col gap-1 text-orange-700">
            <p className="text-[10px] uppercase font-bold opacity-50">En Taller</p>
            <p className="text-2xl font-black italic animate-pulse">{maintenanceRecords?.filter(m => m.status === 'in_progress').length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100 shadow-none">
          <CardContent className="pt-4 flex flex-col gap-1 text-green-700">
            <p className="text-[10px] uppercase font-bold opacity-50">Presupuesto Ejecutado</p>
            <p className="text-2xl font-black italic">
               ${maintenanceRecords?.reduce((acc, m) => acc + (m.actualCost || m.estimatedCost || 0), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por OT#, patente, taller o trabajo..." 
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
                <TableRow className="bg-slate-50/50">
                  <TableHead>OT N° / Unidad</TableHead>
                  <TableHead>Tipo / Protocolo de Trabajo</TableHead>
                  <TableHead>Taller / Proveedor</TableHead>
                  <TableHead>Inversión Est.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">
                      No hay registros de mantenimiento que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const truck = trucks?.find(t => t.id === record.truckId);
                    return (
                      <TableRow key={record.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-blue-600 text-xs">{record.orderNumber || 'S/OT'}</span>
                            <span className="font-black text-slate-900">{truck?.plate || 'S/D'}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">
                              {format(parseISO(record.scheduledDate), "dd 'de' MMM, yyyy", { locale: es })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="space-y-1 max-w-[300px]">
                              {getTypeBadge(record.type)}
                              <p className="text-xs font-medium text-slate-600 line-clamp-2 italic leading-relaxed">
                                {record.description}
                              </p>
                           </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                             <History size={12} className="text-slate-400" /> {record.workshopName || "Pendiente Asignación"}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-700">${record.estimatedCost?.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="w-56">
                               <DropdownMenuLabel>Gestión de Taller</DropdownMenuLabel>
                               <DropdownMenuItem>
                                 <FileText className="w-4 h-4 mr-2" /> Ver Orden Completa
                               </DropdownMenuItem>
                               <DropdownMenuSeparator />
                               {record.status === 'scheduled' && (
                                 <DropdownMenuItem onClick={() => handleUpdateStatus(record, 'in_progress')}>
                                   <Wrench className="w-4 h-4 mr-2" /> Ingresar a Taller
                                 </DropdownMenuItem>
                               )}
                               {record.status === 'in_progress' && (
                                 <DropdownMenuItem onClick={() => handleUpdateStatus(record, 'completed')}>
                                   <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar y Liberar Unidad
                                 </DropdownMenuItem>
                               )}
                               <DropdownMenuSeparator />
                               <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => handleDelete(record.id)}>
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
