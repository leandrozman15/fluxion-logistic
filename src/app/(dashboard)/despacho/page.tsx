'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, doc, setDoc, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Zap, 
  Truck, 
  Building2, 
  Loader2, 
  Navigation, 
  Route as RouteIcon,
  Layers
} from "lucide-react";
import { Client, Truck as TruckType, Hub, OptimizedRouteProposal, Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { optimizeDistribution } from "@/services/route-optimizer";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function DespachoInteligentePage() {
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proposals, setProposals] = useState<OptimizedRouteProposal[] | null>(null);
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const trucksQuery = useMemo(() => db ? query(collection(db, "trucks"), orderBy("plate")) : null, [db]);
  const hubsQuery = useMemo(() => db ? query(collection(db, "hubs")) : null, [db]);

  const { data: clients, loading: loadingClients } = useCollection<Client>(clientsQuery);
  const { data: trucks, loading: loadingTrucks } = useCollection<TruckType>(trucksQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);

  const mainHub = useMemo(() => hubs?.find(h => h.isMainBase) || hubs?.[0], [hubs]);

  const handleToggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleTruck = (id: string) => {
    setSelectedTrucks(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRunOptimization = async () => {
    if (!mainHub) {
      toast({ variant: "destructive", title: "Error", description: "Debe configurar al menos una sede base en el sistema." });
      return;
    }
    if (selectedClients.length === 0 || selectedTrucks.length === 0) {
      toast({ variant: "destructive", title: "Selección incompleta", description: "Elija al menos un camión y un destino." });
      return;
    }

    setIsOptimizing(true);
    try {
      // SANITIZACIÓN: Convertimos los objetos complejos de Firebase en objetos planos para la Server Function
      const sanitizedClients = clients
        ?.filter(c => selectedClients.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          address: {
            street: c.address.street,
            number: c.address.number,
            city: c.address.city,
            province: c.address.province,
            country: c.address.country,
            lat: c.address.lat,
            lng: c.address.lng,
          },
          mainContact: c.mainContact ? {
            name: c.mainContact.name,
            phone: c.mainContact.phone
          } : undefined
        })) || [];

      const sanitizedTrucks = trucks
        ?.filter(t => selectedTrucks.includes(t.id))
        .map(t => ({
          id: t.id,
          plate: t.plate,
          assignedDriverId: t.assignedDriverId || 'none'
        })) || [];

      const sanitizedHub = {
        id: mainHub.id,
        name: mainHub.name,
        address: mainHub.address,
        lat: mainHub.lat,
        lng: mainHub.lng,
        province: mainHub.province,
        city: mainHub.city,
        country: mainHub.country,
        phone: mainHub.phone
      };
      
      const result = await optimizeDistribution(
        sanitizedClients as any, 
        sanitizedTrucks as any, 
        sanitizedHub as any
      );
      
      setProposals(result);
      toast({ title: "Plan de Rutas Generado", description: "La IA ha distribuido los destinos eficientemente." });
    } catch (e: any) {
      console.error("Optimization error:", e);
      toast({ variant: "destructive", title: "Error de Optimización", description: "Ocurrió un error al procesar los datos." });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleConfirmAndCreateLoads = async () => {
    if (!db || !proposals || !mainHub) return;
    setIsSaving(true);
    
    try {
      const loadsSnap = await getDocs(query(collection(db, "loads"), orderBy("orderNumber", "desc"), limit(1)));
      let nextSeq = 1;
      if (!loadsSnap.empty) {
        const lastLoad = loadsSnap.docs[0].data() as Load;
        const parts = lastLoad.orderNumber.split("-");
        if (parts.length > 0) {
          const lastNum = parseInt(parts[parts.length - 1]);
          if (!isNaN(lastNum)) nextSeq = lastNum + 1;
        }
      }

      const year = new Date().getFullYear();

      for (const prop of proposals) {
        if (prop.stops.length === 0) continue;

        const orderNum = `FL-${year}-${String(nextSeq).padStart(4, '0')}`;
        nextSeq++;

        const newLoadRef = doc(collection(db, "loads"));
        const loadData: Partial<Load> = {
          id: newLoadRef.id,
          orderNumber: orderNum,
          clientName: prop.stops.length === 1 ? prop.stops[0].name : "Ruta Multi-Cliente",
          status: 'assigned',
          serviceType: 'standard',
          assignedTruckId: prop.truckId,
          assignedDriverId: prop.driverId || 'none',
          pickupDate: planDate,
          pickupTime: "08:00",
          isRoundTrip: false,
          origin: {
            name: mainHub.name,
            address: mainHub.address,
            province: mainHub.province,
            city: mainHub.city,
            country: mainHub.country,
            phone: mainHub.phone,
            contact: "Despacho",
            zip: "",
            instructions: "",
            lat: mainHub.lat,
            lng: mainHub.lng
          },
          outboundStops: prop.stops.map(s => ({
            id: Math.random().toString(36).substring(7),
            name: s.name,
            address: `${s.address.street} ${s.address.number}, ${s.address.city}`,
            province: s.address.province,
            city: s.address.city,
            country: s.address.country,
            contact: s.mainContact?.name || "",
            phone: s.mainContact?.phone || "",
            lat: s.address.lat,
            lng: s.address.lng,
            description: "Reparto Programado",
            weightKg: 0,
            volumeM3: 0,
            units: 0,
            unitType: "Pallet",
            documents: []
          })),
          returnStops: [],
          totalAmount: 0,
          basePrice: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(newLoadRef, loadData);
      }

      toast({ title: "Fletes Creados", description: "Se han generado las órdenes de transporte en el Monitor." });
      router.push('/dashboard');
    } catch (e: any) {
      console.error("Save error:", e);
      toast({ variant: "destructive", title: "Error al guardar rutas" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="text-blue-600" /> Despacho Inteligente
          </h1>
          <p className="text-slate-500 text-sm">Optimización de ruteo y asignación automática de flota.</p>
        </div>
        <div className="flex items-center gap-3">
           <Input 
             type="date" 
             className="bg-white w-40" 
             value={planDate} 
             onChange={e => setPlanDate(e.target.value)} 
           />
           <Button 
            className="bg-blue-600 shadow-lg shadow-blue-100" 
            onClick={handleRunOptimization}
            disabled={isOptimizing || selectedClients.length === 0}
           >
             {isOptimizing ? <Loader2 className="animate-spin mr-2" /> : <RouteIcon className="mr-2" />}
             Optimizar {selectedClients.length} Entregas
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm h-[600px] flex flex-col">
            <CardHeader className="bg-slate-50 border-b py-4">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Building2 size={16} className="text-blue-600" /> 1. Destinos a Repartir
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
               <div className="divide-y divide-slate-100">
                 {loadingClients ? (
                   <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
                 ) : clients?.map(client => (
                   <div 
                    key={client.id} 
                    className={cn(
                      "p-3 flex items-center gap-3 transition-colors cursor-pointer hover:bg-slate-50",
                      selectedClients.includes(client.id) ? "bg-blue-50/50" : ""
                    )}
                    onClick={() => handleToggleClient(client.id)}
                   >
                     <Checkbox checked={selectedClients.includes(client.id)} onCheckedChange={() => handleToggleClient(client.id)} />
                     <div className="min-w-0">
                       <p className="text-sm font-bold text-slate-800 truncate">{client.name}</p>
                       <p className="text-[10px] text-slate-400 truncate">{client.address.city}, {client.address.province}</p>
                     </div>
                   </div>
                 ))}
               </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t py-2 flex justify-between">
               <span className="text-[10px] font-bold text-slate-500">{selectedClients.length} Seleccionados</span>
               <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setSelectedClients([])}>Limpiar</Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="bg-slate-50 border-b py-4">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Truck size={16} className="text-blue-600" /> 2. Flota Disponible
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-y-auto">
               <div className="divide-y divide-slate-100">
                 {loadingTrucks ? (
                   <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
                 ) : trucks?.filter(t => t.status === 'available').map(truck => (
                   <div 
                    key={truck.id} 
                    className={cn(
                      "p-3 flex items-center gap-3 transition-colors cursor-pointer hover:bg-slate-50",
                      selectedTrucks.includes(truck.id) ? "bg-blue-50/50" : ""
                    )}
                    onClick={() => handleToggleTruck(truck.id)}
                   >
                     <Checkbox checked={selectedTrucks.includes(truck.id)} onCheckedChange={() => handleToggleTruck(truck.id)} />
                     <div>
                       <p className="text-sm font-black text-slate-800 font-mono">{truck.plate}</p>
                       <p className="text-[10px] text-slate-400 uppercase">{truck.brand} {truck.model}</p>
                     </div>
                   </div>
                 ))}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!proposals ? (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-xl border-2 border-dashed border-slate-200">
               <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-300">
                  <Layers size={40} />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-bold text-slate-700">Sin Plan de Rutas Activo</h3>
                 <p className="text-sm text-slate-400 max-w-sm">Seleccione los camiones y los destinos a la izquierda, luego presione <b>"Optimizar Entregas"</b> para que la IA proponga las mejores rutas.</p>
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proposals.map((prop, idx) => (
                    <Card key={prop.truckId} className="border-none shadow-md overflow-hidden">
                       <div className="h-2 w-full bg-blue-600"></div>
                       <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                             <div>
                                <CardTitle className="text-lg font-black font-mono flex items-center gap-2">
                                  <Truck size={18} className="text-blue-600" /> {prop.truckPlate}
                                </CardTitle>
                                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Ruta Sugerida #{idx + 1}</CardDescription>
                             </div>
                             <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{prop.stops.length} Destinos</Badge>
                          </div>
                       </CardHeader>
                       <CardContent className="space-y-4">
                          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                             <div className="flex justify-between text-xs">
                                <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Distancia Est.</span>
                                <span className="font-bold text-slate-800">{prop.totalDistanceKm} KM</span>
                             </div>
                             <div className="flex justify-between text-xs">
                                <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Tiempo Jornada</span>
                                <span className="font-bold text-slate-800">{prop.estimatedDurationMinutes} min</span>
                             </div>
                          </div>
                          
                          <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase text-slate-400 px-1">Secuencia de Entrega</p>
                             <div className="space-y-2 relative pl-4 border-l-2 border-dashed border-blue-100">
                                {prop.stops.map((s, sIdx) => (
                                  <div key={s.id} className="relative">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white shadow-sm"></div>
                                    <div className="text-xs font-bold text-slate-700">{s.name}</div>
                                    <p className="text-[10px] text-slate-400 truncate">{s.address.street} {s.address.number}</p>
                                  </div>
                                ))}
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  ))}
               </div>

               <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                        <RouteIcon size={24} />
                     </div>
                     <div>
                        <p className="text-lg font-bold italic">Confirmar Plan Maestro</p>
                        <p className="text-xs text-white/50">Se generarán {proposals.filter(p => p.stops.length > 0).length} órdenes de transporte automáticas.</p>
                     </div>
                  </div>
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700 w-full md:w-auto font-bold h-14 px-8 rounded-xl shadow-xl shadow-green-900/20"
                    onClick={handleConfirmAndCreateLoads}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Zap size={18} className="mr-2" />}
                    CONFIRMAR Y CREAR FLETES
                  </Button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
