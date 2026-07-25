
'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Truck, User, MapPin, 
  Package, Calendar, Globe, Anchor, Loader2, Navigation, FileText, CheckCircle2, Repeat
} from "lucide-react";
import { Load, Driver, Truck as TruckType } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

export default function LoadOrderDocumentPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<TruckType | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading: loadLoading } = useDoc<Load>(loadRef);

  useEffect(() => {
    async function fetchExtras() {
      if (!db || !load) return;
      try {
        if (load.assignedDriverId) {
          const dSnap = await getDoc(doc(db, "drivers", load.assignedDriverId));
          if (dSnap.exists()) setDriver(dSnap.data() as Driver);
        }
        if (load.assignedTruckId) {
          const tSnap = await getDoc(doc(db, "trucks", load.assignedTruckId));
          if (tSnap.exists()) setTruck(tSnap.data() as TruckType);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingExtras(false);
      }
    }
    if (load) fetchExtras();
  }, [db, load]);

  if (loadLoading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Generando Documentación...</div>;
  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-0">
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2" /> Volver</Button>
          <Button onClick={() => window.print()} className="bg-blue-600"><Printer className="mr-2" /> Imprimir Documento</Button>
        </div>

        <div className="bg-white shadow-2xl p-12 print:shadow-none min-h-[297mm] flex flex-col border border-slate-200 print:border-none rounded-xl print:rounded-none">
          {/* Cabecera */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-3xl">
                <Truck size={36} />
                <span>Logística<span className="text-slate-900">Ar</span></span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Orden de Transporte Multidestino Nacional</p>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-black uppercase tracking-tighter">Hoja de Ruta</h1>
              <p className="text-4xl font-mono text-blue-600 font-bold">{load.orderNumber}</p>
              <p className="text-xs text-slate-500 font-bold">Emisión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xs font-black uppercase bg-slate-900 text-white px-2 py-1 inline-block mb-2">Tipo de Operación</h2>
            <p className="text-lg font-bold capitalize">{load.serviceType} {load.isRoundTrip ? '(IDA Y VUELTA)' : '(SOLO IDA)'}</p>
          </div>

          {/* Trayecto de Ida */}
          <div className="mb-10 space-y-4">
            <h3 className="text-sm font-black uppercase flex items-center gap-2 text-blue-700">
              <Navigation size={18} /> TRAMO 1: LOGÍSTICA DE IDA
            </h3>
            <div className="p-4 bg-slate-50 border rounded-xl space-y-4">
              <div className="flex gap-4">
                <div className="w-1.5 bg-blue-500 rounded-full"></div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Punto de Carga (Origen)</p>
                  <p className="font-bold text-slate-900">{load.origin.name}</p>
                  <p className="text-xs text-slate-600">{load.origin.address}, {load.origin.province}</p>
                </div>
              </div>
              <div className="grid gap-4 pl-6">
                 {load.outboundStops?.map((stop, i) => (
                   <div key={i} className="p-3 bg-white border rounded-lg space-y-2 relative">
                      <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center text-[8px] font-bold">D{i+1}</div>
                      <div className="flex justify-between items-start">
                         <div className="space-y-1">
                           <p className="text-[10px] font-bold uppercase text-blue-600">Destino: {stop.name}</p>
                           <p className="text-[9px] text-slate-500">{stop.address}, {stop.province}</p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] font-bold">{stop.weightKg} Kg</p>
                           <p className="text-[8px] text-slate-400 uppercase">{stop.description}</p>
                         </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed">
                        {stop.documents?.map(doc => (
                          <Badge key={doc.id} variant="outline" className="text-[7px] border-slate-300 font-mono">
                            {doc.type.toUpperCase()}: {doc.number} {doc.hasCot ? `(COT: ${doc.cotNumber})` : ''}
                          </Badge>
                        ))}
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          {/* Trayecto de Vuelta si existe */}
          {load.isRoundTrip && (
            <div className="mb-10 space-y-4">
              <h3 className="text-sm font-black uppercase flex items-center gap-2 text-orange-700">
                <Repeat size={18} /> TRAMO 2: LOGÍSTICA DE VUELTA (RETORNO)
              </h3>
              <div className="p-4 bg-orange-50/30 border border-orange-100 rounded-xl space-y-4">
                <div className="grid gap-4 pl-6">
                   {load.returnStops?.map((stop, i) => (
                      <div key={i} className="p-3 bg-white border border-orange-100 rounded-lg space-y-2 relative">
                          <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-100 rounded-full flex items-center justify-center text-[8px] font-bold text-orange-600">R{i+1}</div>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase text-orange-600">Recolección: {stop.name}</p>
                              <p className="text-[9px] text-slate-500">{stop.address}, {stop.province}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold">{stop.weightKg} Kg</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed">
                            {stop.documents?.map(doc => (
                              <Badge key={doc.id} variant="outline" className="text-[7px] border-orange-200 text-orange-700 font-mono">
                                {doc.type.toUpperCase()}: {doc.number}
                              </Badge>
                            ))}
                          </div>
                      </div>
                   ))}
                   
                   {load.returnDestination?.name && (
                     <div className="flex gap-4 mt-4 border-t border-orange-200 pt-4">
                        <div className="w-1.5 bg-orange-600 rounded-full"></div>
                        <div className="space-y-1">
                          <p className="text-[9px] uppercase font-bold text-orange-400">Punto de Descarga Final (Retorno)</p>
                          <p className="font-bold text-slate-900">{load.returnDestination.name}</p>
                          <p className="text-xs text-slate-600">{load.returnDestination.address}, {load.returnDestination.province}</p>
                        </div>
                     </div>
                   )}
                   
                   {(!load.returnStops || load.returnStops.length === 0) && !load.returnDestination?.name && (
                     <p className="text-xs text-slate-400 italic">Retorno vacío (Solo transporte de regreso).</p>
                   )}
                </div>
              </div>
            </div>
          )}

          {/* Recursos y Unidad */}
          <div className="grid grid-cols-2 gap-10 border-t pt-8 mb-10">
            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Personal y Unidad</h2>
              <div className="space-y-2">
                <p className="text-sm font-bold">{driver ? `${driver.lastName}, ${driver.firstName}` : 'SIN CHOFER ASIGNADO'}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold">DNI: {driver?.dni || '-'} | Licencia: {driver?.licenseNumber || '-'}</p>
                <p className="text-sm font-bold text-blue-600">PATENTE: {truck?.plate || 'SIN UNIDAD'}</p>
              </div>
            </div>
          </div>

          <div className="mt-auto border-t pt-10 flex justify-between items-end">
            <div className="space-y-6">
              <div className="flex gap-16">
                <div className="w-48 border-t border-slate-900 text-center pt-2"><p className="text-[9px] font-bold uppercase">Firma Responsable Logística</p></div>
                <div className="w-48 border-t border-slate-900 text-center pt-2"><p className="text-[9px] font-bold uppercase">Firma Transportista</p></div>
              </div>
              <p className="text-[8px] text-slate-400 italic max-w-sm">Esta orden de transporte es un documento interno oficial. El chofer debe confirmar cada entrega mediante el sistema digital.</p>
            </div>
            <div className="text-center space-y-2">
              <div className="p-2 border-2 border-slate-100 rounded-lg bg-white"><QRCodeSVG value={confirmationUrl} size={80} /></div>
              <p className="text-[7px] font-black uppercase text-slate-400">Escaneo de Control</p>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{` @media print { @page { size: A4; margin: 0; } body { background: white; } .print-hidden { display: none !important; } } `}</style>
    </div>
  );
}
