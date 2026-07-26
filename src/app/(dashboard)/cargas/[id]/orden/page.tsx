
'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { 
  Printer, ArrowLeft, Truck, User, MapPin, 
  Package, Calendar, Loader2, Navigation, FileText, CheckCircle2, Repeat, ClipboardCheck, ShieldCheck, Anchor
} from "lucide-react";
import { Load, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { formatSafeDate } from "@/lib/utils/date-utils";

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

  const tenantRef = useMemo(() => {
    if (!db) return null;
    return doc(db, "tenants", "default_tenant");
  }, [db]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

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

  const orgName = tenant?.name || "LOGÍSTICA AR";
  const logoUrl = tenant?.settings?.logoUrl || "/icono.png";

  return (
    <div className="min-h-screen bg-slate-200 py-10 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto space-y-6 print:space-y-0">
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Panel</Button>
          <div className="flex gap-2">
             <Button variant="outline" onClick={() => window.print()} className="shadow-md"><Printer className="mr-2 h-4 w-4" /> Imprimir Documento</Button>
          </div>
        </div>

        <div className="bg-white shadow-2xl p-10 print:shadow-none min-h-[297mm] flex flex-col border border-slate-300 print:border-none rounded-sm">
          {/* HEADER PRINCIPAL DINÁMICO */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-blue-600 font-black text-4xl italic tracking-tighter">
                <div className="relative w-14 h-14">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="uppercase">{orgName}</span>
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
                   </div>
                   <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Vehículo</p>
                      <p className="text-[11px] font-black uppercase text-blue-700">PATENTE: {truck?.plate || 'S/D'}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{truck?.brand} {truck?.model}</p>
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
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border rounded-lg border-slate-200">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="w-1.5 h-12 bg-green-500 rounded-full shrink-0"></div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Punto de Carga (Origen)</p>
                      <p className="text-sm font-black text-slate-900 uppercase">{load.origin.name}</p>
                      <p className="text-[11px] text-slate-600">{load.origin.address}</p>
                    </div>
                  </div>
                  {load.origin.dockName && (
                    <div className="bg-blue-600 text-white p-3 rounded-lg text-center min-w-[100px] shadow-md">
                       <p className="text-[8px] font-bold uppercase opacity-70">Posicionamiento</p>
                       <p className="text-xl font-black italic">{load.origin.dockName}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 pl-6">
                {load.outboundStops?.map((stop, i) => (
                  <div key={stop.id} className="p-4 border-2 border-slate-100 rounded-xl space-y-2 relative bg-white">
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">{i+1}</div>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <p className="text-xs font-black uppercase text-slate-900">{stop.name}</p>
                           {stop.dockName && <Badge variant="outline" className="text-[7px] h-3 border-blue-600 text-blue-600 uppercase font-black px-1"><Anchor size={8} className="mr-0.5" /> {stop.dockName}</Badge>}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">{stop.address}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-blue-600 italic">{stop.weightKg.toLocaleString()} KG</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECCIÓN DE FIRMAS Y CIERRE LEGAL */}
          <div className="mt-auto pt-6 border-t-2 border-slate-100">
             <div className="flex justify-between items-end gap-6">
                <div className="flex-1">
                   <div className="grid grid-cols-3 gap-8">
                      {/* Firma Admin / Logística */}
                      <div className="flex flex-col items-center">
                         <div className="w-full h-24 border-b border-slate-300 flex items-end justify-center pb-1">
                            <p className="text-[8px] text-slate-300 italic">Espacio para sello institucional</p>
                         </div>
                         <p className="text-[9px] font-black uppercase mt-2">Responsable Logística</p>
                         <p className="text-[7px] text-slate-400 uppercase tracking-tighter">Emisión Digital Centralizada</p>
                      </div>

                      {/* Firma Conductor / Transportista (CAPTURA REAL) */}
                      <div className="flex flex-col items-center">
                         <div className="w-full h-24 border-b border-slate-300 flex items-center justify-center overflow-hidden">
                            {load.proofOfDelivery?.driverSignatureUrl ? (
                              <img src={load.proofOfDelivery.driverSignatureUrl} alt="Firma Chofer" className="max-h-full object-contain" />
                            ) : (
                              <div className="text-[8px] text-slate-200 font-bold border-2 border-dashed border-slate-100 p-4 rounded text-center">Firma Chofer al Cierre</div>
                            )}
                         </div>
                         <p className="text-[9px] font-black uppercase mt-2">Transportista / Chofer</p>
                         <p className="text-[7px] text-slate-400 uppercase tracking-tighter">{driver ? `${driver.lastName}, ${driver.firstName}` : 'Firma Digital Pendiente'}</p>
                      </div>

                      {/* Firma Receptor / Cliente (CAPTURA REAL) */}
                      <div className="flex flex-col items-center">
                         <div className="w-full h-24 border-b border-slate-300 flex items-center justify-center overflow-hidden">
                            {load.proofOfDelivery?.receiverSignatureUrl ? (
                              <img src={load.proofOfDelivery.receiverSignatureUrl} alt="Firma Receptor" className="max-h-full object-contain" />
                            ) : (
                              <div className="text-[8px] text-slate-200 font-bold border-2 border-dashed border-slate-100 p-4 rounded text-center">Firma Receptor en Destino</div>
                            )}
                         </div>
                         <p className="text-[9px] font-black uppercase mt-2">Receptor Mercadería</p>
                         <div className="text-center">
                            <p className="text-[7px] text-slate-400 uppercase tracking-tighter">{load.proofOfDelivery?.receiverName || 'Aclaración Firma'}</p>
                            {load.proofOfDelivery?.confirmedAt && (
                              <p className="text-[6px] text-blue-600 font-bold">VALiDADO: {formatSafeDate(load.proofOfDelivery.confirmedAt)}</p>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                {/* QR DE VALIDACIÓN */}
                <div className="text-center space-y-2 shrink-0">
                   <div className="p-2 border-2 border-slate-900 rounded bg-white">
                      <QRCodeSVG value={confirmationUrl} size={90} level="H" />
                   </div>
                   <div className="space-y-0">
                    <p className="text-[8px] font-black uppercase tracking-tighter">Validación Digital</p>
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
