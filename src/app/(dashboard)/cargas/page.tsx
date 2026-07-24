
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Plus, Search, MapPin, Scale, DollarSign, 
  ArrowRight, Loader2, MoreVertical, Trash2, Edit2, 
  CheckCircle2, Clock, Truck, ChevronRight
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
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CargasPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Load>>({
    description: "",
    weightKg: 0,
    origin: "",
    destination: "",
    clientName: "",
    priceArs: 0,
    status: "pending"
  });

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: loads, loading } = useCollection<Load>(loadsQuery);

  const filteredLoads = useMemo(() => {
    if (!loads) return [];
    return loads.filter(l => 
      l.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.destination.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [loads, searchTerm]);

  const handleAddLoad = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "loads"), {
        ...formData,
        createdAt: serverTimestamp()
      });
      toast({ title: "Carga Registrada", description: "El pedido ha sido ingresado al sistema." });
      setIsAddOpen(false);
      setFormData({ description: "", weightKg: 0, origin: "", destination: "", clientName: "", priceArs: 0, status: "pending" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error ao registrar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: LoadStatus) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "loads", id), { status: newStatus });
      toast({ title: "Estado Actualizado", description: `La carga ahora está ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error ao atualizar" });
    }
  };

  const getStatusBadge = (status: LoadStatus) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Pendiente</Badge>;
      case 'assigned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Asignada</Badge>;
      case 'on_route': return <Badge className="bg-blue-600 text-white border-none">En Ruta</Badge>;
      case 'delivered': return <Badge className="bg-green-600 text-white border-none">Entregada</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cargas y Fletes</h1>
          <p className="text-slate-500 text-sm">Gestión de pedidos de transporte y seguimiento de entregas.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Pedido de Carga
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Nueva Carga</DialogTitle>
              <DialogDescription>Ingrese los detalles del flete para iniciar el proceso de asignación.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Descripción de la Mercadería</Label>
                <Input placeholder="Ej: Bobinas de acero, Granos, Pallets..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Cliente / Dador de Carga</Label>
                <Input placeholder="Nombre de la empresa" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Peso Total (Kg)</Label>
                <Input type="number" placeholder="0" value={formData.weightKg || ''} onChange={e => setFormData({...formData, weightKg: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Origen (Ciudad, Prov)</Label>
                <Input placeholder="Ej: Rosario, Santa Fe" value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Destino (Ciudad, Prov)</Label>
                <Input placeholder="Ej: CABA, Buenos Aires" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Valor del Flete (ARS)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="number" className="pl-8" placeholder="0.00" value={formData.priceArs || ''} onChange={e => setFormData({...formData, priceArs: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado Inicial</Label>
                <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="assigned">Asignada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button className="bg-blue-600" onClick={handleAddLoad} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Package className="mr-2" size={16} />}
                Registrar Carga
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por descripción, cliente o ruta..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs defaultValue="all" className="w-full md:w-auto">
            <TabsList className="bg-white border">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="on_route">En Viaje</TabsTrigger>
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
                  <TableHead>Carga / Mercadería</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Peso / Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay cargas registradas que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoads.map((load) => (
                    <TableRow key={load.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Package size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{load.description}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">{load.clientName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                            <div className="w-[1px] h-4 bg-slate-200"></div>
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-500">{load.origin}</span>
                            <span className="font-bold">{load.destination}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs font-semibold">
                            <Scale size={12} className="text-slate-400" /> {load.weightKg.toLocaleString()} Kg
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                            <DollarSign size={12} /> {load.priceArs.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
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
                            <DropdownMenuLabel>Gestión de Carga</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(load.id, 'on_route')}>
                              <Truck className="w-4 h-4 mr-2" /> Iniciar Viaje
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(load.id, 'delivered')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar Entregada
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => deleteDoc(doc(db!, "loads", load.id))}>
                              <Trash2 className="w-4 h-4 mr-2" /> Cancelar Pedido
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
