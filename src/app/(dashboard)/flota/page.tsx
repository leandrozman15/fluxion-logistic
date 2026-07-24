
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus, Search, MoreHorizontal, Trash2, Edit2, MapPin, Gauge, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Truck as TruckType, TruckStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function FlotaPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    capacityKg: 0,
    status: "available" as TruckStatus,
    location: { city: "", province: "" }
  });

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "trucks"), orderBy("plate"));
  }, [db]);

  const { data: trucks, loading } = useCollection<TruckType>(trucksQuery);

  const filteredTrucks = useMemo(() => {
    if (!trucks) return [];
    return trucks.filter(t => {
      const matchesSearch = t.plate.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.model.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [trucks, searchTerm, statusFilter]);

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "trucks"), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Caminhão cadastrado", description: `A unidade ${formData.plate} foi adicionada à frota.` });
      setIsAddOpen(false);
      setFormData({
        plate: "", brand: "", model: "", year: new Date().getFullYear(),
        capacityKg: 0, status: "available", location: { city: "", province: "" }
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao cadastrar", description: "Verifique a conexão com o banco de dados." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTruck = async (id: string) => {
    if (!db || !confirm("Tem certeza que deseja remover este caminhão?")) return;
    try {
      await deleteDoc(doc(db, "trucks", id));
      toast({ title: "Unidade removida" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao remover" });
    }
  };

  const getStatusBadge = (status: TruckStatus) => {
    switch (status) {
      case 'available': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Disponible</Badge>;
      case 'in_trip': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">En Viaje</Badge>;
      case 'maintenance': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">Mantenimiento</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flota de Camiones</h1>
          <p className="text-slate-500 text-sm">Administración y seguimiento de unidades de transporte.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Nueva Unidad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleAddTruck}>
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Camión</DialogTitle>
                <DialogDescription>Complete los datos técnicos del vehículo para ingresarlo al sistema.</DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="plate">Patente (Argentina)</Label>
                  <Input id="plate" placeholder="Ej: AE-123-BC" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado Inicial</Label>
                  <Select value={formData.status} onValueChange={(v: TruckStatus) => setFormData({...formData, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponible</SelectItem>
                      <SelectItem value="in_trip">En Viaje</SelectItem>
                      <SelectItem value="maintenance">Mantenimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Marca</Label>
                  <Input id="brand" placeholder="Ej: Scania, Volvo, Mercedes" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input id="model" placeholder="Ej: R450" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Año</Label>
                  <Input id="year" type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad (Kg)</Label>
                  <Input id="capacity" type="number" placeholder="Ej: 28000" value={formData.capacityKg} onChange={e => setFormData({...formData, capacityKg: parseInt(e.target.value)})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Provincia Base</Label>
                  <Input id="province" placeholder="Ej: Santa Fe" value={formData.location.province} onChange={e => setFormData({...formData, location: {...formData.location, province: e.target.value}})} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad Base</Label>
                  <Input id="city" placeholder="Ej: Rosario" value={formData.location.city} onChange={e => setFormData({...formData, location: {...formData.location, city: e.target.value}})} required />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Guardar Camión
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              type="search" 
              placeholder="Buscar por patente, marca o modelo..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={statusFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? 'bg-slate-900' : ''}
            >
              Todos
            </Button>
            <Button 
              variant={statusFilter === 'available' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setStatusFilter('available')}
              className={statusFilter === 'available' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Disponibles
            </Button>
            <Button 
              variant={statusFilter === 'in_trip' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setStatusFilter('in_trip')}
              className={statusFilter === 'in_trip' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              En Viaje
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Cargando flota...</p>
            </div>
          ) : filteredTrucks.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <Truck className="w-12 h-12 mx-auto text-slate-200" />
              <p className="text-slate-500">No se encontraron camiones con estos filtros.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="w-[150px]">Patente</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Ubicación Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.map((truck) => (
                  <TableRow key={truck.id} className="group hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <div className="font-bold text-slate-900 border border-slate-200 rounded px-2 py-1 bg-white inline-block shadow-sm">
                        {truck.plate}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{truck.brand} {truck.model}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Año: {truck.year}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Gauge className="w-3.5 h-3.5" />
                        <span className="text-sm">{(truck.capacityKg / 1000).toFixed(1)} TN</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-sm">{truck.location.city}, {truck.location.province}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(truck.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 group-hover:text-slate-600">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel>Gestión</DropdownMenuLabel>
                          <DropdownMenuItem className="cursor-pointer">
                            <Edit2 className="w-4 h-4 mr-2" /> Editar Datos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDeleteTruck(truck.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
