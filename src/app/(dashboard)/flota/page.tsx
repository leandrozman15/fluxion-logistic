
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, serverTimestamp, query, orderBy, deleteDoc, doc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Truck, Plus, Search, MoreHorizontal, Trash2, Edit2, MapPin, Gauge, Loader2, 
  ChevronRight, ChevronLeft, InfoIcon, ShieldCheck, Box, Thermometer, Droplets, 
  Anchor, Layers, Scale, Crosshair, CheckCircle2, AlertTriangle, FileText, Fuel
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
];

export default function FlotaPage() {
  const db = useFirestore();
  const router = useRouter();
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
    odometerKm: 0,
    avgConsumption: 32, // L/100km standard
    status: "available",
    location: { city: "", province: "Buenos Aires", lat: 0, lng: 0 }
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
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          location: { ...prev.location!, lat: pos.coords.latitude, lng: pos.coords.longitude, country: "Argentina" }
        }));
        toast({ title: "Ubicación obtenida", description: "Coordenadas GPS atualizadas." });
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
        odometerKm: 0, avgConsumption: 32,
        location: { city: "", province: "Buenos Aires", country: "Argentina" }
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

  const handleNumericChange = (field: string, value: string, subField?: string) => {
    const val = value === "" ? 0 : parseFloat(value);
    const finalValue = isNaN(val) ? 0 : val;
    
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
          <p className="text-slate-500 text-sm">Gestión integral de unidades pesadas y cumplimiento normativo.</p>
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
              <DialogDescription>Complete los datos técnicos para habilitar el vehículo en la red logística.</DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="flex items-center justify-between mb-2">
                {["Identificación", "Especificaciones", "Ubicación"].map((label, i) => (
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

            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">Patente / Matrícula <InfoIcon size={12} className="text-slate-400" /></Label>
                    <Input placeholder="AE-123-BC" value={formData.plate || ''} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Chasis (VIN)</Label>
                    <Input placeholder="17 caracteres" maxLength={17} value={formData.chassis || ''} onChange={e => setFormData({...formData, chassis: e.target.value.toUpperCase()})} />
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
                    <Label>Año</Label>
                    <Select value={formData.year?.toString()} onValueChange={v => setFormData({...formData, year: parseInt(v)})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 37}, (_, i) => 1990 + i).reverse().map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ejes</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[2, 3, 4, 5].map(ax => (
                        <Button 
                          key={ax} 
                          type="button" 
                          variant={formData.axles === ax ? "default" : "outline"} 
                          className="h-10 text-xs"
                          onClick={() => setFormData({...formData, axles: ax})}
                        >
                          {ax} Ejes
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900 text-white rounded-xl space-y-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge size={18} className="text-blue-400" /> Control de Odómetro
                    </CardTitle>
                    <div className="space-y-2">
                      <Label className="text-white/50">Kilometraje Actual (KM)</Label>
                      <Input 
                        type="number" 
                        className="bg-white/5 border-white/20 text-white font-mono text-xl"
                        value={formData.odometerKm ?? 0} 
                        onChange={e => handleNumericChange('odometerKm', e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/50">Consumo Objetivo (L/100km)</Label>
                      <Input 
                        type="number" 
                        className="bg-white/5 border-white/20 text-white"
                        value={formData.avgConsumption ?? 32} 
                        onChange={e => handleNumericChange('avgConsumption', e.target.value)} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacidad de Carga (Kg)</Label>
                    <Input 
                      type="number" 
                      value={formData.capacityKg ?? 0} 
                      onChange={e => handleNumericChange('capacityKg', e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo Carrocería</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BODY_TYPES.map(type => (
                        <Button 
                          key={type.id} 
                          type="button" 
                          variant={formData.bodyType === type.id ? "default" : "outline"}
                          className="flex flex-col h-auto min-h-[70px] gap-2 p-2 text-center"
                          onClick={() => setFormData({...formData, bodyType: type.id})}
                        >
                          <type.icon size={18} />
                          <span className="text-[10px] uppercase font-black leading-tight px-1">{type.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Provincia Base</Label>
                    <Select value={formData.location?.province} onValueChange={v => setFormData({...formData, location: {...formData.location!, province: v, country: "Argentina"}})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVINCIAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Input value={formData.location?.city || ''} onChange={e => setFormData({...formData, location: {...formData.location!, city: e.target.value}})} />
                  </div>
                  <Button variant="outline" className="w-full text-xs" size="sm" onClick={handleGetLocation}>
                    <Crosshair size={14} className="mr-2" /> Capturar GPS Actual
                  </Button>
                </div>
                <div className="space-y-4">
                   <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-blue-700 flex items-center gap-2"><InfoIcon size={14} /> Nota Operativa</p>
                      <p className="text-[10px] text-blue-600 leading-relaxed">
                        Al completar el registro, el sistema inicializará el Checklist Digital de Documentación (VTV, Seguro, Cédula). 
                        Deberá cargar los archivos en el perfil del camión.
                      </p>
                   </div>
                </div>
              </div>
            )}

            <DialogFooter className="border-t pt-4">
              <div className="flex justify-between w-full">
                <Button variant="ghost" type="button" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <div className="flex gap-2">
                  {step > 1 && <Button variant="outline" type="button" onClick={handleBack}><ChevronLeft size={16} /></Button>}
                  {step < 3 ? (
                    <Button type="button" onClick={handleNext}>Siguiente <ChevronRight size={16} /></Button>
                  ) : (
                    <Button type="button" onClick={handleAddTruck} className="bg-blue-600" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck size={16} className="mr-2" />}
                      Guardar y Habilitar
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
              placeholder="Patente, marca o modelo..." 
              className="pl-8 bg-white"
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
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patente / Marca</TableHead>
                  <TableHead>Kilometraje</TableHead>
                  <TableHead>Documentación</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No hay vehículos registrados.</TableCell>
                  </TableRow>
                ) : (
                  filteredTrucks.map((truck) => {
                    const docCount = truck.documentation?.length || 0;
                    const validDocs = truck.documentation?.filter(d => d.status === 'valid').length || 0;
                    const isCritical = truck.documentation?.some(d => d.status === 'expired');

                    return (
                      <TableRow 
                        key={truck.id} 
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => router.push(`/flota/${truck.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                               <Truck size={20} />
                             </div>
                             <div>
                               <div className="font-bold text-slate-900">{truck.plate || ''}</div>
                               <div className="text-[10px] text-slate-400 uppercase font-bold">{truck.brand} {truck.model}</div>
                             </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Gauge size={14} className="text-slate-400" />
                            <span className="font-mono font-bold text-slate-700">{(truck.odometerKm || 0).toLocaleString()} km</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={docCount > 0 ? (validDocs / docCount) * 100 : 0} className="h-1.5 w-16" />
                            <span className={cn("text-[10px] font-bold", isCritical ? "text-red-600" : "text-slate-500")}>
                              {validDocs}/{docCount}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{truck.location?.city || 'N/A'}</TableCell>
                        <TableCell>{getStatusBadge(truck.status)}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Gestión de Unidad</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/flota/${truck.id}`)}>
                                <FileText className="w-4 h-4 mr-2" /> Ver Documentación
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit2 className="w-4 h-4 mr-2" /> Editar Ficha
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                onClick={() => {
                                  if(confirm("¿Eliminar este camión definitivamente?")) {
                                    deleteDoc(doc(db!, "trucks", truck.id));
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Unidad
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
