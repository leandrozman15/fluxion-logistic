
'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, where, getDoc, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Truck as TruckIcon, FileText, Calendar, AlertTriangle, 
  CheckCircle2, Clock, Upload, ArrowLeft, ShieldCheck, 
  MapPin, Gauge, Box, Info, Download, Trash2, MoreVertical, LayoutGrid, Fuel, DollarSign, Activity, TrendingUp, User, Building2, Briefcase, Edit2,
  Loader2, Eye, Wrench, History, ExternalLink, Zap, Scale, Users
} from "lucide-react";
import { Truck, VehicleDocument, DocStatus, Expense, Driver, Maintenance, TruckCosts } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isBefore, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toSafeDate } from "@/lib/utils/date-utils";
import { compressImage } from "@/lib/utils/image-compression";

const DEFAULT_DOCS: Omit<VehicleDocument, 'status'>[] = [
  { id: 'cedula_verde', name: 'Cédula de Identificación (Verde)', category: 'unit', description: 'Acredita la titularidad del camión.', isRequired: true },
  { id: 'vtv_rto', name: 'Revisión Técnica (RTO/VTV)', category: 'unit', description: 'Aptitud técnica obligatoria.', isRequired: true },
  { id: 'seguro', name: 'Seguro Obligatorio', category: 'unit', description: 'Responsabilidad Civil vigente.', isRequired: true },
  { id: 'patente_pago', name: 'Impuesto a la Radicación (Patente)', category: 'unit', description: 'Comprobante de último pago.', isRequired: true },
  { id: 'cedula_semi', name: 'Cédula de Identificación del Semi', category: 'semi', description: 'Título registral del acoplado.', isRequired: true },
  { id: 'rto_semi', name: 'RTO Propia del Semi', category: 'semi', description: 'Inspección técnica independiente del acoplado.', isRequired: true },
  { id: 'seguro_semi', name: 'Seguro del Semirremolque', category: 'semi', description: 'Cobertura del acoplado.', isRequired: true },
  { id: 'cnrt', name: 'Habilitación CNRT', category: 'authorization', description: 'Obligatorio para fletes a terceros.', isRequired: false }
];

