
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
  Filter,
  Camera,
  XCircle,
  ScanBarcode,
  ArrowRightLeft,
  Package,
  Settings2,
  ChevronRight,
  Maximize2
} from "lucide-react";
import { Hub, Product } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Componente de Slot de Rack (Ubicación física individual)
 * Simula visualmente un pallet o un espacio vacío en la estantería.
 */
function RackSlot({ coordinate, status, product }: { coordinate: string, status: string, product?: any }) {
  const isOccupied = status === 'occupied';
  const isBlocked = status === 'blocked';
  const isReserved = status === 'reserved';

  return (
    <div className={cn(
      "relative h-32 w-full border-x-4 border-orange-500 flex flex-col justify-end p-1 transition-all group",
      isBlocked ? "bg-red-50/50" : "bg-slate-50/30 hover:bg-blue-50/50 cursor-pointer"
    )}>
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

  // Formulario de Configuración
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

  // Cargar configuración existente del Hub
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

  // Generar estructura de racks basada en la configuración
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
                               const status = product ? 'occupied' : 'available';
                               
                               return (
                                 <div key={pos} className="w-48">
                                    <RackSlot 
                                      coordinate={coord}
                                      status={status}
                                      product={product}
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

      {/* DIALOG DE CONFIGURACIÓN */}
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
