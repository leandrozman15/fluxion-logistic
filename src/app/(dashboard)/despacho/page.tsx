'use client';

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, doc, setDoc, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Zap, 
  Truck, 
  Building2, 
  Loader2, 
  Navigation, 
  Route as RouteIcon,
  Layers,
  MapPin,
  ChevronRight,
  ArrowRightLeft,
  MoveRight,
  Anchor,
  Globe,
  Plus,
  Trash2,
  ListOrdered
} from "lucide-react";
import { Client, Truck as TruckType, Hub, OptimizedRouteProposal, Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { optimizeDistribution } from "@/services/route-optimizer";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Carga dinámica del mapa para evitar errores de SSR
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin" /></div> }
);
const TileLayer = dynamic(() => import("react-leaflet").then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((mod) => mod.Marker), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((mod) => mod.Polyline), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), { ssr: false });

export default function DespachoInteligentePage() {
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const [selectedEndHubId, setSelectedEndHubId] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proposals, setProposals] = useState<OptimizedRouteProposal[] | null>(null);
  const [planDate, setPlanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [L, setL] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const clientsQuery = useMemo(() => db ? query(collection(db, "clients"), orderBy("name")) : null, [db]);
  const trucksQuery = useMemo(() => db ? query(collection(db, "trucks"), orderBy("plate")) : null, [db]);
  const hubsQuery = useMemo(() => db ? query(collection(db, "hubs"), orderBy("name")) : null, [db]);

  const { data: clients, loading: loadingClients } = useCollection<Client>(clientsQuery);
  const { data: trucks, loading: loadingTrucks } = useCollection<TruckType>(trucksQuery);
  const { data: hubs, loading: loadingHubs } = useCollection<Hub>(hubsQuery);

  // Iconos para el mapa
  const hubIcon = (isMain: boolean) => L ? L.divIcon({
    className: 'custom-hub-icon',
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900'} text-white p-1 rounded shadow-lg border border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>'}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  }) : null;

  const clientIcon = (number: number) => L ? L.divIcon({
    className: 'custom-client-icon',
    html: `<div class="bg-green-600 text-white w-6 h-6 rounded-full shadow-lg border-2 border-white flex items-center justify-center font-bold text-[10px]">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  }) : null;

  // Seleccionar sede principal por defecto
  useEffect(() => {
    if (hubs && hubs.length > 0 && !selectedHubId) {
      const main = hubs.find(h => h.isMainBase);
      setSelectedHubId(main ? main.id : hubs[0].id);
      setSelectedEndHubId(main ? main.id : hubs[0].id);
    }
  }, [hubs, selectedHubId]);

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);
  const endHub = useMemo(() => hubs?.find(h => h.id === selectedEndHubId), [hubs, selectedEndHubId]);

  const handleToggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleTruck = (id: string) => {
    setSelectedTrucks(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRunOptimization = async () => {
    if (!activeHub || !endHub) {
      toast({ variant: "destructive", title: "Sedes Requeridas", description: "Seleccione origen y destino final para la flota." });
      return;
    }
    if (selectedClients.length === 0 || selectedTrucks.length === 0) {
      toast({ variant: "destructive", title: "Selección incompleta", description: "Elija al menos un camión y un destino." });
      return;
    }

    setIsOptimizing(true);
    try {
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

      const sanitizedStartHub = {
        id: activeHub.id,
        name: activeHub.name,
        address: activeHub.address,
        lat: activeHub.lat,
        lng: activeHub.lng,
        province: activeHub.province,
        city: activeHub.city,
        country: activeHub.country,
        phone: activeHub.phone
      };

      const sanitizedEndHub = {
        id: endHub.id,
        name: endHub.name,
        address: endHub.address,
        lat: endHub.lat,
        lng: endHub.lng,
        province: endHub.province,
        city: endHub.city,
        country: endHub.country,
        phone: endHub.phone
      };
      
      const result = await optimizeDistribution(
        sanitizedClients as any, 
        sanitizedTrucks as any, 
        sanitizedStartHub as any,
        sanitizedEndHub as any
      );
      
      setProposals(result);
      toast({ title: "Plan de Rutas Generado", description: "La IA ha distribuido los destinos eficientemente considerando el final de ruta." });
    } catch (e: any) {
      console.error("Optimization error:", e);
      toast({ variant: "destructive", title: "Error de Optimización", description: "Ocurrió un error al procesar los datos." });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleConfirmAndCreateLoads = async () => {
    if (!db || !proposals || !activeHub || !endHub) return;
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
          isRoundTrip: activeHub.id !== endHub.id,
          origin: {
            name: activeHub.name,
            address: activeHub.address,
            province: activeHub.province,
            city: activeHub.city,
            country: activeHub.country,
            phone: activeHub.phone,
            contact: "Despacho",
            zip: "",
            instructions: "",
            lat: activeHub.lat,
            lng: activeHub.lng
          },
          returnDestination: {
            name: endHub.name,
            address: endHub.address,
            province: endHub.province,
            city: endHub.city,
            country: endHub.country,
            phone: endHub.phone,
            contact: "Base Final",
            zip: "",
            instructions: "Fin de Jornada",
            lat: endHub.lat,
            lng: endHub.lng
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
          updatedAt: serverTimestamp(),
          tracking: {
            currentLat: 0, currentLng: 0, currentSpeed: 0, avgSpeed: 0, maxSpeed: 0,
            distanceTraveledKm: 0, distanceRemainingKm: prop.totalDistanceKm,
            timeOnRouteMinutes: 0, timeStoppedMinutes: 0, lastUpdateAt: null,
            history: [], alerts: []
          }
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
          <p className="text-slate-500 text-sm">Optimización de ruteo secuencial y balanceo de flota.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
           <div className="space-y-1 w-full sm:w-auto">
              <Label className="text-[10px] uppercase font-bold text-slate-400">Fecha de Operación</Label>
              <Input 
                type="date" 
                className="bg-white h-9 w-full sm:w-40" 
                value={planDate} 
                onChange={e => setPlanDate(e.target.value)} 
              />
           </div>
           <Button 
            className="bg-blue-600 shadow-lg shadow-blue-100 h-9 w-full sm:w-auto font-bold" 
            onClick={handleRunOptimization}
            disabled={isOptimizing || selectedClients.length === 0}
           >
             {isOptimizing ? <Loader2 className="animate-spin mr-2" /> : <RouteIcon className="mr-2" />}
             Optimizar Entregas
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
             <CardHeader className="bg-slate-900 text-white py-4">
                <CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2">
                  <MapPin size={16} className="text-blue-400" /> Puntos de Control de Ruta
                </CardTitle>
             </CardHeader>
             <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">1. Sede de Origen (Partida)</Label>
                  <Select value={selectedHubId} onValueChange={setSelectedHubId}>
                     <SelectTrigger className="bg-slate-50">
                        <SelectValue placeholder="Seleccionar Origen" />
                     </SelectTrigger>
                     <SelectContent>
                        {hubs?.map(hub => (
                          <SelectItem key={hub.id} value={hub.id}>
                            {hub.name} {hub.isMainBase ? '(HQ)' : ''}
                          </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">2. Destino Final (Fin de Jornada)</Label>
                  <Select value={selectedEndHubId} onValueChange={setSelectedEndHubId}>
                     <SelectTrigger className="bg-slate-50">
                        <SelectValue placeholder="Seleccionar Destino Final" />
                     </SelectTrigger>
                     <SelectContent>
                        {hubs?.map(hub => (
                          <SelectItem key={hub.id} value={hub.id}>
                            {hub.name} {hub.isMainBase ? '(HQ)' : ''}
                          </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
                </div>

                {activeHub && endHub && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1">
                     <div className="flex items-center gap-2 text-[10px] font-bold text-blue-700">
                        <MoveRight size={12}/> Trayecto Maestro
                     </div>
                     <p className="text-[10px] text-blue-600 italic">
                        {activeHub.name} → Entregas → {endHub.name}
                     </p>
                  </div>
                )}
             </CardContent>
          </Card>

          <Card className="border-none shadow-sm h-[400px] flex flex-col">
            <CardHeader className="bg-slate-50 border-b py-4">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Building2 size={16} className="text-blue-600" /> 3. Destinos a Repartir
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
                 <Truck size={16} className="text-blue-600" /> 4. Flota Disponible
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-y-auto">
               <div className="divide-y divide-slate-100">
                 {loadingTrucks ? (
                   <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
                 ) : (
                   trucks?.filter(t => t.status === 'available').length === 0 ? (
                     <p className="p-10 text-center text-xs text-slate-400 italic">No hay camiones disponibles.</p>
                   ) : (
                     trucks?.filter(t => t.status === 'available').map(truck => (
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
                     ))
                   )
                 )}
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!proposals ? (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-2xl border-2 border-dashed border-slate-200">
               <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-300">
                  <Layers size={40} />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-bold text-slate-700 italic">Optimización de Rutas Inteligente</h3>
                 <p className="text-sm text-slate-400 max-w-sm">Defina Origen y Destino Final, elija flota y destinos, luego presione "Optimizar Entregas".</p>
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proposals.map((prop, idx) => {
                    // Generar puntos para el mapa de esta propuesta
                    const routePoints = mounted && activeHub && endHub ? [
                      [activeHub.lat, activeHub.lng] as [number, number],
                      ...prop.stops.map(s => [s.address.lat!, s.address.lng!] as [number, number]),
                      [endHub.lat, endHub.lng] as [number, number]
                    ] : [];

                    return (
                      <Card key={prop.truckId} className="border-none shadow-xl overflow-hidden flex flex-col rounded-2xl">
                        {/* Mapa de la Ruta Sugerida */}
                        <div className="h-44 w-full relative bg-slate-100 border-b">
                           {mounted && routePoints.length > 1 && (
                             <MapContainer 
                               center={routePoints[0]} 
                               zoom={6} 
                               className="h-full w-full"
                               zoomControl={false}
                               dragging={true}
                               scrollWheelZoom={false}
                             >
                               <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                               <Polyline positions={routePoints} color="#2563eb" weight={4} dashArray="5, 10" />
                               <Marker position={routePoints[0]} icon={hubIcon(true)} />
                               {prop.stops.map((s, sIdx) => (
                                 <Marker key={s.id} position={[s.address.lat!, s.address.lng!]} icon={clientIcon(sIdx + 1)} />
                               ))}
                               <Marker position={routePoints[routePoints.length - 1]} icon={hubIcon(activeHub?.id === endHub?.id)} />
                             </MapContainer>
                           )}
                           <div className="absolute top-2 right-2 z-[500]">
                              <Badge className="bg-white/90 text-blue-600 border shadow-sm text-[8px] font-black uppercase">Secuencia GPS</Badge>
                           </div>
                        </div>

                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div>
                                  <CardTitle className="text-lg font-black font-mono flex items-center gap-2">
                                    <Truck size={18} className="text-blue-600" /> {prop.truckPlate}
                                  </CardTitle>
                                  <CardDescription className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Ruta Propuesta #{idx + 1}</CardDescription>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{prop.stops.length} Paradas</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1">
                            <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 gap-4">
                              <div className="space-y-0.5">
                                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Recorrido Est.</span>
                                  <p className="font-black text-slate-800 text-sm">{prop.totalDistanceKm} KM</p>
                              </div>
                              <div className="space-y-0.5 text-right">
                                  <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Tiempo Total</span>
                                  <p className="font-black text-slate-800 text-sm">{prop.estimatedDurationMinutes} min</p>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5"><ListOrdered size={12}/> Secuencia Lógica de Entrega</p>
                              <div className="space-y-2 relative pl-4 border-l-2 border-dashed border-blue-100 dark:border-slate-800 ml-1">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Salida: {activeHub?.name}</div>
                                  {prop.stops.map((s, sIdx) => (
                                    <div key={s.id} className="relative">
                                      <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm flex items-center justify-center text-[6px] font-black text-white">{sIdx + 1}</div>
                                      <div className="text-xs font-bold text-slate-700">{s.name}</div>
                                      <p className="text-[9px] text-slate-400 truncate">{s.address.city}, {s.address.province}</p>
                                    </div>
                                  ))}
                                  <div className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 pt-1"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Fin en: {endHub?.name}</div>
                              </div>
                            </div>
                        </CardContent>
                      </Card>
                    );
                  })}
               </div>

               <div className="p-6 bg-slate-900 text-white rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/30">
                        <RouteIcon size={32} />
                     </div>
                     <div>
                        <p className="text-xl font-black italic tracking-tighter">CONFIRMAR PLAN MAESTRO</p>
                        <p className="text-xs text-white/50">Se generarán {proposals.filter(p => p.stops.length > 0).length} fletes secuenciales para la fecha {planDate}.</p>
                     </div>
                  </div>
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700 w-full md:w-auto font-black h-16 px-10 rounded-2xl shadow-xl shadow-green-900/40 text-lg italic"
                    onClick={handleConfirmAndCreateLoads}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Zap size={20} className="mr-2" />}
                    EMITIR ÓRDENES
                  </Button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
