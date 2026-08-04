
'use client';

import { useState, useMemo, useEffect } from "react";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Building2, MapPin, Plus, Search, 
  MoreVertical, Trash2, Globe, Loader2, Crosshair, Edit2, Save, Warehouse,
  AlertTriangle, Clock, LayoutGrid, CheckCircle2, Container
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Hub, HubType, Country, Product, WarehouseSlot } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createHub, listHubs, updateHub } from "@/lib/hubs-api";
import { listProducts } from "@/lib/products-api";

/**
 * Componente para cargar métricas de ocupación real de una sede
 */
function HubSpaceMetrics({ hub, products }: { hub: Hub, products: Product[] | undefined }) {
  const loading = false;

  const config = hub.settings?.layoutConfig;
  const totalSlots = config ? (config.corridors?.length || 1) * (config.positions || 1) * (config.levels || 1) : 32;

  const occupiedSlots = useMemo(() => {
    if (!products) return 0;

    const withLocation = new Set<string>();
    let noLocationCounter = 0;

    products.forEach((product) => {
      const warehouse = product.warehouses?.find((entry) => entry.hubId === hub.id && entry.stockQuantity > 0);
      if (!warehouse) return;

      if (warehouse.location) {
        withLocation.add(warehouse.location);
      } else {
        noLocationCounter += 1;
      }
    });

    return withLocation.size + noLocationCounter;
  }, [products, hub.id]);

  const blockedSlots = 0;

  const currentStockUnits = useMemo(() => {
    return products?.reduce((acc, p) => {
       const wh = p.warehouses?.find(w => w.hubId === hub.id);
       return acc + (wh?.stockQuantity || 0);
    }, 0) || 0;
  }, [products, hub.id]);

  const occupiedPercent = Math.min(100, Math.round((occupiedSlots / totalSlots) * 100));
  const pieData = [{ value: occupiedPercent }, { value: 100 - occupiedPercent }];

  if (loading) return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-blue-200" /></div>;

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between gap-6">
          <div className="flex-1 space-y-4">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ocupación Física</p>
                <div className="flex items-end gap-2">
                   <p className="text-4xl font-black text-slate-900 italic leading-none">{occupiedPercent}%</p>
                   <Badge className="bg-blue-50 text-blue-700 border-none text-[9px] mb-1">CAPACIDAD</Badge>
                </div>
             </div>
             <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Estado Almacén</p>
                <p className={cn(
                  "text-xs font-black uppercase flex items-center gap-1",
                  occupiedPercent > 90 ? "text-red-600" : "text-green-600"
                )}>
                  {occupiedPercent > 90 ? <AlertTriangle size={12}/> : <CheckCircle2 size={12}/>}
                  {occupiedPercent > 90 ? 'Saturación Crítica' : 'Operación Normal'}
                </p>
             </div>
          </div>
          <div className="h-28 w-28 shrink-0">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                   <Pie data={pieData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                      <Cell fill={occupiedPercent > 90 ? "#ef4444" : "#2563eb"} />
                      <Cell fill="#f1f5f9" />
                   </Pie>
                </PieChart>
             </ResponsiveContainer>
          </div>
       </div>

       <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">
             <span>Métricas de Espacio (Racks)</span>
             <LayoutGrid size={12} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
             <div>
                <p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">Slots Totales</p>
                <p className="text-base font-black text-slate-900 italic leading-none">{totalSlots}</p>
             </div>
             <div className="border-x border-slate-200">
                <p className="text-[7px] font-bold text-blue-500 uppercase mb-0.5">Uso (Físico)</p>
                <p className="text-base font-black text-blue-600 italic leading-none">{occupiedSlots}</p>
             </div>
             <div>
                <p className="text-[7px] font-bold text-green-500 uppercase mb-0.5">Libre</p>
                <p className="text-base font-black text-green-600 italic leading-none">{Math.max(0, totalSlots - occupiedSlots - blockedSlots)}</p>
             </div>
          </div>
       </div>

       <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex justify-between items-center">
          <div className="flex items-center gap-2">
             <Container size={16} className="text-blue-600" />
             <span className="text-[9px] font-black text-blue-800 uppercase">Stock Consolidado:</span>
          </div>
          <span className="text-sm font-black text-blue-900">{currentStockUnits.toLocaleString()} UNIDADES</span>
       </div>
    </div>
  );
}

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];

const HUB_TYPES: { value: HubType; label: string }[] = [
  { value: "warehouse", label: "Depósito" },
  { value: "hub", label: "Hub" },
  { value: "office", label: "Oficina" },
];

const INITIAL_FORM_DATA: Partial<Hub> = {
  name: "", address: "", city: "", province: "", country: "Argentina", type: "warehouse", phone: "", isMainBase: false, lat: -34.6, lng: -58.3
};

