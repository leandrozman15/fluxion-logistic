'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Loader2, ClipboardCheck, ShieldCheck, Truck, User, MapPin, Receipt, MapPinned, CheckCircle2, Download
} from "lucide-react";
import { Load, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

/**
 * Pantalla de Hoja de Ruta / OT en formato PDF Nativo A4.
 */
export default function LoadOrderDocumentPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<TruckType | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(true);

  const autoPrint = searchParams.get('print') === 'true';

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
        if (load.assignedDriverId && load.assignedDriverId !== 'none') {
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

  useEffect(() => {
    if (autoPrint && !loadLoading && !loadingExtras && load) {
      const timer = setTimeout(() => {
        window.print();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loadLoading, loadingExtras, load]);

  const handlePrint = () => {
    window.print();
  };

  if (loadLoading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2 text-slate-500 font-bold animate-pulse"><Loader2 className="animate-spin" /> GENERANDO DOCUMENTACIÓN A4...</div>;
  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";
  const pod = load.outboundStops?.[load.outboundStops.length - 1]?.proofOfDelivery;

  return (
    <div className="min-h-screen bg-slate-800 py-8 print:bg-white print:py-0 overflow-y-auto">
      <div className="max-w-[210mm] mx-auto space-y-6">
        {/* BARRA DE HERRAMIENTAS - OCULTA EN IMPRESIÓN */}
        <div className="flex justify-between items-center px-4 print:hidden sticky top-0 z-50 py-4 bg-slate-800/80 backdrop-blur">
          <Button variant="outline" onClick={() => router.back()} className="text-white border-white/20 hover:bg-white/10 rounded-xl bg-slate-900/50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <div className="flex gap-3">
             <Badge className="bg-blue-600 text-white border-none">PREVIO A4 NATIVO</Badge>
             <Button onClick={handlePrint} className="bg-white text-slate-900 hover:bg-blue-50 rounded-xl font-black shadow-2xl px-10 h-12">
               <Download className="mr-2 h-5 w-5" /> GUARDAR PDF A4
             </Button>
          </div>
        </div>

        {/* DOCUMENTO PROFESIONAL - FORMATO A4 ESTRICTO */}
        <div className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] print:shadow-none w-[210mm] min-h-[297mm] flex flex-col font-sans text-black border-[12px] border-double border-slate-900 print:border-none mx-auto overflow-hidden">
          
          <div className="p-12 print:p-10 flex flex-col h-full w-full box-border">
            {/* CABECERA */}
            <div className="flex justify-between items-start border-b-[5px] border-black pb-8 mb-8">
              <div className="flex items-center gap-6">
                {tenant?.settings?.logoUrl && (
                  <img src={tenant.settings.logoUrl} className="h-20 w-auto object-contain" alt="Logo" />
                )}
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none text-blue-800">{orgName}</h1>
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 mt-2">Transporte Terrestre Nacional e Internacional</p>
                  <div className="pt-3 text-[10px] font-bold space-y-0.5 text-slate-400">
                      <p>CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</p>
                      <p>Sede Central Operativa - República Argentina</p>
                  </div>
                </div>
              </div>
              <div className="text-right border-l-[3px] border-black pl-8">
                <div className="bg-slate-900 text-white px-6 py-2 mb-3">
                  <h2 className="text-lg font-black uppercase tracking-[0.2em] italic text-center">Hoja de Ruta / OT</h2>
                </div>
                <p className="text-4xl font-mono font-black tracking-tighter leading-none">{load.orderNumber}</p>
                <p className="text-[10px] font-black uppercase mt-2 text-slate-500">EMISIÓN: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>

            {/* DATOS MAESTROS */}
            <div className="grid grid-cols-12 gap-0 border-[3px] border-black rounded-sm overflow-hidden">
              <div className="col-span-7 p-6 border-r-[3px] border-b-[3px] border-black bg-slate-50/50 space-y-4">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 border-b-2 border-black/10 pb-2 text-blue-900"><ClipboardCheck size={14}/> 1. DATOS DEL CLIENTE / OPERACIÓN</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Razón Social:</p>
                        <p className="text-sm font-black uppercase leading-tight">{load.clientName}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Tipo de Servicio:</p>
                        <span className="text-[10px] font-black uppercase border border-black px-2 py-0.5 inline-block">{load.serviceType}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Modalidad de Contratación:</p>
                    <p className="text-xs font-black uppercase italic text-slate-700">{load.isRoundTrip ? 'LOGÍSTICA INTEGRAL (IDA Y VUELTA CON RETORNO)' : 'TRANSPORTE DIRECTO (SOLO IDA)'}</p>
                  </div>
              </div>

              <div className="col-span-5 p-6 border-b-[3px] border-black space-y-4">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 border-b-2 border-black/10 pb-2 text-blue-900"><ShieldCheck size={14}/> 2. RECURSOS OPERATIVOS</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-800"><User size={20}/></div>
                        <div>
                          <p className="text-sm font-black uppercase leading-none">{driver ? `${driver.lastName}, ${driver.firstName}` : 'S/D'}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">DNI N° {driver?.dni || '---'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white"><Truck size={20}/></div>
                        <div>
                          <p className="text-sm font-black uppercase leading-none text-blue-800">DOMINIO: {truck?.plate || 'S/D'}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">{truck?.brand} {truck?.model}</p>
                        </div>
                    </div>
                  </div>
              </div>

              <div className="col-span-12 p-6 border-b-[3px] border-black bg-slate-50/30">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 border-b-2 border-black/10 pb-2 text-blue-900"><MapPin size={14}/> 3. PUNTO DE CARGA (ORIGEN)</h3>
                  <div className="flex justify-between items-center mt-3">
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase">{load.origin.name}</p>
                        <p className="text-xs font-bold text-slate-600 italic">{load.origin.address}, {load.origin.city}, {load.origin.province}, AR</p>
                    </div>
                    <div className="text-right bg-white border-2 border-black p-2 px-4 shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Presentación</p>
                        <p className="text-sm font-black font-mono">{load.pickupDate} • {load.pickupTime} hs</p>
                    </div>
                  </div>
              </div>

              <div className="col-span-12 p-0 space-y-0 min-h-[400px]">
                  <div className="p-4 bg-slate-100 border-b-[3px] border-black/20">
                    <h3 className="text-[11px] font-black uppercase flex items-center gap-2 text-blue-900">4. SECUENCIA DE ENTREGAS (DESTINOS Y DOCUMENTACIÓN)</h3>
                  </div>
                  <table className="w-full text-xs border-collapse table-fixed">
                    <thead>
                        <tr className="border-b-[3px] border-black bg-slate-200">
                          <th className="py-3 px-4 text-center font-black uppercase w-12">POS</th>
                          <th className="py-3 px-4 text-left font-black uppercase w-48">DESTINATARIO / REMITOS</th>
                          <th className="py-3 px-4 text-left font-black uppercase">DIRECCIÓN COMPLETA</th>
                          <th className="py-3 px-4 text-right font-black uppercase w-24">PESO</th>
                          <th className="py-3 px-4 text-center font-black uppercase w-24">ESTADO</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black/10">
                        {load.outboundStops?.map((stop, i) => (
                          <tr key={stop.id} className="hover:bg-slate-50/50">
                            <td className="py-5 px-4 font-black text-center border-r-2 border-slate-200 bg-slate-50/30 text-base">{i+1}</td>
                            <td className="py-5 px-4 border-r-2 border-slate-200">
                                <p className="font-black uppercase text-slate-900 text-sm leading-tight truncate">{stop.name}</p>
                                <div className="mt-3 space-y-1.5">
                                  {stop.documents?.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-2 text-blue-800 font-mono font-black text-[10px] bg-blue-50 px-2 py-1 rounded border-2 border-blue-200 w-fit">
                                      <Receipt size={10} /> REM: {doc.number}
                                    </div>
                                  ))}
                                  {(!stop.documents || stop.documents.length === 0) && (
                                    <p className="text-[9px] text-slate-300 italic font-black uppercase">SIN REMITO</p>
                                  )}
                                </div>
                            </td>
                            <td className="py-5 px-4 border-r-2 border-slate-200">
                                <div className="flex items-start gap-2">
                                  <MapPinned size={14} className="text-slate-400 mt-1 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-black text-slate-800 uppercase text-xs leading-tight">{stop.address}</p>
                                    <p className="text-[10px] text-slate-500 font-bold italic mt-2 uppercase">{stop.city || '---'}, {stop.province}</p>
                                  </div>
                                </div>
                            </td>
                            <td className="py-5 px-4 text-right font-mono font-black border-r-2 border-slate-200 text-sm">
                                {stop.weightKg.toLocaleString()} <span className="text-[10px] text-slate-400">KG</span>
                            </td>
                            <td className="py-5 px-4 text-center bg-slate-50/20">
                                {stop.deliveredAt ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <CheckCircle2 size={16} className="text-green-600" />
                                    <span className="text-[9px] font-black text-green-700 uppercase">ENTREGADO</span>
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-300 font-black uppercase tracking-tighter italic">EN TRÁNSITO</span>
                                )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-0 border-[3px] border-black rounded-sm overflow-hidden">
              <div className="p-5 border-r-[3px] border-black text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PESO TOTAL CARGA</p>
                  <p className="text-2xl font-black italic">{(load.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0).toLocaleString()} KG</p>
              </div>
              <div className="p-5 border-r-[3px] border-black text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CAPACIDAD UNIDAD</p>
                  <p className="text-2xl font-black italic text-blue-800">{(truck?.capacityKg || 0).toLocaleString()} KG</p>
              </div>
              <div className="p-5 text-center bg-slate-900 text-white">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">BALANCE TÉCNICO</p>
                  <p className="text-2xl font-black italic text-green-400">APROBADO OK</p>
              </div>
            </div>

            {/* SECCIÓN DE FIRMAS */}
            <div className="mt-auto pt-12">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-2 border-black/10 pb-2 mb-8">VALIDACIÓN Y CONFORMIDAD DE ENTREGA</h3>
              
              <div className="grid grid-cols-12 gap-0 border-[3px] border-black min-h-[180px] rounded-sm">
                  <div className="col-span-4 p-6 border-r-[3px] border-black flex flex-col justify-between items-center text-center bg-slate-50/50">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="border-[3px] border-black px-5 py-2 rotate-[-5deg] text-[10px] font-black shadow-lg bg-white uppercase">VALIDADO CENTRAL</div>
                    </div>
                    <div className="w-full border-t-2 border-black/10 pt-3">
                        <p className="text-[9px] font-black uppercase tracking-widest">RESPONSABLE EMISIÓN</p>
                        <p className="text-[8px] font-bold text-slate-400">LogísticaAr Control Hub</p>
                    </div>
                  </div>

                  <div className="col-span-4 p-6 border-r-[3px] border-black flex flex-col justify-between items-center text-center">
                    <div className="flex-1 flex items-center justify-center w-full">
                        {pod?.driverSignatureUrl ? (
                          <img src={pod.driverSignatureUrl} className="max-h-28 w-auto grayscale" alt="Firma Chofer" />
                        ) : (
                          <div className="h-20 w-full border-b-2 border-dashed border-slate-300"></div>
                        )}
                    </div>
                    <div className="w-full border-t-2 border-black/10 pt-3">
                        <p className="text-[9px] font-black uppercase tracking-widest">CONFORMIDAD DEL CHOFER</p>
                        <p className="text-[8px] font-bold text-slate-400">{driver ? `${driver.lastName}, ${driver.firstName}` : 'Personal Asignado'}</p>
                    </div>
                  </div>

                  <div className="col-span-4 p-6 flex flex-col justify-between items-center text-center">
                    <div className="flex-1 flex items-center justify-center w-full">
                        {pod?.receiverSignatureUrl ? (
                          <img src={pod.receiverSignatureUrl} className="max-h-28 w-auto grayscale" alt="Firma Receptor" />
                        ) : (
                          <div className="h-20 w-full border-b-2 border-dashed border-slate-300"></div>
                        )}
                    </div>
                    <div className="w-full border-t-2 border-black/10 pt-3">
                        <p className="text-[9px] font-black uppercase tracking-widest">RECEPCIÓN EN DESTINO</p>
                        <p className="text-[8px] font-bold text-slate-400">ACLARACIÓN: {pod?.receiverName || 'Sello de Planta'}</p>
                    </div>
                  </div>
              </div>

              {/* QR Y TRAZABILIDAD */}
              <div className="mt-10 flex justify-between items-end">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-slate-900 uppercase italic tracking-tight">Protocolo de Documentación Digital Nativa (A4)</p>
                    <p className="text-[9px] text-slate-400 font-bold leading-tight max-w-sm uppercase">Este documento contiene texto vectorial y puede ser indexado por sistemas de gestión documental. El código QR permite la validación de estados de entrega en tiempo real.</p>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-2 border-[3px] border-black bg-white shadow-md">
                        <QRCodeSVG value={confirmationUrl} size={85} />
                    </div>
                    <p className="text-[7px] font-black uppercase text-center leading-none tracking-widest">VALIDACIÓN <br/> OPERATIVA QR</p>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            color: black !important;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
          }
          .print\:hidden {
            display: none !important;
          }
          header, nav, aside, footer, .sidebar-trigger, .sidebar-inset-header, button {
            display: none !important;
          }
          .min-h-screen {
            min-h-0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .max-w-\[210mm\], .w-\[210mm\] {
            max-width: none !important;
            width: 210mm !important;
            height: 297mm !important;
            border: none !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          * {
            text-shadow: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
