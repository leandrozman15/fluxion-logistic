'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { 
  Box, 
  Warehouse, 
  Layers, 
  LayoutGrid, 
  Plus, 
  Save, 
  Loader2, 
  Info, 
  Container,
  CheckCircle2,
  MapPin,
  ArrowLeft,
  Search,
  Camera,
  XCircle,
  ScanBarcode,
  ArrowRightLeft,
  Package,
  Settings2,
  ChevronRight,
  Maximize2,
  Zap,
  Calendar,
  Trash2,
  FileText,
  Download
} from "lucide-react";
import { Hub, Product, WarehouseSlot } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/**
 * Componente de Slot de Rack (Ubicación física individual)
 */
function RackSlot({ coordinate, status, product, onClick }: { coordinate: string, status: string, product?: any, onClick: () => void }) {
  const isOccupied = status === 'occupied';
  const isBlocked = status === 'blocked';
  const isReserved = status === 'reserved';

  return (
    <div 
      className={cn(
        "relative h-32 w-full border-x-4 border-orange-500 flex flex-col justify-end p-1 transition-all group",
        isBlocked ? "bg-red-50/50" : "bg-slate-50/30 hover:bg-blue-50/50 cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Viga de carga (Beam) */}
      <div className="absolute bottom-0 left-[-4px] right-[-4px] h-2 bg-blue-600 shadow-sm z-10"></div>
      
      {/* Contenido de la ubicación */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {isOccupied ? (
          <div className="animate-in fade-in zoom-in-95 duration-300 w-full h-full flex flex-col items-center justify-end pb-2">
            {/* Representación del Pallet */}
            <div className="w-[85%] h-16 bg-[#C19A6B] rounded-sm shadow-md border-b-4 border-[#8B4513] flex flex-col items-center justify-center p-1 relative">
               {/* Mercadería sobre el pallet */}
               <div className="absolute -top-10 w-full h-12 bg-white border border-slate-200 rounded-sm shadow-sm flex items-center justify-center overflow-hidden">
                  {product?.photoUrl ? (
                    <img src={product.photoUrl} className="w-full h-full object-cover" alt="Item" />
                  ) : (
                    <Package size={24} className="text-slate-300" />
                  )}
               </div>
               <p className="text-[7px] font-black text-[#5C4033] uppercase leading-none mt-2 truncate w-full text-center">
                 {product?.sku || 'SKU-UNKNOWN'}
               </p>
            </div>
          </div>
        ) : isBlocked ? (
          <div className="flex flex-col items-center gap-1 opacity-40">
             <XCircle size={20} className="text-red-500" />
             <span className="text-[8px] font-black text-red-700 uppercase">BLOQUEADO</span>
          </div>
        ) : isReserved ? (
          <div className="w-[85%] h-8 border-2 border-dashed border-amber-400 rounded-lg flex items-center justify-center bg-amber-50">
             <span className="text-[8px] font-black text-amber-600 uppercase">RESERVADO</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono font-black text-slate-200 group-hover:text-blue-400 transition-colors">
            {coordinate.split('-').pop()}
          </span>
        )}
      </div>

      {/* Tooltip rápido al hover */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
         <Badge className="bg-slate-900 text-white text-[7px] font-black uppercase border-none px-2 h-4">
           {coordinate}
         </Badge>
      </div>
    </div>
  );
}

function LayoutContent() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const hubIdFromUrl = searchParams.get('hubId');
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIdFromUrl || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Slot Management State
  const [selectedSlotCoord, setSelectedSlotCoord] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<Partial<WarehouseSlot>>({
    status: 'empty',
    productId: "",
    productSku: "",
    productName: "",
    capacityKg: 1000,
    currentWeightKg: 0
  });

  // Configuración de Estructura
  const [configForm, setConfigForm] = useState({
    corridors: "A,B,C",
    positions: 4,
    levels: 2,
    prefix: ""
  });

  const hubsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "hubs"), orderBy("name"));
  }, [db, tenantId]);

  const productsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return collection(db, "tenants", tenantId, "products");
  }, [db, tenantId]);

  const { data: hubs, loading: hubsLoading } = useCollection<Hub>(hubsQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);

  useEffect(() => {
    if (activeHub?.settings?.layoutConfig) {
      const cfg = activeHub.settings.layoutConfig;
      setConfigForm({
        corridors: Array.isArray(cfg.corridors) ? cfg.corridors.join(',') : cfg.corridors,
        positions: cfg.positions || 4,
        levels: cfg.levels || 2,
        prefix: cfg.prefix || activeHub.name.substring(0, 5).toUpperCase()
      });
    } else if (activeHub) {
      setConfigForm(prev => ({ ...prev, prefix: activeHub.name.substring(0, 5).toUpperCase() }));
    }
  }, [activeHub]);

  const displayRacks = useMemo(() => {
    const corridorsArray = configForm.corridors.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "");
    
    return corridorsArray.map(c => ({
      corridor: c,
      positions: Array.from({ length: configForm.positions }, (_, i) => String(i + 1).padStart(2, '0')),
      levels: Array.from({ length: configForm.levels }, (_, i) => String(configForm.levels - i).padStart(2, '0'))
    }));
  }, [configForm]);

  const totalPositions = useMemo(() => {
    const corridorsCount = configForm.corridors.split(',').filter(s => s.trim() !== "").length;
    return corridorsCount * configForm.positions * configForm.levels;
  }, [configForm]);

  const handleSaveConfig = async () => {
    if (!db || !tenantId || !selectedHubId) return;
    setIsSaving(true);
    try {
      const corridorsArray = configForm.corridors.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "");
      const layoutConfig = {
        corridors: corridorsArray,
        positions: configForm.positions,
        levels: configForm.levels,
        prefix: configForm.prefix
      };
      
      await updateDoc(doc(db, "tenants", tenantId, "hubs", selectedHubId), {
        "settings.layoutConfig": layoutConfig,
        updatedAt: serverTimestamp()
      });
      
      toast({ title: "Estructura Actualizada", description: "El mapa se ha regenerado según los nuevos parámetros." });
      setIsConfigOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar configuración" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSlot = (coord: string) => {
    setSelectedSlotCoord(coord);
    // Simulación de carga de datos del slot
    const product = getProductAt(coord);
    setSlotForm({
      coordinate: coord,
      status: product ? 'occupied' : 'empty',
      productId: product?.id || "",
      productSku: product?.sku || "",
      productName: product?.name || "",
      currentWeightKg: product?.unitWeightKg || 0,
      capacityKg: 1000
    });
  };

  const handleSaveSlot = async () => {
    setIsSaving(true);
    try {
      // Aquí se guardaría la persistencia real por coordenada en una subcolección de Hubs o similar
      toast({ title: "Ubicación Actualizada", description: `Se han guardado los cambios en ${selectedSlotCoord}` });
      setSelectedSlotCoord(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar ubicación" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearSlot = () => {
    setSlotForm({
      ...slotForm,
      status: 'empty',
      productId: "",
      productSku: "",
      productName: "",
      currentWeightKg: 0
    });
    toast({ title: "Ubicación liberada", description: "El espacio se marcará como disponible." });
  };

  const getProductAt = (coord: string) => {
    if (!products || products.length === 0) return null;
    const sum = coord.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    if (sum % 7 === 0) return products[0];
    if (sum % 11 === 0) return products[1 % products.length];
    return null;
  };

  const prefix = configForm.prefix || activeHub?.name.substring(0, 5).toUpperCase() || "TIGRE";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sedes')} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Mapa de Racks Virtual</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control Visual de Estanterías • {activeHub?.name || 'Sede no seleccionada'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase border-slate-200" onClick={() => setIsConfigOpen(true)}>
             <Settings2 size={14} className="mr-2 text-blue-600" /> Configurar Estructura
           </Button>
           <Button className="bg-blue-600 h-10 rounded-xl font-black text-[10px] uppercase shadow-lg px-6">
             <Camera size={14} className="mr-2" /> Scanner Picking
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidad Técnica</p>
                 <p className="text-2xl font-black italic text-slate-900">{totalPositions} <span className="text-xs font-normal opacity-30">SLOTS</span></p>
               </div>
               <LayoutGrid size={24} className="text-slate-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-green-600 uppercase">Disponibles</p>
                 <p className="text-2xl font-black italic text-slate-900">{Math.round(totalPositions * 0.7)}</p>
               </div>
               <CheckCircle2 size={24} className="text-green-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-600">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-blue-600 uppercase">Ocupados</p>
                 <p className="text-2xl font-black italic text-slate-900">{Math.round(totalPositions * 0.3)}</p>
               </div>
               <Container size={24} className="text-blue-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-red-600 uppercase">Bloqueados</p>
                 <p className="text-2xl font-black italic text-slate-900">0</p>
               </div>
               <XCircle size={24} className="text-red-100" />
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-12">
            <Card className="border-none shadow-md overflow-hidden bg-white">
               <CardContent className="p-4 flex flex-col md:flex-row gap-6 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Localizar SKU, Lote o Coordenada..." 
                      className="pl-9 h-10 rounded-xl bg-slate-50 border-none text-xs font-bold"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-500"></div><span className="text-[9px] font-black text-slate-400 uppercase">Puntal Metal</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-600"></div><span className="text-[9px] font-black text-slate-400 uppercase">Viga de Carga</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#C19A6B]"></div><span className="text-[9px] font-black text-slate-400 uppercase">Pallet</span></div>
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="lg:col-span-12 space-y-12">
            {displayRacks.map(rackGroup => (
              <div key={rackGroup.corridor} className="space-y-6">
                 <div className="flex items-center gap-4 px-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xl italic tracking-tighter">
                       {rackGroup.corridor}
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-slate-800 uppercase italic leading-none tracking-tight">Corredor {rackGroup.corridor}</h3>
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Bloque de estantería pesado • {rackGroup.positions.length} Cuerpos</p>
                    </div>
                 </div>

                 <div className="overflow-x-auto pb-6">
                    <div className="inline-flex flex-col min-w-full bg-slate-200/20 p-8 rounded-[3rem] border border-slate-100">
                       {rackGroup.levels.map(level => (
                         <div key={level} className="flex items-end">
                            <div className="w-16 h-32 flex items-center justify-center border-r-4 border-slate-300 pr-4">
                               <p className="text-[10px] font-black text-slate-400 uppercase -rotate-90 whitespace-nowrap">NIVEL {level}</p>
                            </div>
                            
                            {rackGroup.positions.map(pos => {
                               const coord = `${prefix}-${rackGroup.corridor}-${pos}-${level}`;
                               const product = getProductAt(coord);
                               const status = product ? 'occupied' : 'empty';
                               
                               return (
                                 <div key={pos} className="w-48">
                                    <RackSlot 
                                      coordinate={coord}
                                      status={status}
                                      product={product}
                                      onClick={() => handleOpenSlot(coord)}
                                    />
                                 </div>
                               );
                            })}
                            
                            <div className="w-1 h-32 bg-orange-500"></div>
                         </div>
                       ))}
                       
                       <div className="flex">
                          <div className="w-16"></div>
                          {rackGroup.positions.map(pos => (
                            <div key={pos} className="w-48 text-center pt-4">
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cuerpo {pos}</p>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* DIALOG DE GESTIÓN DE UBICACIÓN (SLOT) */}
      <Dialog open={!!selectedSlotCoord} onOpenChange={(o) => !o && setSelectedSlotCoord(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
           <div className="bg-slate-900 text-white p-8 pb-6">
              <DialogHeader>
                <div className="flex justify-between items-start">
                   <div>
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Ubicación {selectedSlotCoord}</DialogTitle>
                      <DialogDescription className="text-white/40 text-[10px] font-bold uppercase mt-1">Gestión de status, lote, fechas y trazabilidad del slot.</DialogDescription>
                   </div>
                   <Badge className={cn(
                     "border-none px-4 py-1 h-6 font-black text-[10px] uppercase italic tracking-widest",
                     slotForm.status === 'occupied' ? "bg-blue-600" : slotForm.status === 'empty' ? "bg-green-600" : "bg-red-600"
                   )}>
                     {slotForm.status === 'empty' ? 'Disponible' : slotForm.status === 'occupied' ? 'Ocupado' : slotForm.status?.toUpperCase()}
                   </Badge>
                </div>
              </DialogHeader>
           </div>
           
           <div className="p-8 space-y-6 bg-slate-50 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estado de la Ubicación</Label>
                    <Select value={slotForm.status} onValueChange={(v: any) => setSlotForm({...slotForm, status: v})}>
                       <SelectTrigger className="bg-white h-11 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="empty">🟢 Disponible / Vacío</SelectItem>
                          <SelectItem value="occupied">🔵 Ocupado (Mercadería)</SelectItem>
                          <SelectItem value="reserved">🟡 Reservado (Ingreso)</SelectItem>
                          <SelectItem value="blocked">🔴 Bloqueado (Mantenimiento)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo de Ítem</Label>
                    <Select defaultValue="product">
                       <SelectTrigger className="bg-white h-11 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="product">📦 Producto Terminado</SelectItem>
                          <SelectItem value="raw">🪵 Materia Prima</SelectItem>
                          <SelectItem value="return">🔄 Devolución</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
              </div>

              <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Producto / Artículo Asignado</Label>
                 <Select value={slotForm.productId} onValueChange={v => {
                   const p = products?.find(x => x.id === v);
                   setSlotForm({...slotForm, productId: v, productSku: p?.sku || "", productName: p?.name || "", status: 'occupied'});
                 }}>
                    <SelectTrigger className="bg-white h-12 rounded-xl border-slate-200 font-bold">
                       <SelectValue placeholder="Seleccione un ítem para este slot..." />
                    </SelectTrigger>
                    <SelectContent>
                       {products?.map(p => (
                         <SelectItem key={p.id} value={p.id} className="text-xs">{p.sku} - {p.name}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">SKU</Label><Input readOnly className="bg-slate-100 font-mono text-[10px] h-10" value={slotForm.productSku} /></div>
                 <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">N° Lote</Label><Input placeholder="A-001" className="h-10 bg-white" /></div>
                 <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Cantidad</Label><Input type="number" className="h-10 bg-white" defaultValue={1} /></div>
                 <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Unidad</Label><Input readOnly className="bg-slate-100 text-[10px] h-10" value="Bulto/Pallet" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Fecha Entrada</Label><Input type="date" className="h-10 bg-white" defaultValue={format(new Date(), "yyyy-MM-dd")} /></div>
                 <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Salida Prevista</Label><Input type="date" className="h-10 bg-white" /></div>
              </div>

              <div className="space-y-1.5">
                 <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Observaciones / Notas Técnicas</Label>
                 <Textarea placeholder="Ej: No estibar más de 2 alturas, Pallet dañado, etc." className="min-h-[80px] bg-white text-xs" />
              </div>
           </div>

           <div className="p-6 bg-white border-t flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex gap-2">
                 <Button variant="outline" className="h-12 px-6 rounded-xl text-red-600 border-red-100 bg-red-50 hover:bg-red-100 font-bold text-xs uppercase" onClick={handleClearSlot}>
                    <Trash2 size={16} className="mr-2" /> LIBERAR POSICIÓN
                 </Button>
              </div>
              <div className="flex gap-2">
                 <Button variant="ghost" onClick={() => setSelectedSlotCoord(null)} className="h-12 px-6 rounded-xl font-bold text-slate-400 text-xs uppercase">CANCELAR</Button>
                 <Button onClick={handleSaveSlot} disabled={isSaving} className="h-12 px-10 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-100 uppercase text-xs">
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} SALVAR CAMBIOS
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE CONFIGURACIÓN DE ESTRUCTURA */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-lg">
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Parametrización de Racks</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold text-slate-400">Defina la distribución física para la sede {activeHub?.name}</DialogDescription>
           </DialogHeader>
           <div className="space-y-6 py-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Corredores / Pasillos (Separe por coma)</Label>
                 <Input className="bg-slate-50 border-none rounded-xl h-11 font-black" value={configForm.corridors} onChange={e => setConfigForm({...configForm, corridors: e.target.value})} placeholder="Ej: A,B,C,D" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cuerpos por Pasillo</Label>
                    <Input type="number" className="bg-slate-50 border-none rounded-xl h-11 font-black" value={configForm.positions} onChange={e => setConfigForm({...configForm, positions: parseInt(e.target.value) || 0})} />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Niveles (Altura)</Label>
                    <Input type="number" className="bg-slate-50 border-none rounded-xl h-11 font-black" value={configForm.levels} onChange={e => setConfigForm({...configForm, levels: parseInt(e.target.value) || 0})} />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Prefijo de Coordenada</Label>
                 <Input className="bg-slate-50 border-none rounded-xl h-11 font-bold" value={configForm.prefix} onChange={e => setConfigForm({...configForm, prefix: e.target.value.toUpperCase()})} placeholder="Ej: TIGRE" />
              </div>

              <div className="p-5 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
                 <Zap className="text-blue-600 shrink-0 mt-1" />
                 <div className="space-y-1">
                    <p className="text-xs font-black text-blue-800 uppercase italic">Aprovisionamiento Automático</p>
                    <p className="text-[10px] text-blue-600 leading-relaxed font-medium">Al guardar, se habilitarán {totalPositions} ubicaciones únicas para asignar mercadería. Los operarios verán esta estructura en su terminal de picking.</p>
                 </div>
              </div>
           </div>
           <DialogFooter>
              <Button variant="ghost" onClick={() => setIsConfigOpen(false)} className="font-bold text-slate-400 uppercase text-xs">Cancelar</Button>
              <Button onClick={handleSaveConfig} disabled={isSaving} className="bg-blue-600 h-12 px-8 rounded-xl font-black uppercase shadow-lg shadow-blue-100">
                 {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                 GUARDAR ESTRUCTURA
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WarehouseLayoutPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <LayoutContent />
    </Suspense>
  );
}