export default function SedesPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hubsLoading, setHubsLoading] = useState(true);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState<Partial<Hub>>(INITIAL_FORM_DATA);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setHubs([]);
          setProducts([]);
          setHubsLoading(false);
        }
        return;
      }

      try {
        if (active) setHubsLoading(true);
        const [hubRows, productRows] = await Promise.all([listHubs(), listProducts()]);
        if (!active) return;
        setHubs(hubRows);
        setProducts(productRows);
      } catch (error) {
        if (!active) return;
        setHubs([]);
        setProducts([]);
        toast({ variant: "destructive", title: "Error al cargar sedes", description: (error as Error).message });
      } finally {
        if (active) setHubsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const filteredHubs = useMemo(() => {
    if (!hubs) return [];
    return hubs.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [hubs, searchTerm]);

  const handleGetLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        toast({ title: "Ubicación capturada" });
      });
    }
  };

  const handleSubmitHub = async () => {
    if (!tenantId || !formData.name) return;
    setIsSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateHub(editingId, formData);
        setHubs((prev) => prev.map((hub) => (hub.id === editingId ? updated : hub)));
      } else {
        const created = await createHub(formData);
        setHubs((prev) => [...prev, created]);
      }
      setFormData(INITIAL_FORM_DATA);
      setEditingId(null);
      setIsDialogOpen(false);
      toast({ title: "Sede guardada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar", description: (e as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Dashboard de Almacenes</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Monitoreo de capacidad, stock y vencimientos por sede regional.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input placeholder="Buscar depósito..." className="w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <Button className="bg-blue-600" onClick={() => { setEditingId(null); setFormData(INITIAL_FORM_DATA); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Sede
          </Button>
        </div>
      </div>

      {hubsLoading ? (
        <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredHubs.map(hub => {
            const criticalStockCount = products?.filter(p => {
               const wh = p.warehouses?.find(w => w.hubId === hub.id);
               return wh && wh.stockQuantity <= (wh.minStock || 5);
            }).length || 0;

            const expiryCount = products?.filter(p => {
               const wh = p.warehouses?.find(w => w.hubId === hub.id);
               return wh && wh.stockQuantity > 0 && p.expiryControl;
            }).length || 0;

            return (
              <Card key={hub.id} className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white group hover:scale-[1.01] transition-all">
                <CardHeader className="bg-slate-900 text-white p-8 relative">
                   <div className="absolute top-0 right-0 p-8 opacity-10"><Building2 size={80}/></div>
                   <div className="flex justify-between items-start relative z-10">
                      <div>
                        <div className="flex items-center gap-2">
                           <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{hub.name}</CardTitle>
                           {hub.isMainBase && <Badge className="bg-amber-500 text-[8px] h-4">BASE HQ</Badge>}
                        </div>
                        <p className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1"><MapPin size={10}/> {hub.city}, {hub.province}</p>
                      </div>
                      <DropdownMenu>
                         <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-white/40"><MoreVertical size={20}/></Button></DropdownMenuTrigger>
                         <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setEditingId(hub.id); setFormData(hub); setIsDialogOpen(true); }}>Editar</DropdownMenuItem></DropdownMenuContent>
                      </DropdownMenu>
                   </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   <HubSpaceMetrics hub={hub} products={products} />

                   <div className="grid grid-cols-2 gap-4">
                      <div className={cn("p-4 rounded-2xl border", expiryCount > 0 ? "bg-orange-50 border-orange-100" : "bg-slate-50")}>
                         <div className="flex justify-between mb-1"><Clock size={14}/><span className="text-lg font-black">{expiryCount}</span></div>
                         <p className="text-[8px] font-black uppercase text-slate-500">Vencimientos</p>
                      </div>
                      <div className={cn("p-4 rounded-2xl border", criticalStockCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50")}>
                         <div className="flex justify-between mb-1"><AlertTriangle size={14}/><span className="text-lg font-black">{criticalStockCount}</span></div>
                         <p className="text-[8px] font-black uppercase text-slate-500">Stock Crítico</p>
                      </div>
                   </div>

                   <Button className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase shadow-lg" asChild>
                      <Link href={`/stock/layout?hubId=${hub.id}`}>
                         <LayoutGrid size={18} className="mr-2 text-blue-400" /> Gestionar Mapa de Racks
                      </Link>
                   </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2.5rem]">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Sede' : 'Nueva Sede'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="Nombre de Sede" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <Input placeholder="Dirección" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Ciudad" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              <Input placeholder="Provincia" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select value={formData.country} onValueChange={(v: any) => setFormData({...formData, country: v})}>
                <SelectTrigger><SelectValue placeholder="País" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue placeholder="Tipo de Sede" /></SelectTrigger>
                <SelectContent>{HUB_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Teléfono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-black text-slate-900">Sede Principal (HQ)</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Marcar como base central de operaciones</p>
              </div>
              <Switch checked={!!formData.isMainBase} onCheckedChange={(v) => setFormData({...formData, isMainBase: v})} />
            </div>
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
               <Button variant="outline" className="w-full text-white border-white/20" onClick={handleGetLocation}>
                  <Crosshair className="w-4 h-4 mr-2" /> CAPTURAR GPS
               </Button>
               <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                     <p className="text-[8px] font-bold text-white/40 uppercase">Latitud</p>
                     <p className="text-xs font-black">{formData.lat?.toFixed(5)}</p>
                  </div>
                  <div>
                     <p className="text-[8px] font-bold text-white/40 uppercase">Longitud</p>
                     <p className="text-xs font-black">{formData.lng?.toFixed(5)}</p>
                  </div>
               </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSubmitHub} disabled={isSubmitting} className="bg-blue-600 w-full h-12 rounded-xl font-black">CONFIRMAR REGISTRO</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
