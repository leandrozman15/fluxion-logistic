
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
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
  MoreVertical, Trash2, Globe, Loader2, Map as MapIcon, Crosshair, Edit2, Save, Warehouse,
  AlertTriangle, Clock, LayoutGrid, CheckCircle2, PackageSearch
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Hub, HubType, Country, Product } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";

const COUNTRIES: Country[] = ["Argentina", "Chile", "Paraguay", "Bolivia", "Uruguay", "Brasil"];
const COLORS = ['#2563eb', '#f1f5f9'];

const INITIAL_FORM_DATA: Partial<Hub> = {
  name: "",
  address: "",
  city: "",
  province: "",
  country: "Argentina",
  type: "warehouse",
  phone: "",
  isMainBase: false,
  lat: -34.6037,
  lng: -58.3816,
  loadingBays: []
};

export default function SedesPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<Hub>>(INITIAL_FORM_DATA);

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

  const filteredHubs = useMemo(() => {
    if (!hubs) return [];
    return hubs.filter(h => 
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.city.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
    if (!db || !tenantId || !formData.name) return;
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "tenants", tenantId, "hubs", editingId), { ...formData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "tenants", tenantId, "hubs"), { ...formData, createdAt: serverTimestamp() });
      }
      setIsDialogOpen(false);
      toast({ title: "Sede guardada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHub = async (id: string) => {
    if (!db || !tenantId || !confirm("¿Eliminar sede?")) return;
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "hubs", id));
      toast({ title: "Sede eliminada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
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
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar depósito..." 
              className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 font-black uppercase text-[11px] h-11 px-6 rounded-2xl" onClick={() => { setEditingId(null); setFormData(INITIAL_FORM_DATA); setIsDialogOpen(true); }}>
            <Plus className="w-5 h-5 mr-2" /> Nueva Sede
          </Button>
        </div>
      </div>

      {hubsLoading ? (
        <div className="p-32 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>
      ) : filteredHubs.length === 0 ? (
        <Card className="border-none shadow-sm bg-slate-50 p-20 flex flex-col items-center justify-center text-center space-y-4">
           <Warehouse size={64} className="text-slate-200" />
           <p className="text-sm font-black text-slate-400 uppercase italic">No hay depósitos registrados para esta organización.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredHubs.map(hub => {
            // CÁLCULO DE INFORMACIÓN REAL
            const config = hub.settings?.layoutConfig;
            
            // 1. Capacidad Técnica (Slots de Rack)
            const totalCapacity = config ? (config.corridors?.length || 1) * (config.positions || 1) * (config.levels || 1) : 100;
            
            // 2. Stock Actual en esta sede
            const currentStock = products?.reduce((acc, p) => {
               const wh = p.warehouses?.find(w => w.hubId === hub.id);
               return acc + (wh?.stockQuantity || 0);
            }, 0) || 0;

            // 3. Alertas de Stock Crítico
            const criticalStockCount = products?.filter(p => {
               const wh = p.warehouses?.find(w => w.hubId === hub.id);
               return wh && wh.stockQuantity <= wh.minStock;
            }).length || 0;

            // 4. Vencimientos Próximos (Lógica basada en expiryControl activo)
            const expiryCount = products?.filter(p => {
               const wh = p.warehouses?.find(w => w.hubId === hub.id);
               return wh && wh.stockQuantity > 0 && p.expiryControl;
            }).length || 0;

            const occupiedPercent = Math.min(100, Math.round((currentStock / totalCapacity) * 100));
            const pieData = [{ value: occupiedPercent }, { value: 100 - occupiedPercent }];

            return (
              <Card key={hub.id} className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white group hover:scale-[1.01] transition-all duration-300">
                <CardHeader className="bg-slate-900 text-white p-8 relative">
                   <div className="absolute top-0 right-0 p-8 opacity-10"><Building2 size={80}/></div>
                   <div className="flex justify-between items-start relative z-10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <CardTitle className="text-xl font-black uppercase italic tracking-tighter">{hub.name}</CardTitle>
                           {hub.isMainBase && <Badge className="bg-amber-500 text-[8px] h-4">BASE HQ</Badge>}
                        </div>
                        <p className="text-[10px] font-bold text-white/40 uppercase flex items-center gap-1"><MapPin size={10}/> {hub.city}, {hub.province}</p>
                      </div>
                      <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white/40 hover:text-white"><MoreVertical size={20}/></Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-2xl">
                            <DropdownMenuItem onClick={() => { setEditingId(hub.id); setFormData(hub); setIsDialogOpen(true); }} className="font-bold"><Edit2 size={14} className="mr-2"/> Editar Datos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`https://google.com/maps?q=${hub.lat},${hub.lng}`)} className="font-bold"><Globe size={14} className="mr-2"/> GPS Google</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteHub(hub.id)} className="text-red-600 font-bold"><Trash2 size={14} className="mr-2"/> Eliminar Sede</DropdownMenuItem>
                         </DropdownMenuContent>
                      </DropdownMenu>
                   </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   {/* CAPACIDAD Y GRÁFICO REAL */}
                   <div className="flex items-center justify-between gap-6">
                      <div className="flex-1 space-y-4">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ocupación Real</p>
                            <div className="flex items-end gap-2">
                               <p className="text-4xl font-black text-slate-900 italic leading-none">{occupiedPercent}%</p>
                               <Badge className="bg-blue-50 text-blue-700 border-none text-[9px] mb-1">CAPACIDAD</Badge>
                            </div>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Estado Operativo</p>
                            <p className={cn(
                              "text-xs font-black uppercase flex items-center gap-1",
                              occupiedPercent > 90 ? "text-red-600" : "text-green-600"
                            )}>
                              {occupiedPercent > 90 ? <AlertTriangle size={12}/> : <CheckCircle2 size={12}/>}
                              {occupiedPercent > 90 ? 'Saturación Crítica' : 'Flujo Normal'}
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
                               <Tooltip content={() => null} />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   {/* MÉTRICAS REALES */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className={cn("p-4 rounded-2xl border transition-all", expiryCount > 0 ? "bg-orange-50 border-orange-100" : "bg-slate-50 border-slate-100")}>
                         <div className="flex justify-between items-center mb-1">
                            <Clock size={14} className={expiryCount > 0 ? "text-orange-500" : "text-slate-300"} />
                            <span className={cn("text-lg font-black italic", expiryCount > 0 ? "text-orange-700" : "text-slate-400")}>{expiryCount}</span>
                         </div>
                         <p className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Vencimientos</p>
                      </div>
                      <div className={cn("p-4 rounded-2xl border transition-all", criticalStockCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100")}>
                         <div className="flex justify-between items-center mb-1">
                            <AlertTriangle size={14} className={criticalStockCount > 0 ? "text-red-500" : "text-slate-300"} />
                            <span className={cn("text-lg font-black italic", criticalStockCount > 0 ? "text-red-700" : "text-slate-400")}>{criticalStockCount}</span>
                         </div>
                         <p className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Stock Crítico</p>
                      </div>
                   </div>

                   <div className="space-y-3 pt-2">
                      <Button className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase italic tracking-widest shadow-lg shadow-slate-200" asChild>
                         <Link href={`/stock/layout?hubId=${hub.id}`}>
                            <LayoutGrid size={18} className="mr-2 text-blue-400" /> Gestionar Mapa de Racks
                         </Link>
                      </Button>
                      <Button variant="outline" className="w-full h-12 rounded-2xl border-slate-200 text-slate-500 font-bold text-[10px] uppercase" asChild>
                         <Link href="/stock">
                            <PackageSearch size={14} className="mr-2" /> Ver Inventario Completo
                         </Link>
                      </Button>
                   </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DIALOG DE ALTA/EDICIÓN */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">{editingId ? 'Editar Parámetros de Sede' : 'Habilitar Nueva Sede'}</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest">Configuración de base operativa y puntos de control.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">País Sede</Label>
                <Select value={formData.country} onValueChange={(v: Country) => setFormData({...formData, country: v})}>
                  <SelectTrigger className="bg-slate-50 border-none rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo de Instalación</Label>
                <Select value={formData.type} onValueChange={(v: HubType) => setFormData({...formData, type: v})}>
                  <SelectTrigger className="bg-slate-50 border-none rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">📦 Depósito de Mercadería</SelectItem>
                    <SelectItem value="hub">🛰️ Centro de Transferencia</SelectItem>
                    <SelectItem value="office">🏢 Sede Administrativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Identificador Público</Label>
              <Input placeholder="Ej: Depósito Norte LogísticaAr" className="bg-slate-50 border-none rounded-xl h-11 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="flex items-center space-x-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
              <Switch checked={formData.isMainBase} onCheckedChange={(v) => setFormData({...formData, isMainBase: v})} />
              <div>
                 <Label className="text-xs font-black uppercase text-blue-800">Sede Principal (CASA MATRIZ)</Label>
                 <p className="text-[9px] text-blue-600 font-medium">Se utilizará como origen predeterminado para fletes nuevos.</p>
              </div>
            </div>

            <div className="grid gap-4">
               <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dirección Física</Label><Input className="bg-slate-50 border-none rounded-xl" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ciudad</Label><Input className="bg-slate-50 border-none rounded-xl" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Provincia</Label><Input className="bg-slate-50 border-none rounded-xl" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} /></div>
               </div>
            </div>

            <div className="p-5 bg-slate-900 text-white rounded-[2rem] space-y-4">
               <div className="flex justify-between items-center">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><MapIcon size={14}/> Geolocalización Maestra</p>
                  <Button variant="outline" size="sm" className="h-7 text-[8px] bg-white/10 border-white/20 text-white" onClick={handleGetLocation}><Crosshair size={10} className="mr-1" /> AUTO-CAPTURAR</Button>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <Input className="bg-white/5 border-white/10 text-xs font-mono h-9" placeholder="Latitud" type="number" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value) || 0})} />
                  <Input className="bg-white/5 border-white/10 text-xs font-mono h-9" placeholder="Longitud" type="number" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value) || 0})} />
               </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-black text-slate-400 text-xs uppercase tracking-widest">CANCELAR</Button>
            <Button onClick={handleSubmitHub} disabled={isSubmitting} className="bg-blue-600 h-14 px-10 rounded-2xl font-black shadow-xl shadow-blue-900/20">
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
              CONFIRMAR REGISTRO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
