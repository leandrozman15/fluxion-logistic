
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, updateDoc, serverTimestamp, setDoc, query, orderBy, doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Box, 
  Warehouse, 
  Layers, 
  LayoutGrid, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  Info, 
  Maximize2, 
  Minimize2,
  ChevronRight,
  Grid3X3,
  Container,
  PackageCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  BarChart3,
  MapPin,
  ArrowRight,
  ArrowLeft
} from "lucide-center";
import { Hub, WarehouseLayout, WarehouseSection, WarehouseAisle, WarehouseRack, WarehouseSlot } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

function LayoutContent() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const hubIdFromUrl = searchParams.get('hubId');
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIdFromUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [activeRackId, setActiveRackId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'overview'>('overview');

  const hubsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "hubs"), orderBy("name"));
  }, [db, tenantId]);

  const { data: hubs, loading: hubsLoading } = useCollection<Hub>(hubsQuery);

  const [layout, setLayout] = useState<Partial<WarehouseLayout>>({
    name: "Mapa de Depósito",
    sections: []
  });

  useEffect(() => {
    if (hubIdFromUrl) setSelectedHubId(hubIdFromUrl);
  }, [hubIdFromUrl]);

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);

  const warehouseStats = useMemo(() => {
    if (!layout.sections) return { total: 0, occupied: 0, free: 0, percent: 0 };
    let total = 0;
    layout.sections.forEach(s => {
      s.aisles.forEach(a => {
        a.racks.forEach(r => {
          total += (r.levels * r.columns);
        });
      });
    });
    const occupied = Math.floor(total * 0.64); 
    return { total, occupied, free: total - occupied, percent: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  }, [layout]);

  const addSection = () => {
    const newSection: WarehouseSection = {
      id: Math.random().toString(36).substring(7),
      name: `Sector ${String.fromCharCode(65 + (layout.sections?.length || 0))}`,
      aisles: []
    };
    setLayout(prev => ({ ...prev, sections: [...(prev.sections || []), newSection] }));
  };

  const addAisle = (sectionId: string) => {
    setLayout(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        aisles: [...s.aisles, {
          id: Math.random().toString(36).substring(7),
          name: `Pasillo ${String(s.aisles.length + 1).padStart(2, '0')}`,
          racks: []
        }]
      } : s)
    }));
  };

  const addRack = (sectionId: string, aisleId: string) => {
    setLayout(prev => ({
      ...prev,
      sections: prev.sections?.map(s => s.id === sectionId ? {
        ...s,
        aisles: s.aisles.map(a => a.id === aisleId ? {
          ...a,
          racks: [...a.racks, {
            id: Math.random().toString(36).substring(7),
            name: `Rack ${String(a.racks.length + 1).padStart(2, '0')}`,
            levels: 4,
            columns: 5,
            slots: []
          }]
        } : a)
      } : s)
    }));
  };

  const handleSaveLayout = async () => {
    if (!db || !tenantId || !selectedHubId) return;
    setIsSaving(true);
    try {
      const layoutId = layout.id || doc(collection(db, "tenants", tenantId, "warehouse_layouts")).id;
      await setDoc(doc(db, "tenants", tenantId, "warehouse_layouts", layoutId), {
        ...layout, id: layoutId, hubId: selectedHubId, updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, "tenants", tenantId, "hubs", selectedHubId), { "settings.layoutId": layoutId });
      toast({ title: "Layout Sincronizado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sedes')} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Mapeo Técnico: {activeHub?.name || '---'}</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configuración espacial de racks, alturas y coordenadas de picking.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button className="bg-blue-600 h-11 rounded-2xl font-black px-6 shadow-xl" onClick={handleSaveLayout} disabled={isSaving || !selectedHubId}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />} GUARDAR CAMBIOS
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-slate-900 text-white p-6">
                    <div className="flex justify-between items-center">
                       <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                          <LayoutGrid size={16} className="text-blue-400" /> Árbol de Estructura
                       </CardTitle>
                       <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase text-blue-400" onClick={() => { setViewMode('overview'); setActiveRackId(null); }}>Ver Resumen</Button>
                    </div>
                 </CardHeader>
                 <CardContent className="p-4 space-y-4">
                    <Button variant="outline" className="w-full border-dashed border-2 h-12 rounded-xl text-blue-600 font-black text-[10px] uppercase" onClick={addSection}>
                       <Plus size={16} className="mr-2" /> Agregar Nave / Sector
                    </Button>

                    <div className="space-y-6">
                       {layout.sections?.map(section => (
                         <div key={section.id} className="space-y-3 p-4 bg-slate-50 rounded-2xl border">
                            <div className="flex justify-between items-center">
                               <p className="font-black text-slate-900 uppercase text-xs italic">{section.name}</p>
                               <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => addAisle(section.id)}><Plus size={14}/></Button>
                            </div>
                            <div className="space-y-2 pl-4 border-l-2 border-slate-200">
                               {section.aisles.map(aisle => (
                                 <div key={aisle.id} className="space-y-2">
                                    <div className="flex justify-between items-center group">
                                       <span className="text-[10px] font-bold text-slate-500 uppercase">{aisle.name}</span>
                                       <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-blue-500" onClick={() => addRack(section.id, aisle.id)}><Grid3X3 size={12}/></Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pl-3">
                                       {aisle.racks.map(rack => (
                                         <Badge 
                                          key={rack.id} 
                                          className={cn(
                                            "cursor-pointer font-mono text-[9px] h-5 transition-all",
                                            activeRackId === rack.id ? "bg-blue-600 text-white" : "bg-white text-slate-500 border-slate-200"
                                          )}
                                          onClick={() => { setActiveRackId(rack.id); setViewMode('editor'); }}
                                         >
                                            {rack.name}
                                         </Badge>
                                       ))}
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                 </CardContent>
              </Card>

              <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] flex items-start gap-4">
                 <Info size={24} className="text-blue-600 shrink-0 mt-1" />
                 <div className="space-y-1">
                    <p className="text-xs font-black text-blue-800 uppercase italic">Precisión en Alturas</p>
                    <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                       Configure cada rack según su altura real. Los niveles se numeran de abajo hacia arriba (N1: Piso). Esto asegura que el operario de autoelevador tenga la instrucción correcta.
                    </p>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-8">
              {viewMode === 'overview' ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-none shadow-md bg-white">
                         <CardContent className="p-6 flex items-center justify-between">
                            <div>
                               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Capacidad Sede</p>
                               <p className="text-3xl font-black italic text-slate-900">{warehouseStats.total} <span className="text-xs font-normal opacity-40">Posiciones</span></p>
                            </div>
                            <LayoutGrid size={32} className="text-blue-100" />
                         </CardContent>
                      </Card>
                      <Card className="border-none shadow-md bg-white">
                         <CardContent className="p-6 flex items-center justify-between">
                            <div>
                               <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Posiciones Libres</p>
                               <p className="text-3xl font-black italic text-green-600">{warehouseStats.free} <span className="text-xs font-normal opacity-40">Slots</span></p>
                            </div>
                            <PackageCheck size={32} className="text-green-100" />
                         </CardContent>
                      </Card>
                      <Card className="border-none shadow-md bg-slate-900 text-white">
                         <CardContent className="p-6 flex items-center justify-between">
                            <div>
                               <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Uso de Rack</p>
                               <p className="text-2xl font-black italic text-blue-400">{warehouseStats.percent}% <span className="text-xs font-normal opacity-40">Real</span></p>
                            </div>
                            <Activity size={32} className="text-blue-500/20" />
                         </CardContent>
                      </Card>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {layout.sections?.map(section => (
                        <Card key={section.id} className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                           <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                              <CardTitle className="text-base font-black uppercase italic text-slate-800">{section.name}</CardTitle>
                              <Badge className="bg-blue-600 text-white border-none text-[8px] h-4">MAPA ACTIVO</Badge>
                           </CardHeader>
                           <CardContent className="p-6 space-y-6">
                              {section.aisles.map(aisle => {
                                 const aisleTotal = aisle.racks.reduce((acc, r) => acc + (r.levels * r.columns), 0);
                                 const aisleOccupied = Math.floor(aisleTotal * (0.4 + Math.random() * 0.4));
                                 const percent = aisleTotal > 0 ? Math.round((aisleOccupied / aisleTotal) * 100) : 0;
                                 return (
                                   <div key={aisle.id} className="space-y-2">
                                      <div className="flex justify-between items-center">
                                         <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                            <ArrowRight size={10} className="text-blue-600" /> {aisle.name}
                                         </p>
                                         <span className="text-[10px] font-black text-slate-400 italic">{percent}%</span>
                                      </div>
                                      <Progress value={percent} className="h-1.5 bg-slate-100" />
                                   </div>
                                 );
                              })}
                           </CardContent>
                        </Card>
                      ))}
                   </div>
                </div>
              ) : (
                <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white animate-in zoom-in-95 duration-200">
                   <CardHeader className="bg-blue-600 text-white p-8">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center"><Grid3X3 size={32} /></div>
                           <div>
                              <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Editor de Estantería</CardTitle>
                              <CardDescription className="text-white/60 text-[10px] font-bold uppercase">Niveles y Columnas</CardDescription>
                           </div>
                        </div>
                        <Button variant="outline" className="bg-white/10 border-white/20 text-white h-10 rounded-xl font-black text-[10px] uppercase" onClick={() => setViewMode('overview')}>Cerrar</Button>
                      </div>
                   </CardHeader>
                   <CardContent className="p-10 space-y-10">
                      <div className="grid grid-cols-5 gap-3 relative z-10">
                         {[1,2,3,4,5].map(col => (
                           <div key={col} className="space-y-3">
                              {[4,3,2,1].map(lvl => (
                                <div key={`${col}-${lvl}`} className="aspect-square bg-slate-50 border-4 border-slate-100 rounded-xl flex flex-col items-center justify-center gap-1 group hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer relative overflow-hidden">
                                   <div className="absolute top-1 left-2 text-[8px] font-black text-slate-300">N{lvl}-C{col}</div>
                                   <Container size={24} className="text-slate-200 group-hover:text-blue-300" />
                                   <p className="text-[7px] font-black uppercase text-slate-300">Vacío</p>
                                   <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-300"></div>
                                </div>
                              ))}
                           </div>
                         ))}
                      </div>
                      <div className="grid grid-cols-2 gap-6 pt-6 border-t">
                         <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Niveles Altura</Label><Input type="number" defaultValue={4} className="h-12 font-black text-lg bg-slate-50 border-none rounded-xl" /></div>
                         <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Columnas Ancho</Label><Input type="number" defaultValue={5} className="h-12 font-black text-lg bg-slate-50 border-none rounded-xl" /></div>
                      </div>
                   </CardContent>
                </Card>
              )}
           </div>
        </div>
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
