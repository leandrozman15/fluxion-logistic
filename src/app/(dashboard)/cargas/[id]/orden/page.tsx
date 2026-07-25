'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Truck, User, MapPin, 
  Package, Calendar, Loader2, Navigation, FileText, CheckCircle2, Repeat, ClipboardCheck, ShieldCheck
} from "lucide-react";
import { Load, Driver, Truck as TruckType } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  if (loadLoading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2 text-slate-500 font-bold animate-pulse"><Loader2 className="animate-spin" /> GENERANDO DOCUMENTACIÓN OFICIAL...</div>;
  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';
  
  const totalWeight = (load.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0) + 
                      (load.returnStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0);

  const totalDocs = (load.outboundStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0) + 
                    (load.returnStops?.reduce((acc, s) => acc + (s.documents?.length || 0), 0) || 0);

  return (
    <div className="min-h-screen bg-slate-200 py-10 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto space-y-6 print:space-y-0">
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Panel</Button>
          <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 shadow-md"><Printer className="mr-2 h-4 w-4" /> Imprimir Documento (A4)</Button>
        </div>

        <div className="bg-white shadow-2xl p-10 print:shadow-none min-h-[297mm] flex flex-col border border-slate-300 print:border-none rounded-sm">
          {/* HEADER PRINCIPAL */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-600 font-black text-4xl italic tracking-tighter">
                <Truck size={40} strokeWidth={2.5} />
                <span>LOGÍSTICA<span className="text-slate-900">AR</span></span>
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sistema de Gestión de Flotas Pesadas</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-black uppercase bg-slate-900 text-white px-3 py-1 mb-2 inline-block">Orden de Transporte Multidestino</h1>
              <div className="space-y-0">
                <p className="text-3xl font-mono text-blue-600 font-black">{load.orderNumber}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Emisión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
             {/* DATOS DEL CLIENTE */}
             <div className="space-y-4">
                <h2 className="text-xs font-black uppercase border-b-2 border-slate-100 flex items-center gap-2 pb-1 text-slate-400">
                  <ClipboardCheck size={14}/> Datos del Cliente
                </h2>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-800 uppercase">{load.clientName}</p>
                  <p className="text-[11px] text-slate-500 font-medium">TIPO: {load.serviceType.toUpperCase()} {load.isRoundTrip ? '(IDA Y VUELTA)' : '(SOLO IDA)'}</p>
                  <p className="text-[11px] text-slate-500">OPERACIÓN NACIONAL - CONO SUR</p>
                </div>
             </div>

             {/* DATOS DEL CONDUCTOR Y UNIDAD */}
             <div className="space-y-4">
                <h2 className="text-xs font-black uppercase border-b-2 border-slate-100 flex items-center gap-2 pb-1 text-slate-400">
                  <ShieldCheck size={14}/> Conductor y Unidad
                </h2>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Personal</p>
                      <p className="text-[11px] font-black uppercase">{driver ? `${driver.lastName}, ${driver.firstName}` : 'NO ASIGNADO'}</p>
                      <p className="text-[10px] text-slate-500 font-medium">DNI: {driver?.dni || '-'}</p>
                      <p className="text-[10px] text-slate-500 font-medium">LIC: {driver?.licenseNumber || '-'}</p>
                      {driver?.hasLinti && <p className="text-[10px] text-blue-600 font-bold">LINTI: {driver.lintiNumber}</p>}
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Vehículo</p>
                      <p className="text-[11px] font-black uppercase text-blue-700">PATENTE: {truck?.plate || 'S/D'}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{truck?.brand} {truck?.model} ({truck?.year})</p>
                      <p className="text-[10px] text-slate-500 font-medium">SEMI: {truck?.semiTrailer?.plate || 'S/D'}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* TRAMO 1: IDA */}
          <div className="mb-8">
            <h3 className="text-xs font-black bg-blue-50 text-blue-700 px-3 py-2 mb-4 flex items-center justify-between border-l-4 border-blue-600 uppercase tracking-widest">
              <span>TRAMO 1: Logística de Ida</span>
              <Navigation size={14}/>
            </h3>
            
            <div className="space-y-6">
              {/* ORIGEN */}
              <div className="p-4 bg-slate-50 border rounded-lg border-slate-200">
                <div className="flex gap-4">
                  <div className="w-1.5 h-12 bg-green-500 rounded-full shrink-0"></div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Punto de Carga (Origen)</p>
                    <p className="text-sm font-black text-slate-900 uppercase">{load.origin.name}</p>
                    <p className="text-[11px] text-slate-600">{load.origin.address}, {load.origin.province}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Contacto: {load.origin.contact} | {load.origin.phone}</p>
                  </div>
                </div>
              </div>

              {/* PARADAS IDA */}
              <div className="grid gap-4 pl-6">
                {load.outboundStops?.map((stop, i) => (
                  <div key={stop.id} className="p-4 border-2 border-slate-100 rounded-xl space-y-3 relative bg-white">
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">D{i+1}</div>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase text-slate-900">{stop.name}</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{stop.address}, {stop.province}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className="text-sm font-black text-blue-600 italic">{stop.weightKg.toLocaleString()} KG</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase">{stop.units} {stop.unitType} - {stop.description}</div>
                      </div>
                    </div>
                    {/* DOCUMENTACIÓN PARADA */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-slate-200">
                      {stop.documents?.map(doc => (
                        <div key={doc.id} className="text-[9px] font-black border-2 border-slate-900 px-2 py-0.5 uppercase flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-slate-900"></div>
                          {doc.type}: {doc.number} {doc.hasCot ? `[COT OK]` : ''}
                        </div>
                      ))}
                    </div>
                    {stop.instructions && (
                      <div className="bg-amber-50 p-2 rounded text-[9px] text-amber-700 italic font-medium">
                        <b>Obs:</b> {stop.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TRAMO 2: RETORNO (SI CORRESPONDE) */}
          {load.isRoundTrip && (
            <div className="mb-8">
              <h3 className="text-xs font-black bg-orange-50 text-orange-700 px-3 py-2 mb-4 flex items-center justify-between border-l-4 border-orange-600 uppercase tracking-widest">
                <span>TRAMO 2: Logística de Vuelta (Retorno)</span>
                <Repeat size={14}/>
              </h3>

              <div className="space-y-6">
                {/* PARADAS RETORNO */}
                <div className="grid gap-4 pl-6">
                  {load.returnStops?.map((stop, i) => (
                    <div key={stop.id} className="p-4 border-2 border-orange-100 rounded-xl space-y-3 relative bg-orange-50/20">
                      <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 bg-orange-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">R{i+1}</div>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase text-slate-900">{stop.name}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{stop.address}, {stop.province}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-orange-600 italic">{stop.weightKg.toLocaleString()} KG</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-orange-200">
                        {stop.documents?.map(doc => (
                          <div key={doc.id} className="text-[9px] font-black border-2 border-orange-600 text-orange-700 px-2 py-0.5 uppercase">
                             REMITO: {doc.number}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* DESTINO FINAL RETORNO */}
                {load.returnDestination?.name && (
                  <div className="p-4 bg-slate-900 text-white rounded-lg ml-6">
                    <div className="flex gap-4">
                      <div className="w-1.5 h-10 bg-orange-500 rounded-full shrink-0"></div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/50 uppercase">Punto de Descarga Final (Retorno)</p>
                        <p className="text-sm font-black uppercase">{load.returnDestination.name}</p>
                        <p className="text-[10px] opacity-70 leading-tight">{load.returnDestination.address}, {load.returnDestination.province}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RESUMEN DE OPERACIÓN */}
          <div className="mt-auto pt-6 border-t-2 border-slate-100">
             <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Resumen de Operación</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                     <span className="text-slate-500 font-bold">PESO TOTAL:</span>
                     <span className="font-black text-right">{totalWeight.toLocaleString()} KG</span>
                     <span className="text-slate-500 font-bold">REMITOS ASOCIADOS:</span>
                     <span className="font-black text-right">{totalDocs}</span>
                     <span className="text-slate-500 font-bold">LLEGADA ESTIMADA (ETA):</span>
                     <span className="font-black text-right">{load.estimatedArrivalDate ? format(new Date(load.estimatedArrivalDate), "dd/MM/yyyy") : '-'} {load.estimatedArrivalTime}hs</span>
                  </div>
                </div>

                {/* TABLA DE CONTROL FÍSICO */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Control de Puntos</h4>
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <table className="w-full text-[8px] font-black uppercase">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="px-2 py-1 text-left">PUNTO</th>
                          <th className="px-2 py-1 text-left">HORA</th>
                          <th className="px-2 py-1 text-right">FIRMA</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="px-2 py-1.5">ORIGEN</td>
                          <td className="px-2 py-1.5 border-x">____:____</td>
                          <td className="px-2 py-1.5">________________</td>
                        </tr>
                        {load.outboundStops?.map((_, idx) => (
                          <tr key={idx} className="border-b border-slate-100">
                            <td className="px-2 py-1.5">DESTINO {idx + 1}</td>
                            <td className="px-2 py-1.5 border-x">____:____</td>
                            <td className="px-2 py-1.5">________________</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>

             {/* FIRMAS Y QR */}
             <div className="flex justify-between items-end gap-10">
                <div className="flex-1 space-y-10">
                   <div className="flex gap-16">
                      <div className="w-48 border-t-2 border-slate-900 pt-2 text-center">
                         <p className="text-[9px] font-black uppercase italic">Firma Responsable Logística</p>
                      </div>
                      <div className="w-48 border-t-2 border-slate-900 pt-2 text-center">
                         <p className="text-[9px] font-black uppercase italic">Firma Transportista / Chofer</p>
                      </div>
                   </div>
                   <div className="space-y-1 opacity-50">
                      <p className="text-[7px] font-black uppercase italic leading-tight max-w-lg">
                        ESTA ORDEN DE TRANSPORTE ES UN DOCUMENTO INTERNO OFICIAL DE LOGÍSTICA AR. EL CHOFER DEBE CONFIRMAR CADA ENTREGA MEDIANTE EL SISTEMA DIGITAL. LA FALTA DE CONFIRMACIÓN DIGITAL O EL INCUMPLIMIENTO DE LAS NORMAS DE SEGURIDAD VIAL PUEDEN RESULTAR EN PENALIDADES.
                      </p>
                      <p className="text-[8px] font-bold">Documento generado electrónicamente - Validez oficial LogísticaAr HQ</p>
                   </div>
                </div>

                <div className="text-center space-y-2">
                   <div className="p-2 border-2 border-slate-900 rounded bg-white">
                      <QRCodeSVG value={confirmationUrl} size={90} level="H" />
                   </div>
                   <div className="space-y-0">
                    <p className="text-[8px] font-black uppercase tracking-tighter">Seguimiento Digital</p>
                    <p className="text-[6px] font-mono opacity-40">{load.id}</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white;
            color: black;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
