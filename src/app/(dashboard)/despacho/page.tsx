'use client';

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, doc, setDoc, getDocs, limit, writeBatch, where } from "firebase/firestore";
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
  ListOrdered,
  Files,
  Scale,
  Receipt
} from "lucide-react";
import { PendingRemito, Truck as TruckType, Hub, OptimizedRouteProposal, Load } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { optimizeDistribution } from "@/services/route-optimizer";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
  
  const [selectedRemitoIds, setSelectedRemitoIds] = useState<string[]>([]);
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

  // Consulta simplificada para evitar errores de índice
  const remitosQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "pending_remitos"), orderBy("createdAt", "desc"));
  }, [db]);

  const trucksQuery = useMemo(() => db ? query(collection(db, "trucks"), orderBy("plate")) : null, [db]);
  const hubsQuery = useMemo(() => db ? query(collection(db, "hubs"), orderBy("name")) : null, [db]);

  const { data: allRemitos, loading: loadingRemitos } = useCollection<PendingRemito>(remitosQuery);
  const { data: trucks, loading: loadingTrucks } = useCollection<TruckType>(trucksQuery);
  const { data: hubs, loading: loadingHubs } = useCollection<Hub>(hubsQuery);

  // Filtramos remitos pendientes en el cliente
  const remitos = useMemo(() => {
    return allRemitos?.filter(r => r.status === 'pending') || [];
  }, [allRemitos]);

  const hubIcon = (isMain: boolean) => L ? L.divIcon({
    className: 'custom-hub-icon',
    html: `<div class="${isMain ? 'bg-amber-500' : 'bg-slate-900'} text-white p-1 rounded shadow-lg border border-white flex items-center justify-center">${isMain ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>'}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  }) : null;

  const clientIcon = (number: number) => L ? L.divIcon({
    className: 'custom-client-icon',
    html: `<div class="bg-indigo-600 text-white w-6 h-6 rounded-full shadow-lg border-2 border-white flex items-center justify-center font-bold text-[10px]">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  }) : null;

  useEffect(() => {
    if (hubs && hubs.length > 0 && !selectedHubId) {
      const main = hubs.find(h => h.isMainBase);
      setSelectedHubId(main ? main.id : hubs[0].id);
      setSelectedEndHubId(main ? main.id : hubs[0].id);
    }
  }, [hubs, selectedHubId]);

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);
  const endHub = useMemo(() => hubs?.find(h => h.id === selectedEndHubId), [hubs, selectedEndHubId]);

  const handleToggleRemito = (id: string) => {
    setSelectedRemitoIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleTruck = (id: string) => {
    setSelectedTrucks(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRunOptimization = async () => {
    if (!activeHub || !endHub) {
      toast({ variant: "destructive", title: "Sedes Requeridas" });
      return;
    }
    if (selectedRemitoIds.length === 0 || selectedTrucks.length === 0) {
      toast({ variant: "destructive", title: "Selección incompleta", description: "Elija remitos y camiones." });
      return;
    }

    setIsOptimizing(true);
    try {
      const sanitizedStops = remitos
        ?.filter(r => selectedRemitoIds.includes(r.id))
        .map(r => ({
          id: r.id,
          name: r.clientName,
          number: r.number,
          cotNumber: r.cotNumber,
          weightKg: r.weightKg,
          fileUrl: r.fileUrl,
          address: { street: r.address, number: "", city: r.city || "", province: r.province || "", country: "Argentina", lat: r.lat, lng: r.lng }
        })) || [];

      const sanitizedTrucks = trucks
        ?.filter(t => selectedTrucks.includes(t.id))
        .map(t => ({
          id: t.id,
          plate: t.plate,
          assignedDriverId: t.assignedDriverId || 'none',
          avgConsumption: t.avgConsumption || 32
        })) || [];

      // Reutilizamos el motor pero pasándole Remitos
      const result = await optimizeDistribution(
        sanitizedStops as any, 
        sanitizedTrucks as any, 
        activeHub as any,
        endHub as any
      );
      
      setProposals(result);
      toast({ title: "Plan de Rutas Generado", description: "Se han distribuido los remitos por cercanía geográfica." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error de Optimización" });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleConfirmAndCreateLoads = async () => {
    if (!db || !proposals || !activeHub || !endHub) return;
    setIsSaving(true);
    
    try {
      const batch = writeBatch(db);
      const loadsSnap = await getDocs(query(collection(db, "loads"), orderBy("orderNumber", "desc"), limit(1)));
      let nextSeq = 1;
      if (!loadsSnap.empty) {
        const parts = (loadsSnap.docs[0].data() as Load).orderNumber.split("-");
        const lastNum = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
      }

      for (const prop of proposals) {
        if (prop.stops.length === 0) continue;

        const orderNum = `FL-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`;
        nextSeq++;

        const newLoadRef = doc(collection(db, "loads"));
        const loadData: Partial<Load> = {
          id: newLoadRef.id,
          orderNumber: orderNum,
          clientName: prop.stops.length === 1 ? prop.stops[0].clientName : "Reparto Multi-Remito",
          status: 'assigned',
          serviceType: 'standard',
          assignedTruckId: prop.truckId,
          assignedDriverId: prop.driverId || 'none',
          pickupDate: planDate,
          pickupTime: "08:00",
          isRoundTrip: activeHub.id !== endHub.id,
          origin: {
            name: activeHub.name, address: activeHub.address, province: activeHub.province, city: activeHub.city, country: activeHub.country, phone: activeHub.phone, contact: "Tráfico", zip: "", instructions: "", lat: activeHub.lat, lng: activeHub.lng
          },
          returnDestination: {
            name: endHub.name, address: endHub.address, province: endHub.province, city: endHub.city, country: endHub.country, phone: endHub.phone, contact: "Cierre", zip: "", instructions: "", lat: endHub.lat, lng: endHub.lng
          },
          outboundStops: prop.stops.map(r => ({
            id: Math.random().toString(36).substring(7),
            name: r.clientName,
            address: r.address,
            province: r.province || "",
            city: r.city || "",
            country: "Argentina",
            contact: "",
            phone: "",
            lat: r.lat,
            lng: r.lng,
            description: `Entrega Remito #${r.number}`,
            weightKg: r.weightKg,
            volumeM3: 0,
            units: 1,
            unitType: "Bulto",
            documents: [{
              id: Math.random().toString(36).substring(7),
              type: 'remito',
              number: r.number,
              cotNumber: r.cotNumber,
              fileUrl: r.fileUrl,
              uploadedAt: new Date().toISOString(),
              leg: 'outbound'
            }]
          })),
          returnStops: [],
          totalAmount: 0,
          basePrice: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          tracking: {
            currentLat: 0, currentLng: 0, currentSpeed: 0, avgSpeed: 0, maxSpeed: 0, distanceTraveledKm: 0, distanceRemainingKm: prop.totalDistanceKm, timeOnRouteMinutes: 0, timeStoppedMinutes: 0, lastUpdateAt: null, history: [], alerts: []
          }
        };

        batch.set(newLoadRef, loadData);

        // Marcar remitos como despachados
        prop.stops.forEach(r => {
           batch.update(doc(db, "pending_remitos", r.id), { status: 'dispatched', updatedAt: serverTimestamp() });
        });
      }

      await batch.commit();
      toast({ title: "Viajes Emitidos", description: "Los remitos ya están asignados a los choferes." });
      router.push('/dashboard');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al emitir fletes" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="text-blue-600" /> Despacho Automático
          </h1>
          <p className="text-slate-500 text-sm">Organice los remitos cargados por Ventas en rutas logísticas eficientes.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
           <div className="space-y-1 w-full sm:w-auto">
              <Label className="text-[10px] uppercase font-bold text-slate-400">Fecha de Salida</Label>
              <Input type="date" className="bg-white h-9 w-full sm:w-40" value={planDate} onChange={e => setPlanDate(e.target.value)} />
           </div>
           <Button className="bg-blue-600 shadow-lg h-9 w-full sm:w-auto font-bold" onClick={handleRunOptimization} disabled={isOptimizing || selectedRemitoIds.length === 0}>
             {isOptimizing ? <Loader2 className="animate-spin mr-2" /> : <RouteIcon className="mr-2" />}
             Planificar Rutas
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden h-[500px] flex flex-col">
            <CardHeader className="bg-indigo-600 text-white py-4">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Receipt size={16} /> 1. Remitos en Buzón (Ventas)
               </CardTitle>
               <CardDescription className="text-white/60 text-[10px] uppercase">Seleccione los documentos para entregar hoy</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
               <div className="divide-y divide-slate-100">
                 {loadingRemitos ? (
                   <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
                 ) : remitos?.length === 0 ? (
                    <div className="p-20 text-center space-y-2 opacity-30">
                       <Files size={32} className="mx-auto" />
                       <p className="text-xs font-bold uppercase">Buzón Vacío</p>
                    </div>
                 ) : remitos?.map(remito => (
                   <div 
                    key={remito.id} 
                    className={cn("p-4 flex items-start gap-3 transition-colors cursor-pointer hover:bg-slate-50", selectedRemitoIds.includes(remito.id) && "bg-indigo-50/50")}
                    onClick={() => handleToggleRemito(remito.id)}
                   >
                     <Checkbox checked={selectedRemitoIds.includes(remito.id)} className="mt-1" />
                     <div className="min-w-0">
                       <p className="text-sm font-black text-slate-800 tracking-tighter">REM {remito.number}</p>
                       <p className="text-xs font-bold text-indigo-700 truncate uppercase">{remito.clientName}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1"><MapPin size={10}/> {remito.city}</p>
                          <Badge variant="outline" className="text-[8px] h-4 bg-white">{remito.weightKg} KG</Badge>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t py-2 flex justify-between">
               <span className="text-[10px] font-bold text-slate-500">{selectedRemitoIds.length} Remitos Listos</span>
               <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setSelectedRemitoIds([])}>Limpiar</Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
             <CardHeader className="bg-slate-900 text-white py-4"><CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2"><MapPin size={16} className="text-blue-400" /> 2. Control de Sedes</CardTitle></CardHeader>
             <CardContent className="pt-6 space-y-4">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Origen</Label><Select value={selectedHubId} onValueChange={setSelectedHubId}><SelectTrigger className="bg-slate-50"><SelectValue placeholder="Sede Salida" /></SelectTrigger><SelectContent>{hubs?.map(hub => (<SelectItem key={hub.id} value={hub.id}>{hub.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Retorno</Label><Select value={selectedEndHubId} onValueChange={setSelectedEndHubId}><SelectTrigger className="bg-slate-50"><SelectValue placeholder="Sede Cierre" /></SelectTrigger><SelectContent>{hubs?.map(hub => (<SelectItem key={hub.id} value={hub.id}>{hub.name}</SelectItem>))}</SelectContent></Select></div>
             </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="bg-slate-50 border-b py-4"><CardTitle className="text-sm flex items-center gap-2"><Truck size={16} className="text-blue-600" /> 3. Camiones Disponibles</CardTitle></CardHeader>
            <CardContent className="p-0 max-h-[250px] overflow-y-auto">
               <div className="divide-y divide-slate-100">
                 {loadingTrucks ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div> : 
                   trucks?.filter(t => t.status === 'available').map(truck => (
                      <div key={truck.id} className={cn("p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50", selectedTrucks.includes(truck.id) && "bg-blue-50/50")} onClick={() => handleToggleTruck(truck.id)}>
                        <Checkbox checked={selectedTrucks.includes(truck.id)} />
                        <div><p className="text-sm font-black text-slate-800 font-mono">{truck.plate}</p><p className="text-[10px] text-slate-400 uppercase">Capacidad: {(truck.capacityKg/1000).toFixed(1)} TN</p></div>
                      </div>
                   ))
                 }
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!proposals ? (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-300"><Layers size={40} /></div>
               <div className="space-y-2">
                 <h3 className="text-lg font-bold text-slate-700 italic">Automatización de Repartos</h3>
                 <p className="text-sm text-slate-400 max-w-sm">Ventas ya cargó los remitos. Usted solo elija cuáles despachar y qué camiones usar. La IA agrupará los pedidos por zona automáticamente.</p>
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proposals.map((prop, idx) => {
                    const routePoints = mounted && activeHub && endHub ? [
                      [activeHub.lat, activeHub.lng] as [number, number],
                      ...prop.stops.map(s => [s.lat!, s.lng!] as [number, number]),
                      [endHub.lat, endHub.lng] as [number, number]
                    ] : [];

                    return (
                      <Card key={prop.truckId} className="border-none shadow-xl overflow-hidden flex flex-col rounded-3xl">
                        <div className="h-40 w-full relative bg-slate-100 border-b">
                           {mounted && routePoints.length > 1 && (
                             <MapContainer center={routePoints[0]} zoom={8} className="h-full w-full" zoomControl={false} dragging={true} scrollWheelZoom={false}>
                               <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                               <Polyline positions={routePoints} color="#4f46e5" weight={4} dashArray="5, 10" />
                               <Marker position={routePoints[0]} icon={hubIcon(true)} />
                               {prop.stops.map((s, sIdx) => (<Marker key={s.id} position={[s.lat!, s.lng!]} icon={clientIcon(sIdx + 1)} />))}
                               <Marker position={routePoints[routePoints.length - 1]} icon={hubIcon(activeHub?.id === endHub?.id)} />
                             </MapContainer>
                           )}
                        </div>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <div><CardTitle className="text-lg font-black font-mono flex items-center gap-2"><Truck size={18} className="text-indigo-600" /> {prop.truckPlate}</CardTitle><CardDescription className="text-[10px] uppercase font-bold text-slate-400">Ruta Asignada #{idx + 1}</CardDescription></div>
                              <Badge className="bg-indigo-50 text-indigo-700 border-none">{prop.stops.length} Remitos</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1">
                            <div className="space-y-3">
                              <p className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5"><ListOrdered size={12}/> Hoja de Ruta Sugerida</p>
                              <div className="space-y-2 relative pl-4 border-l-2 border-dashed border-indigo-100 ml-1">
                                  {prop.stops.map((s, sIdx) => (
                                    <div key={s.id} className="relative">
                                      <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white shadow-sm flex items-center justify-center text-[6px] font-black text-white">{sIdx + 1}</div>
                                      <div className="text-xs font-bold text-slate-700 uppercase leading-none truncate">{s.clientName}</div>
                                      <p className="text-[9px] text-slate-400 mt-0.5">REM {s.number} • {s.weightKg} KG</p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                        </CardContent>
                      </Card>
                    );
                  })}
               </div>

               <div className="p-6 bg-slate-900 text-white rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/30"><RouteIcon size={32} /></div>
                     <div><p className="text-xl font-black italic tracking-tighter">EMITIR ÓRDENES DE CARGA</p><p className="text-xs text-white/50">Se generarán {proposals.length} viajes. Los choferes recibirán los remitos en su App.</p></div>
                  </div>
                  <Button size="lg" className="bg-green-600 hover:bg-green-700 w-full md:w-auto font-black h-16 px-10 rounded-2xl shadow-xl shadow-green-900/40 text-lg italic" onClick={handleConfirmAndCreateLoads} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Zap size={20} className="mr-2" />}
                    DESPACHAR FLOTA
                  </Button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
