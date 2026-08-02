
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore, useCollection, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  Package,
  Settings2,
  Trash2
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
      <div className="absolute bottom-0 left-[-4px] right-[-4px] h-2 bg-blue-600 shadow-sm z-10"></div>
      
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden text-center">
        {isOccupied ? (
          <div className="animate-in fade-in zoom-in-95 duration-300 w-full h-full flex flex-col items-center justify-end pb-2">
            <div className="w-[85%] h-16 bg-[#C19A6B] rounded-sm shadow-md border-b-4 border-[#8B4513] flex flex-col items-center justify-center p-1 relative">
               <div className="absolute -top-10 w-full h-12 bg-white border border-slate-200 rounded-sm shadow-sm flex items-center justify-center overflow-hidden">
                  {product?.photoUrl ? (
                    <img src={product.photoUrl} className="w-full h-full object-cover" alt="Item" />
                  ) : (
                    <Package size={24} className="text-slate-300" />
                  )}
               </div>
               <p className="text-[7px] font-black text-[#5C4033] uppercase leading-none mt-2 truncate w-full">
                 {product?.sku || 'CARGADO'}
               </p>
            </div>
          </div>
        ) : isBlocked ? (
          <div className="flex flex-col items-center gap-1 opacity-40">
             <XCircle size={20} className="text-red-500" />
             <span className="text-[8px] font-black text-red-700 uppercase text-center">BLOQUEADO</span>
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
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const hubIdFromUrl = searchParams.get('hubId');
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIdFromUrl || "");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedSlotCoord, setSelectedSlotCoord] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<Partial<WarehouseSlot>>({
    status: 'empty',
    productId: "",
    productSku: "",
    productName: "",
    capacityKg: 1000,
    currentWeightKg: 0
  });

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

  const slotsQuery = useMemo(() => {
    if (!db || !tenantId || !selectedHubId) return null;
    return collection(db, "tenants", tenantId, "hubs", selectedHubId, "slots");
  }, [db, tenantId, selectedHubId]);

  const { data: hubs, loading: hubsLoading } = useCollection<Hub>(hubsQuery);
  const { data: products } = useCollection<Product>(productsQuery);
  const { data: slotsData } = useCollection<WarehouseSlot>(slotsQuery);

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);

  const assignedSlots = useMemo(() => {
    const map: Record<string, WarehouseSlot> = {};
    slotsData?.forEach(s => {
      map[s.coordinate] = s;
    });
    return map;
  }, [slotsData]);

  useEffect(() => {
    if (activeHub?.settings?.layoutConfig) {
      const cfg = activeHub.settings.layoutConfig;
      setConfigForm({
        corridors: Array.isArray(cfg.corridors) ? cfg.corridors.join(',') : (cfg.corridors || "A,B,C"),
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

  const stats = useMemo(() => {
    const total = totalPositions;
    const occupied = Object.values(assignedSlots).filter(s => s.status === 'occupied').length;
    const blocked = Object.values(assignedSlots).filter(s => s.status === 'blocked').length;
    const reserved = Object.values(assignedSlots).filter(s => s.status === 'reserved').length;
    
    return {
      total,
      occupied,
      blocked,
      reserved,
      available: total - occupied - blocked - reserved
    };
  }, [totalPositions, assignedSlots]);

  const handleSaveConfig = async () => {
    if (!db || !tenantId || !selectedHubId) return;
    setIsSaving(true);
    try {
      const corridorsArray = configForm.corridors.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "");
      await updateDoc(doc(db, "tenants", tenantId, "hubs", selectedHubId), {
        "settings.layoutConfig": {
          corridors: corridorsArray,
          positions: configForm.positions,
          levels: configForm.levels,
          prefix: configForm.prefix
        },
        updatedAt: serverTimestamp()
      });
      toast({ title: "Configuración Guardada" });
      setIsConfigOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSlot = (coord: string) => {
    setSelectedSlotCoord(coord);
    const existingData = assignedSlots[coord] || { status: 'empty' };
    setSlotForm({
      coordinate: coord,
      ...existingData,
      currentWeightKg: existingData.productId ? products?.find(p => p.id === existingData.productId)?.unitWeightKg : 0,
      capacityKg: 1000
    });
  };

  const handleSaveSlot = async () => {
    if (!db || !tenantId || !selectedHubId || !selectedSlotCoord) return;
    setIsSaving(true);
    try {
      const slotRef = doc(db, "tenants", tenantId, "hubs", selectedHubId, "slots", selectedSlotCoord);
      await setDoc(slotRef, {
        ...slotForm,
        id: selectedSlotCoord,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Ubicación Actualizada" });
      setSelectedSlotCoord(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearSlot = async () => {
    if (!db || !tenantId || !selectedHubId || !selectedSlotCoord) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "hubs", selectedHubId, "slots", selectedSlotCoord));
      toast({ title: "Ubicación Liberada" });
      setSelectedSlotCoord(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al borrar" });
    } finally {
      setIsSaving(false);
    }
  };

  const prefix = configForm.prefix || activeHub?.name.substring(0, 5).toUpperCase() || "DEPO";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sedes')} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Mapa de Racks Virtual</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control Visual de Estanterías • {activeHub?.name || 'Cargando...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase border-slate-200" onClick={() => setIsConfigOpen(true)}>
             <Settings2 size={14} className="mr-2 text-blue-600" /> Configurar Estructura
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidad Técnica</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.total}</p>
               </div>
               <LayoutGrid size={24} className="text-slate-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-green-600 uppercase">Disponibles</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.available}</p>
               </div>
               <CheckCircle2 size={24} className="text-green-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-600">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-blue-600 uppercase">Ocupados</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.occupied}</p>
               </div>
               <Container size={24} className="text-blue-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-red-600 uppercase">Bloqueados</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.blocked}</p>
               </div>
               <XCircle size={24} className="text-red-100" />
            </CardContent>
         </Card>
      </div>

      <div className="space-y-12">
        {displayRacks.map(rackGroup => (
          <div key={rackGroup.corridor} className="space-y-6">
             <div className="flex items-center gap-4 px-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xl italic tracking-tighter">
                   {rackGroup.corridor}
                </div>
                <div>
                   <h3 className="text-lg font-black text-slate-800 uppercase italic leading-none tracking-tight">Corredor {rackGroup.corridor}</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cuerpos de estantería pesada</p>
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
                           const slot = assignedSlots[coord];
                           const product = slot?.productId ? products?.find(p => p.id === slot.productId) : null;
                           return (
                             <div key={pos} className="w-48">
                                <RackSlot 
                                  coordinate={coord}
                                  status={slot?.status || 'empty'}
                                  product={product}
                                  onClick={() => handleOpenSlot(coord)}
                                />
                             </div>
                           );
                        })}
                        <div className="w-1 h-32 bg-orange-500"></div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedSlotCoord} onOpenChange={(o) => !o && setSelectedSlotCoord(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
           <div className="bg-slate-900 text-white p-8 pb-6">
              <DialogHeader>
                 <div className="flex justify-between items-start">
                   <div>
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Ubicación {selectedSlotCoord}</DialogTitle>
                      <DialogDescription className="text-white/40 text-[10px] font-bold uppercase mt-1">Gestión de status y trazabilidad del slot.</DialogDescription>
                   </div>
                 </div>
              </DialogHeader>
           </div>
           
           <div className="p-8 space-y-6 bg-slate-50">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estado</Label>
                    <Select value={slotForm.status} onValueChange={(v: any) => setSlotForm({...slotForm, status: v})}>
                       <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="empty">🟢 Disponible</SelectItem>
                          <SelectItem value="occupied">🔵 Ocupado</SelectItem>
                          <SelectItem value="reserved">🟡 Reservado</SelectItem>
                          <SelectItem value="blocked">🔴 Bloqueado</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Producto</Label>
                    <Select value={slotForm.productId} onValueChange={v => {
                       const p = products?.find(x => x.id === v);
                       setSlotForm({...slotForm, productId: v, productSku: p?.sku || "", productName: p?.name || "", status: 'occupied'});
                    }}>
                       <SelectTrigger className="bg-white"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                       <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>
              </div>
           </div>

           <div className="p-6 bg-white border-t flex justify-between">
              <Button variant="outline" className="text-red-600" onClick={handleClearSlot}><Trash2 size={16} className="mr-2" /> LIBERAR</Button>
              <div className="flex gap-2">
                 <Button variant="ghost" onClick={() => setSelectedSlotCoord(null)}>CANCELAR</Button>
                 <Button onClick={handleSaveSlot} disabled={isSaving} className="bg-blue-600">
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic">Configuración de Racks</DialogTitle>
           </DialogHeader>
           <div className="space-y-6 py-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase">Pasillos (Ej: A,B,C)</Label>
                 <Input value={configForm.corridors} onChange={e => setConfigForm({...configForm, corridors: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Cuerpos</Label><Input type="number" value={configForm.positions} onChange={e => setConfigForm({...configForm, positions: parseInt(e.target.value) || 0})} /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Niveles</Label><Input type="number" value={configForm.levels} onChange={e => setConfigForm({...configForm, levels: parseInt(e.target.value) || 0})} /></div>
              </div>
           </div>
           <DialogFooter>
              <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveConfig} className="bg-blue-600">GUARDAR ESTRUCTURA</Button>
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
