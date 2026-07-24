
'use client';

import { useState, useMemo, useEffect } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Truck, Plus, Search, MoreHorizontal, Trash2, Edit2, MapPin, Gauge, Loader2, 
  ChevronRight, ChevronLeft, Info, InfoIcon, ShieldCheck, Box, Thermometer, Droplets, 
  Anchor, Layers, Scale, Fuel, Timer, Calendar, CheckCircle2, AlertTriangle, Crosshair
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Truck as TruckType, TruckStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BRANDS = {
  "Scania": ["R450", "R500", "G410", "P320", "S500"],
  "Volvo": ["FH540", "FMX460", "FH420", "FM330"],
  "Mercedes-Benz": ["Actros 2651", "Axor 2544", "Atego 1722"],
  "Iveco": ["Stralis Hi-Way", "Trakker", "Tector 170E28"],
  "Volkswagen": ["Constellation 19.330", "Delivery 9.170"],
  "Ford": ["Cargo 1723", "Cargo 1933"],
  "Otro": ["Personalizado"]
};

const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", 
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", 
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
  "Santiago del Estero", "Tierra del Fuego", "Tucumán"
];

const BODY_TYPES = [
  { id: "furgon", label: "Furgón Cerrado", icon: Box },
  { id: "reefer", label: "Refrigerado", icon: Thermometer },
  { id: "plataforma", label: "Plataforma", icon: Layers },
  { id: "cisterna", label: "Cisterna", icon: Droplets },
  { id: "volquete", label: "Volquete", icon: Anchor },
  { id: "jaula", label: "Jaula", icon: Timer },
];