export default function TruckDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [assignedCompanions, setAssignedCompanions] = useState<Driver[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const truckRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "trucks", id as string);
  }, [db, id]);

  const { data: truck, loading } = useDoc<Truck>(truckRef);

  const fuelExpensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(
      collection(db, "global_expenses"), 
      where("truckId", "==", id as string), 
      where("category", "==", "fuel")
    );
  }, [db, id]);

  const maintenanceHistoryQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(
      collection(db, "maintenance"), 
      where("truckId", "==", id as string)
    );
  }, [db, id]);

  const { data: fuelExpensesRaw } = useCollection<Expense>(fuelExpensesQuery);
  const { data: maintenanceHistoryRaw } = useCollection<Maintenance>(maintenanceHistoryQuery);

  const fuelExpenses = useMemo(() => {
    if (!fuelExpensesRaw) return [];
    return [...fuelExpensesRaw].sort((a, b) => {
      const dateA = toSafeDate(a.createdAt)?.getTime() || 0;
      const dateB = toSafeDate(b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [fuelExpensesRaw]);

  const maintenanceHistory = useMemo(() => {
    if (!maintenanceHistoryRaw) return [];
    return [...maintenanceHistoryRaw].sort((a, b) => {
      const dateA = parseISO(a.scheduledDate).getTime();
      const dateB = parseISO(b.scheduledDate).getTime();
      return dateB - dateA;
    });
  }, [maintenanceHistoryRaw]);

  const costCalculation = useMemo(() => {
    if (!truck?.costs) return { totalPerKm: 0, fixedPerKm: 0, fuelPerKm: 0, oilPerKm: 0, tiresPerKm: 0, reservePerKm: 0 };
    const costs = truck.costs;
    const kmMensuales = costs.operational.estimatedMonthlyKm || 1;
    
    const sumFixed = Object.values(costs.fixed).reduce((a, b) => a + (b as number), 0);
    const fixedPerKm = sumFixed / kmMensuales;
    const oilPerKm = (costs.variable.preventiveMaintenance?.cost || 0) / (costs.variable.preventiveMaintenance?.frequencyKm || 1);
    const tiresPerKm = (costs.variable.tires?.costFullSet || 0) / (costs.variable.tires?.lifeSpanKm || 1);
    const reservePerKm = costs.variable.unforeseenReservePerKm || 0;

    // CÁLCULO DINÁMICO DE COMBUSTIBLE
    let fuelPerKm = 0;
    if (fuelExpenses && fuelExpenses.length > 0) {
      // Tomamos el promedio de precio por litro de los tickets cargados (media móvil)
      const validTickets = fuelExpenses.filter(e => !!e.pricePerLiter && e.pricePerLiter > 0);
      if (validTickets.length > 0) {
        const avgPrice = validTickets.reduce((acc, e) => acc + (e.pricePerLiter || 0), 0) / validTickets.length;
        // Costo = (Precio Promedio * Consumo por 100km) / 100
        fuelPerKm = (avgPrice * (truck.avgConsumption || 32)) / 100;
      }
    }
    
    return {
      totalPerKm: fixedPerKm + oilPerKm + tiresPerKm + reservePerKm + fuelPerKm,
      fixedPerKm, oilPerKm, tiresPerKm, reservePerKm, fuelPerKm
    };
  }, [truck, fuelExpenses]);

  useEffect(() => {
    if (truck && !truck.documentation && truckRef) {
      const initialDocs = DEFAULT_DOCS.map(d => ({ ...d, status: 'pending' as DocStatus }));
      updateDoc(truckRef, { documentation: initialDocs });
    }
    
    const fetchStaff = async () => {
      if (!db || !truck) return;
      setLoadingStaff(true);
      try {
        if (truck.assignedDriverId && truck.assignedDriverId !== 'none') {
          const dSnap = await getDoc(doc(db, "drivers", truck.assignedDriverId));
          if (dSnap.exists()) setAssignedDriver(dSnap.data() as Driver);
        } else {
          setAssignedDriver(null);
        }

        if (truck.assignedCompanionIds && truck.assignedCompanionIds.length > 0) {
          const companionPromises = truck.assignedCompanionIds.map(id => getDoc(doc(db, "drivers", id)));
          const companionSnaps = await Promise.all(companionPromises);
          const companions = companionSnaps
            .filter(s => s.exists())
            .map(s => s.data() as Driver);
          setAssignedCompanions(companions);
        } else {
          setAssignedCompanions([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStaff(false);
      }
    };
    
    fetchStaff();
  }, [truck, truckRef, db]);

  const getStatusIcon = (status: DocStatus) => {
    switch (status) {
      case 'valid': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'expired': return <AlertTriangle className="text-red-500" size={18} />;
      case 'warning': return <Clock className="text-orange-500" size={18} />;
      default: return <Clock className="text-slate-300" size={18} />;
    }
  };

  const handleUpdateDocDate = async (docId: string, date: string) => {
    if (!truck || !truckRef) return;
    const now = new Date();
    const expiryDate = parseISO(date);
    let status: DocStatus = 'valid';
    if (isBefore(expiryDate, now)) status = 'expired';
    else if (isBefore(expiryDate, addDays(now, 30))) status = 'warning';

    const updatedDocs = truck.documentation.map(d => 
      d.id === docId ? { ...d, expiryDate: date, status } : d
    );

    try {
      await updateDoc(truckRef, { documentation: updatedDocs, updatedAt: serverTimestamp() });
      toast({ title: "Vencimiento actualizado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleUploadClick = (docId: string) => {
    setActiveUploadId(docId);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadId || !truck || !truckRef) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      let finalData = base64;
      if (file.type.startsWith('image/')) finalData = await compressImage(base64);
      const updatedDocs = truck.documentation.map(d => d.id === activeUploadId ? { ...d, fileUrl: finalData } : d);
      try {
        await updateDoc(truckRef, { documentation: updatedDocs });
        toast({ title: "Documento adjuntado" });
      } catch (err) {
        toast({ variant: "destructive", title: "Error" });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!truck) return <div className="p-10 text-center">Vehículo no encontrado.</div>;

  const docProgress = truck.documentation ? (truck.documentation.filter(d => d.status === 'valid').length / truck.documentation.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-white shadow-md rounded-xl">
              <AvatarImage src={truck.avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-blue-50 text-blue-600 rounded-xl"><TruckIcon size={32} /></AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{truck.plate}</h1>
                <Badge variant="outline" className="uppercase text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                  {truck.ownershipType === 'company' ? 'Propiedad Empresa' : 'Tercero'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin size={14} /> Base: {truck.location?.city || 'S/D'}, {truck.location?.province || 'S/D'}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/flota/${truck.id}/editar`)} variant="outline">
          <Edit2 className="w-4 h-4 mr-2" /> Editar Unidad
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <div className="h-32 bg-slate-900 flex items-center justify-center text-white relative">
               <TruckIcon size={48} className="opacity-20" />
               <div className="absolute bottom-4 left-4">
                  <div className="text-[10px] uppercase font-bold text-white/50">Odómetro Actual</div>
                  <div className="font-bold flex items-center gap-2 text-blue-400 italic text-2xl font-mono">
                    {(truck.odometerKm || 0).toLocaleString()} <span className="text-xs uppercase font-bold opacity-50">KM</span>
                  </div>
               </div>
            </div>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                    <Scale size={14} /> Balance Legal de Carga
                 </div>
                 <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="p-3 bg-slate-50 rounded-xl">
                       <p className="text-[8px] font-bold text-slate-400 uppercase">PBTC Máx.</p>
                       <p className="text-sm font-black text-slate-700">{(truck.grossCombinedWeightKg || 0).toLocaleString()} KG</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                       <p className="text-[8px] font-bold text-slate-400 uppercase">Tara Real</p>
                       <p className="text-sm font-black text-slate-700">{(truck.unladenWeightKg || 0).toLocaleString()} KG</p>
                    </div>
                 </div>
                 <div className="p-4 bg-green-50 border border-green-100 rounded-xl mt-2">
                    <p className="text-[10px] font-black text-green-700 uppercase">Carga Útil Habilitada</p>
                    <p className="text-2xl font-black text-green-600 italic">{(truck.capacityKg || 0).toLocaleString()} KG</p>
                 </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase">Cumplimiento Docs</span>
                  <span className="font-bold text-blue-600">{Math.round(docProgress)}%</span>
                </div>
                <Progress value={docProgress} className="h-2 bg-slate-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign size={80}/></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase font-black text-blue-400 tracking-tighter">Costo Total por KM (Auditado)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-end gap-2">
                 <p className="text-4xl font-black italic text-green-400">${costCalculation.totalPerKm.toFixed(2)}</p>
                 <p className="text-[10px] uppercase font-bold text-white/30 pb-1">Costo Real</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                  <div>
                    <p className="text-[8px] uppercase font-bold text-white/40">Fijos + Seguros</p>
                    <p className="text-sm font-black text-blue-300">${costCalculation.fixedPerKm.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[8px] uppercase font-bold text-white/40">Gasoil (Auditado)</p>
                    <p className="text-sm font-black text-orange-400">${costCalculation.fuelPerKm.toFixed(2)}</p>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-l-4 border-l-blue-600">
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2"><Users size={14} className="text-blue-600" /> Personal de Cabina</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loadingStaff ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  {/* Chofer */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Chofer Designado</p>
                    {assignedDriver ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border shadow-sm">
                          <AvatarImage src={assignedDriver.avatarUrl} />
                          <AvatarFallback>{assignedDriver.lastName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{assignedDriver.lastName}, {assignedDriver.firstName}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">LIC: {assignedDriver.licenseNumber || 'S/D'}</p>
                        </div>
                      </div>
                    ) : <div className="text-xs italic text-slate-400">Sin chofer asignado.</div>}
                  </div>

                  {/* Acompañantes */}
                  {assignedCompanions.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Acompañantes</p>
                      <div className="space-y-2">
                        {assignedCompanions.map(companion => (
                          <div key={companion.id} className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border shadow-sm">
                              <AvatarImage src={companion.avatarUrl} />
                              <AvatarFallback className="text-[10px]">{companion.lastName[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-bold text-slate-700">{companion.lastName}, {companion.firstName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="equipment" className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="equipment" className="flex items-center gap-2"><TruckIcon size={16} /> Equipo</TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-2"><FileText size={16} /> Documentos</TabsTrigger>
              <TabsTrigger value="costs" className="flex items-center gap-2"><DollarSign size={16} /> Costos</TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2"><History size={16} /> Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="equipment" className="space-y-6 animate-in fade-in">
               <Card className="border-none shadow-sm bg-slate-50">
                  <CardHeader className="py-4 border-b bg-white"><CardTitle className="text-sm">Especificaciones Técnicas</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6">
                     <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Unidad</p><p className="text-sm font-bold">{truck.brand} {truck.model}</p></div>
                     <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Patente Tractor</p><p className="text-sm font-mono font-bold text-blue-600">{truck.plate}</p></div>
                     <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Ejes Tractor</p><p className="text-sm font-bold">{truck.axles}</p></div>
                     <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Capacidad Legal</p><p className="text-sm font-bold text-green-700">{truck.capacityKg.toLocaleString()} KG</p></div>
                  </CardContent>
               </Card>

               {truck.haulingType === 'bitren' && truck.bitren ? (
                 <Card className="border-blue-100 bg-blue-50/50 shadow-md">
                   <CardHeader className="py-4 border-b border-blue-100 bg-white">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm flex items-center gap-2 text-blue-800"><Zap size={16}/> Configuración Bitrén</CardTitle>
                        <Badge className="bg-blue-600 uppercase text-[8px] font-black italic">Res. 1196/2025</Badge>
                      </div>
                   </CardHeader>
                   <CardContent className="space-y-6 pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">1er Semirremolque</p>
                            <p className="text-lg font-mono font-black text-blue-600">{truck.bitren.firstSemiPlate}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Conexión Plato Tractor</p>
                         </div>
                         <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">2do Semirremolque</p>
                            <p className="text-lg font-mono font-black text-blue-600">{truck.bitren.secondSemiPlate}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Conexión 5ta Rueda Central</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 border-t border-blue-100 pt-4">
                         <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-blue-400">Tipo de Bitrén</p>
                            <p className="text-xs font-black uppercase text-blue-800">{truck.bitren.type === 'type_a' ? 'Tipo A (22,40m)' : 'Tipo B (30,25m)'}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-blue-400">Ejes Totales</p>
                            <p className="text-xs font-black text-blue-800">{truck.bitren.totalAxles} Ejes</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-blue-400">PBTC Máx.</p>
                            <p className="text-xs font-black text-blue-800">{truck.bitren.type === 'type_a' ? '60 Toneladas' : '75 Toneladas'}</p>
                         </div>
                      </div>
                   </CardContent>
                 </Card>
               ) : (
                 <Card className="border-slate-100 bg-slate-50/50 shadow-sm">
                    <CardHeader className="py-4 border-b bg-white"><CardTitle className="text-sm">Semirremolque Standard</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6">
                       <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Patente Semi</p><p className="text-lg font-mono font-bold text-slate-700">{truck.semiTrailer?.plate || 'S/D'}</p></div>
                       <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Marca/Modelo</p><p className="text-sm font-bold text-slate-700">{truck.semiTrailer?.brand} {truck.semiTrailer?.model}</p></div>
                       <div className="space-y-1"><p className="text-[10px] uppercase font-bold text-slate-400">Tipo Batea</p><Badge variant="outline" className="uppercase text-[9px]">{truck.semiTrailer?.type}</Badge></div>
                    </CardContent>
                 </Card>
               )}
            </TabsContent>

            <TabsContent value="docs" className="space-y-4 animate-in fade-in">
              {truck.documentation?.map((doc) => (
                <Card key={doc.id} className={cn("border shadow-none", doc.status === 'expired' ? "border-red-200 bg-red-50/20" : "")}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(doc.status)}
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                        <p className="text-[9px] text-slate-500">{doc.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <input type="date" className="text-xs font-bold bg-transparent outline-none" value={doc.expiryDate || ""} onChange={(e) => handleUpdateDocDate(doc.id, e.target.value)} />
                       <div className="flex gap-1">
                        {doc.fileUrl && <Button variant="outline" size="icon" className="h-8 w-8 text-green-600" onClick={() => setViewerUrl(doc.fileUrl!)}><Eye size={14} /></Button>}
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleUploadClick(doc.id)} disabled={isProcessing}>{isProcessing && activeUploadId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload size={14}/>}</Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="costs" className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="border-none shadow-sm">
                   <CardHeader className="bg-slate-50 border-b py-3">
                      <CardTitle className="text-xs uppercase font-black text-slate-500">Gastos Fijos Mensuales</CardTitle>
                   </CardHeader>
                   <CardContent className="pt-4 space-y-2">
                      {truck.costs?.fixed && Object.entries(truck.costs.fixed).map(([k,v]) => (
                        <div key={k} className="flex justify-between text-xs border-b border-slate-50 py-1">
                          <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="font-bold">${(v as number).toLocaleString()}</span>
                        </div>
                      ))}
                   </CardContent>
                 </Card>
                 
                 <div className="space-y-4">
                    <Card className="border-none shadow-sm bg-slate-900 text-white">
                      <CardHeader>
                        <CardTitle className="text-xs uppercase font-bold text-blue-400">Estructura Auditada por KM</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span>Fijos (Sueldos/Seguros)</span>
                          <span className="font-bold">${costCalculation.fixedPerKm.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span>Mantenimiento y Gomas</span>
                          <span className="font-bold">${(costCalculation.oilPerKm + costCalculation.tiresPerKm).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-orange-400">
                          <span>Gasoil (Media móvil)</span>
                          <span className="font-bold">${costCalculation.fuelPerKm.toFixed(2)}</span>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-lg flex justify-between items-center text-sm font-black border border-blue-500/20">
                          <span className="text-blue-400">COSTO KM REAL</span>
                          <span className="text-green-400">${costCalculation.totalPerKm.toFixed(2)}</span>
                        </div>
                        <p className="text-[8px] text-white/30 italic">Cálculo basado en la meta de {truck.costs?.operational.estimatedMonthlyKm.toLocaleString()} KM/mes.</p>
                      </CardContent>
                    </Card>
                 </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-6 animate-in fade-in">
               <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2"><Fuel className="text-blue-600" /> Cargas de Combustible y Precios</h3>
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase">Fecha</TableHead>
                        <TableHead className="text-[10px] uppercase">Litros</TableHead>
                        <TableHead className="text-[10px] uppercase">$/Litro</TableHead>
                        <TableHead className="text-[10px] uppercase">Total</TableHead>
                        <TableHead className="text-[10px] uppercase">Lugar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fuelExpenses?.map(exp => (
                        <TableRow key={exp.id}>
                          <TableCell className="text-xs">{exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "dd/MM/yy") : '-'}</TableCell>
                          <TableCell className="text-xs font-bold">{exp.liters} L</TableCell>
                          <TableCell className="text-xs font-mono text-blue-600">${exp.pricePerLiter?.toFixed(2)}</TableCell>
                          <TableCell className="text-xs font-bold text-green-700">${exp.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-[10px] text-slate-500 uppercase">{exp.location}</TableCell>
                        </TableRow>
                      ))}
                      {(!fuelExpenses || fuelExpenses.length === 0) && (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400 italic text-xs">Sin registros de combustible para esta unidad.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />
      <Dialog open={!!viewerUrl} onOpenChange={(o) => !o && setViewerUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col rounded-xl overflow-hidden p-0 gap-0">
          <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden relative">{viewerUrl && (viewerUrl.startsWith('data:application/pdf') ? <iframe src={viewerUrl} className="w-full h-full border-none" /> : <img src={viewerUrl} className="max-w-full max-h-full object-contain" />)}</div>
          <DialogFooter className="p-4 border-t bg-slate-50"><Button variant="outline" size="sm" onClick={() => setViewerUrl(null)}>CERRAR</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
