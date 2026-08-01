
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
  Grid3X3,
  Container,
  PackageCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  Camera,
  Archive,
  ChevronRight,
  XCircle,
  Clock,
  ScanBarcode
} from "lucide-react";
import { Hub, WarehouseLayout, Product } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function LayoutContent() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const hubIdFromUrl = searchParams.get('hubId');
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIdFromUrl || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [compactMode, setCompactMode] = useState(false);

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

  // Mock de Estructura para el diseño solicitado
  const MOCK_STRUCTURE = [
    { corridor: 'A', positions: ['01', '02', '03', '04'], levels: ['01', '02'] },
    { corridor: 'B', positions: ['01', '02', '03', '04'], levels: ['01', '02'] },
    { corridor: 'C', positions: ['01', '02', '03', '04'], levels: ['01', '02'] },
    { corridor: 'D', positions: ['01', '02', '03', '04'], levels: ['01', '02'] },
  ];

  const prefix = activeHub?.name.substring(0, 10).toUpperCase() || "DEPO";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sedes')} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Control de Almacenamiento</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Operaciones • {activeHub?.name || 'Seleccione Sede'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase border-slate-200">
             <Camera size={14} className="mr-2" /> Registro con Cámara
           </Button>
           <Button className="bg-blue-600 h-10 rounded-xl font-black text-[10px] uppercase shadow-lg px-6">
             Configurar Layout
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Total Posiciones</p>
                 <p className="text-2xl font-black italic text-slate-900">32</p>
               </div>
               <LayoutGrid size={24} className="text-slate-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between text-green-600">
               <div>
                 <p className="text-[10px] font-bold opacity-60 uppercase">Disponibles</p>
                 <p className="text-2xl font-black italic">32</p>
               </div>
               <CheckCircle2 size={24} className="opacity-20" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between text-blue-600">
               <div>
                 <p className="text-[10px] font-bold opacity-60 uppercase">Ocupadas</p>
                 <p className="text-2xl font-black italic">0</p>
               </div>
               <Container size={24} className="opacity-20" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-red-50">
            <CardContent className="p-4 flex items-center justify-between text-red-700">
               <div>
                 <p className="text-[10px] font-bold opacity-60 uppercase">Reservado/Bloqueado</p>
                 <p className="text-2xl font-black italic">0</p>
               </div>
               <XCircle size={24} className="opacity-20" />
            </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         {/* BARRA DE BÚSQUEDA Y FILTROS */}
         <div className="lg:col-span-12">
            <Card className="border-none shadow-md overflow-hidden bg-white">
               <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Buscar por dirección, producto, SKU o lote..." 
                      className="pl-9 h-10 rounded-xl bg-slate-50 border-none text-xs font-bold"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                     <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10 w-44 rounded-xl text-xs font-bold bg-slate-50 border-none">
                           <Filter size={14} className="mr-2" />
                           <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="all">Todos los status</SelectItem>
                           <SelectItem value="available">Disponible</SelectItem>
                           <SelectItem value="occupied">Ocupado</SelectItem>
                           <SelectItem value="blocked">Bloqueado</SelectItem>
                        </SelectContent>
                     </Select>
                     <Button 
                      variant="outline" 
                      className={cn("h-10 rounded-xl text-[9px] font-black uppercase tracking-tighter", compactMode ? "bg-slate-900 text-white" : "")}
                      onClick={() => setCompactMode(!compactMode)}
                     >
                       Mapa Compacto: {compactMode ? 'ON' : 'OFF'}
                     </Button>
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* LEYENDA */}
         <div className="lg:col-span-12 flex flex-wrap gap-4 px-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500"></div><span className="text-[10px] font-black text-slate-400 uppercase">Disponible</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-600"></div><span className="text-[10px] font-black text-slate-400 uppercase">Ocupado</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-500"></div><span className="text-[10px] font-black text-slate-400 uppercase">Reservado</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-600"></div><span className="text-[10px] font-black text-slate-400 uppercase">Bloqueado</span></div>
         </div>

         {/* GRILLA DE CORREDORES */}
         <div className="lg:col-span-12 space-y-8">
            {MOCK_STRUCTURE.map(corridor => (
              <div key={corridor.corridor} className="space-y-4">
                 <div className="flex items-center gap-3 px-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-lg italic">
                       {corridor.corridor}
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-800 uppercase italic leading-none">Corredor {corridor.corridor}</h3>
                       <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Posiciones 01-04</p>
                    </div>
                 </div>

                 <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
                    <Table>
                       <TableHeader className="bg-slate-50/50">
                          <TableRow>
                             <TableHead className="w-24 text-[10px] font-black uppercase text-center border-r">Posición</TableHead>
                             {corridor.levels.map(lvl => (
                               <TableHead key={lvl} className="text-[10px] font-black uppercase text-center">Nivel {lvl}</TableHead>
                             ))}
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {corridor.positions.map(pos => (
                            <TableRow key={pos}>
                               <TableCell className="text-center font-black text-xs text-slate-400 bg-slate-50/30 border-r py-6">
                                 P {pos}
                               </TableCell>
                               {corridor.levels.map(lvl => {
                                 const coordinate = `${prefix}-${corridor.corridor}-${pos}-${lvl}`;
                                 return (
                                   <TableCell key={lvl} className="p-2 border-r last:border-r-0">
                                      <div className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group shadow-sm">
                                         <div className="flex justify-between items-start mb-2">
                                            <span className="text-[9px] font-mono font-black text-slate-400 group-hover:text-blue-600 transition-colors">{coordinate}</span>
                                            <Badge className="bg-green-500 text-white border-none text-[8px] h-3 px-1 uppercase font-black">available</Badge>
                                         </div>
                                         <div className="space-y-1 mt-2">
                                            <div className="flex items-center gap-1 text-[9px] font-black text-slate-300 uppercase">
                                               <Box size={10} /> Sem item
                                            </div>
                                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-slate-200">
                                               <ScanBarcode size={10} /> Sem SKU
                                            </div>
                                         </div>
                                         <div className="mt-3 pt-2 border-t border-slate-50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600"><Plus size={12}/></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400"><Info size={12}/></Button>
                                         </div>
                                      </div>
                                   </TableCell>
                                 );
                               })}
                            </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                    <div className="bg-slate-100/50 py-3 px-8 flex items-center gap-3">
                       <ArrowRightLeft size={16} className="text-slate-300" />
                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pasaje / Corredor</span>
                    </div>
                 </Card>
              </div>
            ))}
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

