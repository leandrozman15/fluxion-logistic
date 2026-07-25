
'use client';

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, FileText, Calendar, ShieldCheck, 
  Phone, ArrowLeft, Edit2, Loader2, 
  Truck as TruckIcon, Package, CheckCircle2, 
  AlertTriangle, History, Mail, MapPin, Eye,
  ChevronRight, ExternalLink, RefreshCw, Navigation, Gauge
} from "lucide-react";
import { Driver, Load, Truck, DriverStatus } from "@/app/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { toSafeDate } from "@/lib/utils/date-utils";

interface ActiveDoc {
  front?: string;
  back?: string;
  title: string;
}

export default function DriverProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const [activeDoc, setActiveDoc] = useState<ActiveDoc | null>(null);
  const [viewingBack, setViewingBack] = useState(false);

  const driverRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "drivers", id as string);
  }, [db, id]);

  const { data: driver, loading: driverLoading } = useDoc<Driver>(driverRef);

  const tripsQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(
      collection(db, "loads"),
      where("assignedDriverId", "==", id as string)
    );
  }, [db, id]);

  const { data: trips, loading: tripsLoading } = useCollection<Load>(tripsQuery);

  const totalKm = useMemo(() => {
    if (!trips) return 0;
    return trips.reduce((acc, trip) => acc + (trip.tracking?.distanceTraveledKm || 0), 0);
  }, [trips]);

  const sortedTrips = useMemo(() => {
    if (!trips) return [];
    return [...trips].sort((a, b) => {
      const dateA = toSafeDate(a.createdAt)?.getTime() || 0;
      const dateB = toSafeDate(b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });
  }, [trips]);

  const trucksQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(collection(db, "trucks"), where("assignedDriverId", "==", id as string));
  }, [db, id]);

  const { data: assignedTrucks } = useCollection<Truck>(trucksQuery);

  const getStatusBadge = (status: DriverStatus) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700 border-none">Activo</Badge>;
      case 'in_trip': return <Badge className="bg-blue-100 text-blue-700 border-none">En Viaje</Badge>;
      case 'resting': return <Badge className="bg-orange-100 text-orange-700 border-none">Descanso</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-700 border-none">Suspendido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExpiryAlert = (dateStr?: string) => {
    if (!dateStr) return null;
    const expiry = parseISO(dateStr);
    const now = new Date();
    const days = differenceInDays(expiry, now);
    
    if (days < 0) return <Badge variant="destructive" className="animate-pulse">VENCIDO</Badge>;
    if (days <= 30) return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">POR VENCER ({days}d)</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-100 bg-green-50">VIGENTE</Badge>;
  };

  const openViewer = (title: string, front?: string, back?: string) => {
    setActiveDoc({ title, front, back });
    setViewingBack(false);
  };

  if (driverLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!driver) return <div className="p-20 text-center text-slate-400">Chofer no encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-white shadow-md">
              <AvatarImage src={driver.avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-blue-50 text-blue-600 text-xl font-bold">{driver.firstName?.[0]}{driver.lastName?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{driver.lastName}, {driver.firstName}</h1>
                {getStatusBadge(driver.status)}
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <FileText size={14} /> DNI: {driver.dni} | <Phone size={14} className="ml-2" /> {driver.phone}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/choferes/${driver.id}/editar`)} variant="outline">
          <Edit2 className="w-4 h-4 mr-2" /> Editar Perfil
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Gauge size={64}/></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-white/50 font-bold tracking-widest">Desempeño Operativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-end gap-6">
                  <div className="space-y-1">
                     <p className="text-5xl font-black italic text-blue-400 leading-none">{Math.round(totalKm).toLocaleString()}</p>
                     <p className="text-[10px] uppercase font-bold text-white/30 tracking-tighter">Km Conducidos</p>
                  </div>
                  <div className="space-y-1 border-l border-white/10 pl-4">
                     <p className="text-2xl font-black italic">{trips?.length || 0}</p>
                     <p className="text-[10px] uppercase font-bold text-white/30 tracking-tighter">Viajes Realizados</p>
                  </div>
               </div>
               
               <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <p className="text-[9px] font-bold text-white/30 uppercase">Alta Sistema</p>
                     <p className="text-xs font-bold">{driver.hireDate ? format(parseISO(driver.hireDate), "MMM yyyy", { locale: es }) : '-'}</p>
                  </div>
                  <div className="space-y-1 text-right">
                     <p className="text-[9px] font-bold text-white/30 uppercase">Exp. Declarada</p>
                     <p className="text-xs font-bold">{driver.experienceYears || 0} Años</p>
                  </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-l-4 border-l-blue-600">
             <CardHeader className="pb-2">
               <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
                 <TruckIcon size={14} className="text-blue-600" /> Unidad Habitual
               </CardTitle>
             </CardHeader>
             <CardContent>
                {assignedTrucks && assignedTrucks.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-mono font-bold text-blue-700">{assignedTrucks[0].plate}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{assignedTrucks[0].brand} {assignedTrucks[0].model}</p>
                    </div>
                    <Button variant="ghost" size="icon" asChild><Link href={`/flota/${assignedTrucks[0].id}`}><Eye size={16}/></Link></Button>
                  </div>
                ) : (
                  <p className="text-xs italic text-slate-400">Sin unidad fija asignada.</p>
                )}
             </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
             <CardHeader className="pb-2">
               <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
                 <ShieldCheck size={14} className="text-red-500" /> Emergencias y Salud
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-500">Grupo Sanguíneo</span>
                   <Badge variant="outline" className="font-bold text-red-600 bg-red-50">{driver.bloodType || 'S/D'}</Badge>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-500">Obra Social</span>
                   <span className="font-bold text-slate-700">{driver.healthInsurance || '-'}</span>
                </div>
                <div className="pt-2 border-t mt-2">
                   <p className="text-[9px] uppercase font-bold text-slate-400">Contacto de Emergencia</p>
                   <p className="text-xs font-bold text-slate-700">{driver.emergencyContact || 'S/D'}</p>
                   <p className="text-xs font-mono text-blue-600">{driver.emergencyPhone || '-'}</p>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="docs" className="space-y-6">
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="docs" className="flex items-center gap-2"><FileText size={16} /> Documentación</TabsTrigger>
              <TabsTrigger value="trips" className="flex items-center gap-2"><History size={16} /> Historial de Viajes</TabsTrigger>
              <TabsTrigger value="info" className="flex items-center gap-2"><User size={16} /> Ficha Personal</TabsTrigger>
            </TabsList>

            <TabsContent value="docs" className="space-y-4 animate-in fade-in">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><FileText size={20}/></div>
                        {getExpiryAlert(driver.licenseExpiry)}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 uppercase">Licencia Nacional</h4>
                        <p className="text-xs font-mono font-bold text-blue-600">N° {driver.licenseNumber}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                           {driver.licenseClasses?.map(c => <Badge key={c} variant="secondary" className="text-[9px] h-4">{c}</Badge>)}
                        </div>
                      </div>
                      <div className="pt-3 border-t flex justify-between items-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Vence: {driver.licenseExpiry ? format(parseISO(driver.licenseExpiry), "dd/MM/yyyy") : '-'}</div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-blue-600" 
                          onClick={() => openViewer("Licencia Nacional", driver.licenseFileUrl, driver.licenseBackFileUrl)} 
                          disabled={!driver.licenseFileUrl}
                        >
                          VER ARCHIVO
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600"><ShieldCheck size={20}/></div>
                        {driver.hasLinti ? getExpiryAlert(driver.lintiExpiry) : <Badge variant="outline">NO REQUERIDO</Badge>}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 uppercase">Habilitación LINTI</h4>
                        <p className="text-xs font-mono font-bold text-orange-600">{driver.hasLinti ? `N° ${driver.lintiNumber}` : 'SIN TRAMITAR'}</p>
                        <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold italic">Interjurisdiccional Obligatorio</p>
                      </div>
                      <div className="pt-3 border-t flex justify-between items-center">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Vence: {driver.lintiExpiry ? format(parseISO(driver.lintiExpiry), "dd/MM/yyyy") : '-'}</div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-orange-600" 
                          onClick={() => openViewer("Habilitación LINTI", driver.lintiFileUrl)} 
                          disabled={!driver.lintiFileUrl}
                        >
                          VER ARCHIVO
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
               </div>

               <Card className="border-none shadow-sm">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm">Identidad Nacional (DNI)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <span className="font-bold text-xs uppercase">Documento Nacional de Identidad</span>
                     </div>
                     <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] font-bold" 
                      onClick={() => openViewer("DNI Chofer", driver.dniFileUrl, driver.dniBackFileUrl)} 
                      disabled={!driver.dniFileUrl}
                    >
                      VISUALIZAR
                    </Button>
                  </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="trips" className="animate-in fade-in">
               <Card className="border-none shadow-sm overflow-hidden">
                  <Table>
                     <TableHeader className="bg-slate-50">
                        <TableRow>
                           <TableHead className="text-[10px] uppercase">N° Orden / Fecha</TableHead>
                           <TableHead className="text-[10px] uppercase">Ruta / Cliente</TableHead>
                           <TableHead className="text-[10px] uppercase">Estado</TableHead>
                           <TableHead className="text-right text-[10px] uppercase">Detalle</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {tripsLoading ? (
                           <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                        ) : sortedTrips.length === 0 ? (
                           <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400 italic text-xs">Sin viajes registrados.</TableCell></TableRow>
                        ) : (
                           sortedTrips.map(trip => (
                              <TableRow key={trip.id}>
                                 <TableCell>
                                    <div className="font-bold text-xs">{trip.orderNumber}</div>
                                    <div className="text-[9px] text-slate-400">{trip.pickupDate}</div>
                                 </TableCell>
                                 <TableCell>
                                    <div className="text-xs font-bold text-slate-700">{trip.clientName}</div>
                                    <div className="text-[9px] text-slate-500 uppercase flex items-center gap-1">
                                       {trip.origin?.city || 'S/D'} <ChevronRight size={8}/> {trip.outboundStops?.[trip.outboundStops.length-1]?.name || 'Destino'}
                                    </div>
                                 </TableCell>
                                 <TableCell>
                                    <Badge variant="outline" className="text-[8px] uppercase">{trip.status}</Badge>
                                 </TableCell>
                                 <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                      <Link href={`/cargas/${trip.id}/orden`}>
                                        <Eye size={14}/>
                                      </Link>
                                    </Button>
                                 </TableCell>
                              </TableRow>
                           ))
                        )}
                     </TableBody>
                  </Table>
               </Card>
            </TabsContent>

            <TabsContent value="info" className="animate-in fade-in">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-sm">
                     <CardHeader><CardTitle className="text-sm">Datos de Contacto</CardTitle></CardHeader>
                     <CardContent className="space-y-4">
                        <div className="space-y-1">
                           <p className="text-[9px] uppercase font-bold text-slate-400">Correo Electrónico</p>
                           <p className="text-sm font-medium flex items-center gap-2"><Mail size={14} className="text-blue-500"/> {driver.email || '-'}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] uppercase font-bold text-slate-400">Teléfono Personal</p>
                           <p className="text-sm font-medium flex items-center gap-2"><Phone size={14} className="text-green-500"/> {driver.phone || '-'}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] uppercase font-bold text-slate-400">Dirección Residencial</p>
                           <p className="text-sm font-medium flex items-center gap-2"><MapPin size={14} className="text-slate-400"/> {driver.address || '-'}</p>
                        </div>
                     </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm">
                     <CardHeader><CardTitle className="text-sm">Información Laboral</CardTitle></CardHeader>
                     <CardContent className="space-y-4">
                        <div className="space-y-1">
                           <p className="text-[9px] uppercase font-bold text-slate-400">Fecha de Ingreso</p>
                           <p className="text-sm font-bold">{driver.hireDate ? format(parseISO(driver.hireDate), "dd 'de' MMMM, yyyy", { locale: es }) : '-'}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] uppercase font-bold text-slate-400">Tipo de Contrato</p>
                           <Badge variant="outline" className="uppercase text-[9px]">{driver.contractType || 'S/D'}</Badge>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[9px] uppercase font-bold text-slate-400">Observaciones</p>
                           <p className="text-xs text-slate-600 italic leading-relaxed">{driver.observations || 'Sin observaciones registradas.'}</p>
                        </div>
                     </CardContent>
                  </Card>
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Flip Document Viewer Modal */}
      <Dialog open={!!activeDoc} onOpenChange={(o) => !o && setActiveDoc(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col rounded-xl overflow-hidden p-0 gap-0">
          <DialogHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> {activeDoc?.title}
              {activeDoc?.back && (
                <Badge variant="secondary" className="text-[8px] uppercase h-4">
                  {viewingBack ? 'DORSO' : 'FRENTE'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden relative">
            {activeDoc ? (
              <>
                {(viewingBack ? activeDoc.back : activeDoc.front)?.startsWith('data:application/pdf') ? (
                  <iframe 
                    src={viewingBack ? activeDoc.back : activeDoc.front} 
                    className="w-full h-full border-none" 
                    title="Visor PDF"
                  />
                ) : (
                  <div className="w-full h-full p-6 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
                    <img 
                      src={(viewingBack ? activeDoc.back : activeDoc.front) || undefined} 
                      className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border bg-white ring-1 ring-slate-900/5" 
                      alt="Documento" 
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="animate-spin" />
                <p className="text-xs font-bold uppercase">Cargando...</p>
              </div>
            )}

            {/* Navigation Arrows if back exists */}
            {activeDoc?.back && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 pointer-events-none">
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className={cn("h-12 w-12 rounded-full shadow-xl border-2 border-white pointer-events-auto", !viewingBack && "opacity-20")}
                  onClick={() => setViewingBack(false)}
                  disabled={!viewingBack}
                >
                  <ChevronRight className="rotate-180" />
                </Button>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className={cn("h-12 w-12 rounded-full shadow-xl border-2 border-white pointer-events-auto", viewingBack && "opacity-20")}
                  onClick={() => setViewingBack(true)}
                  disabled={viewingBack}
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-slate-50 flex flex-row justify-between items-center">
            <div className="flex items-center gap-4">
              <p className="text-[10px] text-slate-400 font-bold uppercase hidden sm:block tracking-widest">Protocolo de Auditoría Digital</p>
              {activeDoc?.back && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[10px] font-bold border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100" 
                  onClick={() => setViewingBack(!viewingBack)}
                >
                  <RefreshCw size={12} className="mr-1" /> VER {viewingBack ? 'FRENTE' : 'DORSO'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-[10px] font-bold" 
                onClick={() => setActiveDoc(null)}
              >
                CERRAR
              </Button>
              {(viewingBack ? activeDoc?.back : activeDoc?.front) && (
                <Button 
                  size="sm" 
                  className="h-8 text-[10px] font-bold bg-blue-600" 
                  onClick={() => window.open(viewingBack ? activeDoc?.back : activeDoc?.front, "_blank")}
                >
                  <ExternalLink size={12} className="mr-1" /> PANTALLA COMPLETA
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