export default function FlotaPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<TruckType>>({
    plate: "",
    chassis: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    axles: 2,
    vehicleType: "Camión Rígido",
    capacityKg: 0,
    volumeM3: 0,
    dimensions: { length: 0, width: 0, height: 0 },
    bodyType: "furgon",
    grossWeight: 0,
    fuelType: "Diesel",
    tankLiters: 0,
    status: "available",
    location: { city: "", province: "Buenos Aires", lat: 0, lng: 0 },
    vencimientos: { soat: "", rto: "", seguro: "" }
  });

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "trucks"), orderBy("plate"));
  }, [db]);

  const { data: trucks, loading } = useCollection<TruckType>(trucksQuery);

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

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          location: { ...prev.location!, lat: pos.coords.latitude, lng: pos.coords.longitude }
        }));
        toast({ title: "Ubicación obtenida", description: "Coordenadas GPS actualizadas." });
      });
    }
  };

  const handleAddTruck = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const newTruckRef = doc(collection(db, "trucks"));
      await setDoc(newTruckRef, {
        ...formData,
        id: newTruckRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "Registro Exitoso", description: `Unidad ${formData.plate} ingresada al sistema.` });
      setIsAddOpen(false);
      setStep(1);
      setFormData({
        plate: "", chassis: "", brand: "", model: "", year: new Date().getFullYear(),
        axles: 2, vehicleType: "Camión Rígido", capacityKg: 0, volumeM3: 0,
        dimensions: { length: 0, width: 0, height: 0 }, bodyType: "furgon",
        grossWeight: 0, fuelType: "Diesel", tankLiters: 0, status: "available",
        location: { city: "", province: "Buenos Aires" },
        vencimientos: { soat: "", rto: "", seguro: "" }
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al registrar" });
    } finally {
      setIsSubmitting(false);
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

  const isStep1Valid = !!(formData.plate && formData.chassis && formData.brand && formData.model);
  const isStep2Valid = (formData.capacityKg || 0) > 0;

  // Helper function to handle numeric input changes safely
  const handleNumericChange = (field: string, value: string, subField?: string) => {
    const numValue = field === 'capacityKg' || field === 'tankLiters' || field === 'grossWeight' ? parseInt(value) : parseFloat(value);
    const finalValue = isNaN(numValue) ? 0 : numValue;
    
    if (subField) {
      setFormData(prev => ({
        ...prev,
        [field]: { ...((prev as any)[field] || {}), [subField]: finalValue }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: finalValue }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flota de Camiones</h1>
          <p className="text-slate-500 text-sm">Gestión integral de unidades pesadas.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={(v) => { setIsAddOpen(v); if(!v) setStep(1); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Alta de Vehículo Pesado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Truck className="text-blue-600" /> Registro de Nueva Unidad
              </DialogTitle>
              <DialogDescription>Complete los datos técnicos para habilitar el veículo en la red logística.</DialogDescription>
            </DialogHeader>
            
            {/* PROGRESS INDICATOR */}
            <div className="py-4">
              <div className="flex items-center justify-between mb-2">
                {["Identificación", "Especificaciones", "Documentación"].map((label, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                    )}>
                      {step > i + 1 ? <CheckCircle2 size={16} /> : i + 1}
                    </div>
                    <span className={cn("text-[10px] uppercase font-bold", step === i+1 ? "text-blue-600" : "text-slate-400")}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(step/3)*100}%` }}></div>
              </div>
            </div>

            {/* STEP 1: IDENTIFICACION */}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">Patente / Matrícula <InfoIcon size={12} className="text-slate-400" /></Label>
                    <Input placeholder="Ej: AE-123-BC" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Chasis (VIN)</Label>
                    <Input placeholder="17 caracteres alfanuméricos" maxLength={17} value={formData.chassis} onChange={e => setFormData({...formData, chassis: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Marca</Label>
                      <Select value={formData.brand} onValueChange={v => setFormData({...formData, brand: v, model: ""})}>
                        <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(BRANDS).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={formData.model} onValueChange={v => setFormData({...formData, model: v})} disabled={!formData.brand}>
                        <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
                        <SelectContent>
                          {formData.brand && (BRANDS as any)[formData.brand]?.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Año de Fabricación</Label>
                    <Select value={formData.year?.toString()} onValueChange={v => setFormData({...formData, year: parseInt(v)})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 37}, (_, i) => 1990 + i).reverse().map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Configuración de Ejes</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[2, 3, 4, 5].map(ax => (
                        <Button 
                          key={ax} 
                          type="button" 
                          variant={formData.axles === ax ? "default" : "outline"} 
                          className="h-10 text-xs justify-start px-3"
                          onClick={() => setFormData({...formData, axles: ax})}
                        >
                          {ax} Ejes {ax > 2 ? "(Tándem)" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: ESPECIFICACIONES */}
            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Capacidad de Carga Máxima (Kg)</Label>
                    <Input 
                      type="number" 
                      placeholder="Ej: 28000" 
                      value={isNaN(formData.capacityKg!) ? '' : formData.capacityKg} 
                      onChange={e => handleNumericChange('capacityKg', e.target.value)} 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Largo (m)</Label>
                      <Input 
                        type="number" 
                        value={isNaN(formData.dimensions?.length!) ? '' : formData.dimensions?.length} 
                        onChange={e => handleNumericChange('dimensions', e.target.value, 'length')} 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Ancho (m)</Label>
                      <Input 
                        type="number" 
                        value={isNaN(formData.dimensions?.width!) ? '' : formData.dimensions?.width} 
                        onChange={e => handleNumericChange('dimensions', e.target.value, 'width')} 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Alto (m)</Label>
                      <Input 
                        type="number" 
                        value={isNaN(formData.dimensions?.height!) ? '' : formData.dimensions?.height} 
                        onChange={e => handleNumericChange('dimensions', e.target.value, 'height')} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Carrocería</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {BODY_TYPES.map(type => (
                        <Button 
                          key={type.id} 
                          type="button" 
                          variant={formData.bodyType === type.id ? "default" : "outline"}
                          className="flex flex-col h-16 gap-1"
                          onClick={() => setFormData({...formData, bodyType: type.id})}
                        >
                          <type.icon size={16} />
                          <span className="text-[9px] uppercase font-bold">{type.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Combustible</Label>
                    <Select value={formData.fuelType} onValueChange={v => setFormData({...formData, fuelType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Diesel">Diésel (Gasoil)</SelectItem>
                        <SelectItem value="GNC">Gas Natural (GNC)</SelectItem>
                        <SelectItem value="Electrico">Eléctrico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacidad Tanque (L)</Label>
                    <Input 
                      type="number" 
                      value={isNaN(formData.tankLiters!) ? '' : formData.tankLiters} 
                      onChange={e => handleNumericChange('tankLiters', e.target.value)} 
                    />
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex gap-2 text-blue-700 mb-1">
                      <Scale size={16} />
                      <span className="text-xs font-bold uppercase">PBV Sugerido</span>
                    </div>
                    <p className="text-[10px] text-blue-600">Basado en {formData.axles} ejes, el Peso Bruto sugerido es {(formData.axles || 2) * 10000} Kg.</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: UBICACION Y DOCS */}
            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <Card className="border-dashed border-2">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Ubicación Base</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Provincia</Label>
                        <Select value={formData.location?.province} onValueChange={v => setFormData({...formData, location: {...formData.location!, province: v}})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ciudad</Label>
                        <Input placeholder="Ej: Rosario" value={formData.location?.city} onChange={e => setFormData({...formData, location: {...formData.location!, city: e.target.value}})} />
                      </div>
                      <Button variant="outline" className="w-full text-xs" size="sm" onClick={handleGetLocation}>
                        <Crosshair size={14} className="mr-2" /> Obtener GPS atual
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Vencimientos Críticos</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vencimiento RTO/ITV</Label>
                        <Input type="date" value={formData.vencimientos?.rto} onChange={e => setFormData({...formData, vencimientos: {...formData.vencimientos!, rto: e.target.value}})} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vencimiento Seguro</Label>
                        <Input type="date" value={formData.vencimientos?.seguro} onChange={e => setFormData({...formData, vencimientos: {...formData.vencimientos!, seguro: e.target.value}})} />
                      </div>
                    </CardContent>
                  </Card>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2">
                    <AlertTriangle className="text-amber-600" size={16} />
                    <p className="text-[10px] text-amber-800 leading-tight">Recuerde que el camión quedará en estado <b>"Disponible"</b> al finalizar el registro.</p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="border-t pt-4">
              <div className="flex justify-between w-full">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <div className="flex gap-2">
                  {step > 1 && <Button variant="outline" onClick={handleBack}><ChevronLeft size={16} /> Anterior</Button>}
                  {step < 3 ? (
                    <Button onClick={handleNext} disabled={step === 1 && !isStep1Valid}>Siguiente <ChevronRight size={16} /></Button>
                  ) : (
                    <Button onClick={handleAddTruck} className="bg-blue-600" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck size={16} className="mr-2" />}
                      Guardar y Finalizar
                    </Button>
                  )}
                </div>
              </div>
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
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Año: {truck.year} • {truck.axles} Ejes</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Gauge className="w-3.5 h-3.5" />
                        <span className="text-sm">{((truck.capacityKg || 0) / 1000).toFixed(1)} TN</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-sm">{truck.location?.city}, {truck.location?.province}</span>
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
                            onClick={() => deleteDoc(doc(db!, "trucks", truck.id))}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </MenuItem>
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
