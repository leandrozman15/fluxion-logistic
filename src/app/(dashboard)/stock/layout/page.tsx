
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, serverTimestamp, collection, setDoc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  PackageCheck
} from "lucide-react";
import { Hub, WarehouseLayout, WarehouseSection, WarehouseAisle, WarehouseRack, WarehouseSlot } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function WarehouseLayoutPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  
  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeRackId, setActiveRackId] = useState<string | null>(null);

  const hubsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "hubs"), orderBy("name"));
  }, [db, tenantId]);

  const { data: hubs, loading: hubsLoading } = useCollection<Hub>(hubsQuery);

  const [layout, setLayout] = useState<Partial<WarehouseLayout>>({
    name: "Mapa de Depósito Principal",
    sections: []
  });

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);

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
      const layoutRef = doc(db, "tenants", tenantId, "warehouse_layouts", layoutId);
      
      await setDoc(layoutRef, {
        ...layout,
        id: layoutId,
        hubId: selectedHubId,
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, "tenants", tenantId, "hubs", selectedHubId), {
        "settings.layoutId": layoutId
      });

      toast({ title: "Layout Guardado", description: "El mapa físico ha sido sincronizado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar layout" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Mapeo de Depósito</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Configuración técnica de estanterías y ubicaciones fijas.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedHubId} onValueChange={setSelectedHubId}>
            <SelectTrigger className="w-64 bg-white h-11 border-slate-200 rounded-2xl shadow-sm font-bold">
              <SelectValue placeholder="Seleccionar Depósito..." />
            </SelectTrigger>
            <SelectContent>
              {hubs?.filter(h => h.type === 'warehouse' || h.type === 'hub').map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="bg-blue-600 h-11 rounded-2xl font-black px-6 shadow-xl shadow-blue-100" onClick={handleSaveLayout} disabled={isSaving || !selectedHubId}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />} GUARDAR MAPA
          </Button>
        </div>
      </div>

      {!selectedHubId ? (
        <Card className="border-none shadow-sm bg-slate-50/50 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-center space-y-6">
           <Warehouse size={80} className="text-slate-200" />
           <div className="space-y-4">
             <div>
               <h3 className="text-xl font-black text-slate-400 uppercase italic tracking-widest">Seleccione un Depósito para empezar</h3>
               <p className="text-sm text-slate-400 max-w-sm mx-auto">Debe elegir una sede habilitada para configurar su distribución física de racks.</p>
             </div>
             {hubs && hubs.length === 0 && (
               <Button className="bg-blue-600 rounded-xl" asChild>
                 <Link href="/sedes"><Plus size={16} className="mr-2" /> CREAR MI PRIMER DEPÓSITO</Link>
               </Button>
             )}
           </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* BARRA DE HERRAMIENTAS / ESTRUCTURA */}
           <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
                 <CardHeader className="bg-slate-900 text-white p-6">
                    <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2">
                       <LayoutGrid size={16} className="text-blue-400" /> Árbol de Estructura
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-4 space-y-4">
                    <Button variant="outline" className="w-full border-dashed border-2 h-12 rounded-xl text-blue-600 font-black text-[10px] uppercase" onClick={addSection}>
                       <Plus size={16} className="mr-2" /> Agregar Sector / Nave
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
                                          onClick={() => setActiveRackId(rack.id)}
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
                    <p className="text-xs font-black text-blue-800 uppercase italic">Digitalización Gemela</p>
                    <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                       Configure aquí la cantidad de niveles (altura) y columnas de cada rack. Esto permitirá a los operarios saber exactamente dónde buscar o guardar un pallet.
                    </p>
                 </div>
              </div>
           </div>

           {/* VISUALIZADOR REALISTA DE RACK */}
           <div className="lg:col-span-8">
              {!activeRackId ? (
                <div className="h-full min-h-[500px] border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-center p-20 bg-white">
                   <Maximize2 size={64} className="text-slate-100 mb-4" />
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Seleccione un rack del árbol para editar su malla</p>
                </div>
              ) : (
                <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white animate-in zoom-in-95 duration-200">
                   <CardHeader className="bg-blue-600 text-white p-8">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                              <Grid3X3 size={32} />
                           </div>
                           <div>
                              <CardTitle className="text-xl font-black italic uppercase tracking-tighter">Editor Visual de Estantería</CardTitle>
                              <CardDescription className="text-white/60 text-[10px] font-bold uppercase">Configuración de Niveles y Celdas</CardDescription>
                           </div>
                        </div>
                        <Badge className="bg-white text-blue-600 border-none font-mono">RACK-ID: {activeRackId}</Badge>
                      </div>
                   </CardHeader>
                   <CardContent className="p-10 space-y-10">
                      <div className="relative">
                         <div className="absolute -inset-4 border-[8px] border-slate-200 rounded-lg pointer-events-none -z-0"></div>
                         
                         <div className="grid grid-cols-5 gap-3 relative z-10">
                            {[1,2,3,4,5].map(col => (
                              <div key={col} className="space-y-3">
                                 {[4,3,2,1].map(lvl => (
                                   <div 
                                    key={`${col}-${lvl}`} 
                                    className="aspect-square bg-slate-50 border-4 border-slate-100 rounded-xl flex flex-col items-center justify-center gap-1 group hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer relative overflow-hidden"
                                   >
                                      <div className="absolute top-1 left-2 text-[8px] font-black text-slate-300">N{lvl}-C{col}</div>
                                      <Container size={24} className="text-slate-200 group-hover:text-blue-300" />
                                      <p className="text-[7px] font-black uppercase text-slate-300">Vacío</p>
                                      <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-300"></div>
                                   </div>
                                 ))}
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Niveles de Altura</Label>
                            <div className="flex items-center gap-4">
                               <Input type="number" defaultValue={4} className="h-12 font-black text-lg text-center bg-slate-50 border-none rounded-xl" />
                               <div className="flex flex-col text-[10px] font-bold text-slate-400">
                                  <span>MAX: 6</span>
                                  <span>MIN: 1</span>
                               </div>
                            </div>
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400">Columnas de Almacén</Label>
                            <div className="flex items-center gap-4">
                               <Input type="number" defaultValue={5} className="h-12 font-black text-lg text-center bg-slate-50 border-none rounded-xl" />
                               <div className="flex flex-col text-[10px] font-bold text-slate-400">
                                  <span>MAX: 12</span>
                                  <span>MIN: 1</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </CardContent>
                   <CardFooter className="bg-slate-50 p-6 flex justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase italic">Cada celda generará una coordenada única para el sistema de picking.</p>
                      <Button variant="ghost" size="sm" className="text-red-500 font-bold" onClick={() => setActiveRackId(null)}><Trash2 size={14} className="mr-2" /> ELIMINAR RACK</Button>
                   </CardFooter>
                </Card>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
