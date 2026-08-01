
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Package
} from "lucide-react";
import { Hub, Product } from "@/app/lib/types";
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
  const searchParams = useSearchParams();
  
  const hubIdFromUrl = searchParams.get('hubId');
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIdFromUrl || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  // Estructura de racks virtuales (Simulada para visualización)
  const MOCK_RACKS = [
    { corridor: 'A', positions: ['01', '02', '03', '04', '05'], levels: ['03', '02', '01'] },
    { corridor: 'B', positions: ['01', '02', '03', '04', '05'], levels: ['03', '02', '01'] },
  ];

  const prefix = activeHub?.name.substring(0, 5).toUpperCase() || "TIGRE";

  // Simulación de productos en racks para el demo visual
  const getProductAt = (coord: string) => {
    if (!products || products.length === 0) return null;
    // Lógica determinística para el demo
    const sum = coord.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    if (sum % 5 === 0) return products[0];
    if (sum % 7 === 0) return products[1 % products.length];
    return null;
  };

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
           <Button variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase border-slate-200">
             <Camera size={14} className="mr-2" /> Scanner Picking
           </Button>
           <Button className="bg-blue-600 h-10 rounded-xl font-black text-[10px] uppercase shadow-lg px-6">
             Configurar Estructura
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidad Total</p>
                 <p className="text-2xl font-black italic text-slate-900">120 <span className="text-xs font-normal opacity-30">SLOTS</span></p>
               </div>
               <LayoutGrid size={24} className="text-slate-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-green-600 uppercase">Disponibles</p>
                 <p className="text-2xl font-black italic text-slate-900">84</p>
               </div>
               <CheckCircle2 size={24} className="text-green-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-600">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-blue-600 uppercase">Ocupados</p>
                 <p className="text-2xl font-black italic text-slate-900">36</p>
               </div>
               <Container size={24} className="text-blue-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-red-600 uppercase">Bloqueados</p>
                 <p className="text-2xl font-black italic text-slate-900">2</p>
               </div>
               <XCircle size={24} className="text-red-100" />
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* BARRA DE BÚSQUEDA Y LEYENDA */}
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

         {/* RACKS VIRTUALES */}
         <div className="lg:col-span-12 space-y-12">
            {MOCK_RACKS.map(rackGroup => (
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

                 {/* REPRESENTACIÓN DEL RACK */}
                 <div className="overflow-x-auto pb-6">
                    <div className="inline-flex flex-col min-w-full bg-slate-200/20 p-8 rounded-[3rem] border border-slate-100">
                       {rackGroup.levels.map(level => (
                         <div key={level} className="flex items-end">
                            {/* Indicador de Nivel (Vertical) */}
                            <div className="w-16 h-32 flex items-center justify-center border-r-4 border-slate-300 pr-4">
                               <p className="text-[10px] font-black text-slate-400 uppercase -rotate-90 whitespace-nowrap">NIVEL {level}</p>
                            </div>
                            
                            {/* Slots de este nivel */}
                            {rackGroup.positions.map(pos => {
                               const coord = `${prefix}-${rackGroup.corridor}-${pos}-${level}`;
                               const product = getProductAt(coord);
                               const status = product ? 'occupied' : (pos === '05' && level === '01' ? 'blocked' : 'available');
                               
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
                            
                            {/* Puntal final del rack */}
                            <div className="w-1 h-32 bg-orange-500"></div>
                         </div>
                       ))}
                       
                       {/* Base de Suelo y Etiquetas de Posición */}
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

      {/* PANEL LATERAL / INFO INFO */}
      <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-right-8 duration-500">
         <Card className="bg-slate-900 text-white border-none shadow-2xl rounded-[2rem] w-64 overflow-hidden">
            <CardHeader className="bg-blue-600 py-3">
               <CardTitle className="text-[10px] font-black uppercase flex items-center gap-2">
                 <ScanBarcode size={14} /> Auditoría Rápida
               </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
               <div className="space-y-1">
                  <p className="text-[8px] font-bold text-white/40 uppercase">Siguiente Inventario Ciclo</p>
                  <p className="text-xs font-black italic">Sector A - Pasillo 02</p>
               </div>
               <Button className="w-full h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">
                  Comenzar Conteo
               </Button>
            </CardContent>
         </Card>
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
