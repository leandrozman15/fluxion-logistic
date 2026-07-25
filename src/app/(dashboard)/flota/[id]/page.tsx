
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
  Loader2, Eye, Wrench, History, ExternalLink
} from "lucide-react";
import { Truck, VehicleDocument, DocStatus, Expense, Driver, Maintenance } from "@/app/lib/types";
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
  const [loadingDriver, setLoadingDriver] = useState(false);
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

  useEffect(() => {
    if (truck && !truck.documentation && truckRef) {
      const initialDocs = DEFAULT_DOCS.map(d => ({ ...d, status: 'pending' as DocStatus }));
      updateDoc(truckRef, { documentation: initialDocs });
    }
    
    const fetchDriver = async () => {
      if (truck?.assignedDriverId && truck.assignedDriverId !== 'none' && db) {
        setLoadingDriver(true);
        try {
          const dSnap = await getDoc(doc(db, "drivers", truck.assignedDriverId));
          if (dSnap.exists()) setAssignedDriver(dSnap.data() as Driver);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingDriver(false);
        }
      } else {
        setAssignedDriver(null);
      }
    };
    
    fetchDriver();
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
    
    if (isBefore(expiryDate, now)) {
      status = 'expired';
    } else if (isBefore(expiryDate, addDays(now, 30))) {
      status = 'warning';
    }

    const updatedDocs = truck.documentation.map(d => 
      d.id === docId ? { ...d, expiryDate: date, status } : d
    );

    try {
      await updateDoc(truckRef, { 
        documentation: updatedDocs,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Vencimiento actualizado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
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
      if (file.type.startsWith('image/')) {
        finalData = await compressImage(base64);
      }

      const updatedDocs = truck.documentation.map(d => 
        d.id === activeUploadId ? { ...d, fileUrl: finalData } : d
      );
      
      try {
        await updateDoc(truckRef, { documentation: updatedDocs });
        toast({ title: "Documento adjuntado y optimizado" });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al subir" });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!truck) return <div className="p-10 text-center">Vehículo no encontrado.</div>;

  const docProgress = truck.documentation ? 
    (truck.documentation.filter(d => d.status === 'valid').length / truck.documentation.length) * 100 : 0;

  const totalFuelCost = fuelExpenses?.reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-white shadow-md rounded-xl">
              <AvatarImage src={truck.avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-blue-50 text-blue-600 rounded-xl">
                <TruckIcon size={32} />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{truck.plate}</h1>
                <Badge variant="outline" className={cn(
                  "uppercase text-[10px]",
                  truck.ownershipType === 'company' ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-orange-50 text-orange-700 border-orange-100"
                )}>
                  {truck.ownershipType === 'company' ? 'Propiedad Empresa' : 'Tercero / Chofer'}
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
          <Card className="border-none shadow-sm overflow-hidden">
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
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500 uppercase">Cumplimiento Legal</span>
                  <span className={cn("font-bold", docProgress === 100 ? "text-green-600" : "text-blue-600")}>
                    {Math.round(docProgress)}%
                  </span>
                </div>
                <Progress value={docProgress} className="h-2 bg-slate-100" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                 <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Consumo Avg.</p>
                    <p className="text-xl font-black text-slate-700">{truck.avgConsumption || 32} <span className="text-[10px] font-normal text-slate-400">L/100</span></p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Estado</p>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 uppercase text-[9px]">{truck.status}</Badge>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-l-4 border-l-blue-600">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
                <User size={14} className="text-blue-600" /> Chofer Designado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDriver ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cargando chofer...
                </div>
              ) : assignedDriver ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border shadow-sm">
                    <AvatarImage src={assignedDriver.avatarUrl || undefined} className="object-cover" />
                    <AvatarFallback className="text-[10px] font-bold">
                      {assignedDriver.firstName?.[0]}{assignedDriver.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{assignedDriver.lastName}, {assignedDriver.firstName}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">LIC: {assignedDriver.licenseNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="text-xs italic text-slate-400 py-2">Sin chofer asignado a esta unidad.</div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white border-none shadow-md overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64}/></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-white/70 font-bold">Inversión en Combustible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black italic">
                ${totalFuelCost.toLocaleString('es-AR')}
              </div>
              <p className="text-[10px] text-white/50 mt-1 uppercase font-bold tracking-widest">Total Acumulado 2025</p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="tractor" className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="tractor" className="flex items-center gap-2">
                <TruckIcon size={16} /> Unidad Tractora
              </TabsTrigger>
              <TabsTrigger value="semi" className="flex items-center gap-2">
                <LayoutGrid size={16} /> Semirremolque
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History size={16} /> Historial Técnico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tractor" className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-slate-50 border rounded-xl mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Marca/Modelo</p>
                    <p className="text-sm font-bold text-slate-700">{truck.brand} {truck.model}</p>
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Patente</p>
                    <p className="text-sm font-mono font-bold text-blue-600">{truck.plate}</p>
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Carrocería</p>
                    <p className="text-sm font-bold text-slate-700 capitalize">{truck.bodyType}</p>
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Ejes</p>
                    <p className="text-sm font-bold text-slate-700">{truck.axles}</p>
                 </div>
              </div>
              {truck.documentation?.filter(d => d.category === 'unit').map((doc) => (
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
                       <input 
                         type="date" 
                         className="text-xs font-bold bg-transparent outline-none" 
                         value={doc.expiryDate || ""}
                         onChange={(e) => handleUpdateDocDate(doc.id, e.target.value)}
                       />
                       <div className="flex gap-1">
                        {doc.fileUrl && (
                          <Button variant="outline" size="icon" className="h-8 w-8 text-green-600" onClick={() => setViewerUrl(doc.fileUrl!)}>
                            <Eye size={14} />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleUploadClick(doc.id)} disabled={isProcessing}>
                          {isProcessing && activeUploadId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload size={14}/>}
                        </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="semi" className="space-y-4 animate-in fade-in">
              <Card className="bg-blue-50/30 border-blue-100 shadow-none mb-6">
                <CardHeader className="py-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LayoutGrid size={16} className="text-blue-600" /> Especificaciones del Acoplado
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Patente Semi</p>
                    <p className="text-lg font-mono font-bold text-blue-700">{truck.semiTrailer?.plate || 'SIN ASIGNAR'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Marca / Modelo</p>
                    <p className="text-sm font-bold text-slate-700">{truck.semiTrailer?.brand || '-'} {truck.semiTrailer?.model || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Tipo de Batea</p>
                    <Badge variant="secondary" className="uppercase text-[9px]">{truck.semiTrailer?.type || 'No def.'}</Badge>
                  </div>
                </CardContent>
              </Card>

              <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Documentación del Semirremolque</h4>
              {truck.documentation?.filter(d => d.category === 'semi').map((doc) => (
                <Card key={doc.id} className="border shadow-none">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(doc.status)}
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{doc.name}</h4>
                        <p className="text-[9px] text-slate-500">{doc.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <input 
                         type="date" 
                         className="text-xs font-bold bg-transparent outline-none" 
                         value={doc.expiryDate || ""}
                         onChange={(e) => handleUpdateDocDate(doc.id, e.target.value)}
                       />
                       <div className="flex gap-1">
                        {doc.fileUrl && (
                          <Button variant="outline" size="icon" className="h-8 w-8 text-green-600" onClick={() => setViewerUrl(doc.fileUrl!)}>
                            <Eye size={14} />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleUploadClick(doc.id)} disabled={isProcessing}>
                          {isProcessing && activeUploadId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload size={14}/>}
                        </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="history" className="space-y-8 animate-in fade-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-sm font-bold flex items-center gap-2"><Fuel className="text-blue-600" /> Histórico de Cargas de Combustible</h3>
                   <Badge variant="outline" className="text-[10px]">{fuelExpenses?.length || 0} Registros</Badge>
                </div>
                <Card className="border-none shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase">Fecha / Lugar</TableHead>
                        <TableHead className="text-[10px] uppercase">Carga (Litros)</TableHead>
                        <TableHead className="text-[10px] uppercase">Odómetro</TableHead>
                        <TableHead className="text-[10px] uppercase">Costo Total</TableHead>
                        <TableHead className="text-right text-[10px] uppercase">Ref.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!fuelExpenses || fuelExpenses.length === 0) ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400 italic text-xs">Sin registros de combustible.</TableCell></TableRow>
                      ) : (
                        fuelExpenses.map(exp => (
                          <TableRow key={exp.id}>
                            <TableCell>
                              <div className="font-bold text-xs">{exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "dd/MM/yyyy HH:mm") : "Reciente"}</div>
                              <div className="text-[9px] text-slate-500 uppercase">{exp.fuelBrand || 'S/D'} - {exp.location}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-bold text-blue-600">{exp.liters || 0} L</div>
                              <div className="text-[9px] text-slate-400">${exp.pricePerLiter || 0} / L</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">{(exp.odometerKm || 0).toLocaleString()} km</TableCell>
                            <TableCell className="font-bold text-slate-700">${exp.amount?.toLocaleString()}</TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-6 w-6"><FileText size={12}/></Button></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-sm font-bold flex items-center gap-2"><Wrench className="text-orange-600" /> Historial de Reparaciones y Taller</h3>
                   <Badge variant="outline" className="text-[10px]">{maintenanceHistory?.length || 0} Intervenciones</Badge>
                </div>
                <Card className="border-none shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase">OT N° / Fecha</TableHead>
                        <TableHead className="text-[10px] uppercase">Tipo de Trabajo</TableHead>
                        <TableHead className="text-[10px] uppercase">Taller</TableHead>
                        <TableHead className="text-[10px] uppercase">Costo Real</TableHead>
                        <TableHead className="text-[10px] uppercase">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!maintenanceHistory || maintenanceHistory.length === 0) ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400 italic text-xs">Sin registros de mantenimiento.</TableCell></TableRow>
                      ) : (
                        maintenanceHistory.map(record => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="font-bold text-xs text-blue-600">{record.orderNumber || 'S/OT'}</div>
                              <div className="text-[9px] text-slate-400">{format(parseISO(record.scheduledDate), "dd/MM/yyyy")}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-bold capitalize">{record.type}</div>
                              <p className="text-[9px] text-slate-500 line-clamp-1">{record.description}</p>
                            </TableCell>
                            <TableCell className="text-xs">{record.workshopName || '-'}</TableCell>
                            <TableCell className="font-bold text-slate-700">${(record.actualCost || record.estimatedCost || 0).toLocaleString()}</TableCell>
                            <TableCell>
                               <Badge variant="outline" className={cn(
                                 "text-[8px] uppercase font-bold",
                                 record.status === 'completed' ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                               )}>{record.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={onFileChange} />

      {/* Document Viewer Modal */}
      <Dialog open={!!viewerUrl} onOpenChange={(o) => !o && setViewerUrl(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col rounded-xl overflow-hidden p-0 gap-0">
          <DialogHeader className="p-4 border-b bg-slate-50">
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Expediente de Unidad Pesada
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden relative">
            {viewerUrl ? (
              <>
                {viewerUrl.startsWith('data:application/pdf') ? (
                  <iframe 
                    src={viewerUrl} 
                    className="w-full h-full border-none" 
                    title="Visor PDF"
                  />
                ) : (
                  <div className="w-full h-full p-4 flex items-center justify-center">
                    <img 
                      src={viewerUrl} 
                      className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border bg-white" 
                      alt="Documentación Técnica" 
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="animate-spin" />
                <p className="text-xs font-bold uppercase">Cargando archivo...</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-slate-50 flex flex-row justify-between items-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Seguridad y Cumplimiento Logístico</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[10px] font-bold" 
                onClick={() => setViewerUrl(null)}
              >
                CERRAR
              </Button>
              {viewerUrl && (
                <Button 
                  size="sm" 
                  className="h-8 text-[10px] font-bold bg-blue-600" 
                  onClick={() => window.open(viewerUrl, "_blank")}
                >
                  <ExternalLink size={12} className="mr-1" /> ABRIR EN PANTALLA COMPLETA
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
