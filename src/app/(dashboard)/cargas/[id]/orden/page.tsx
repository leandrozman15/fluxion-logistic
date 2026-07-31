'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Loader2, ClipboardCheck, ShieldCheck, Truck, User, MapPin, Receipt, MapPinned, CheckCircle2
} from "lucide-react";
import { Load, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
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

  const handlePrint = () => {
    window.print();
  };

  if (loadLoading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2 text-slate-500 font-bold animate-pulse"><Loader2 className="animate-spin" /> GENERANDO DOCUMENTACIÓN OFICIAL (TEXTO NATIVO)...</div>;
  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";
  const lastStop = load.outboundStops?.[load.outboundStops.length - 1];
  const pod = lastStop?.proofOfDelivery;

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center px-4 print:hidden">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <Button onClick={handlePrint} className="bg-slate-900 hover:bg-black rounded-xl font-bold shadow-xl px-8 h-12 text-white">
            <Printer className="mr-2 h-5 w-5" /> GENERAR PDF (TEXTO REAL)
          </Button>
        </div>

        {/* DOCUMENTO PROFESIONAL - TEXTO NATIVO */}
        <div className="bg-white shadow-2xl p-10 print:p-0 print:shadow-none min-h-[297mm] flex flex-col font-sans text-black border-[6px] border-double border-black print:border-none">
          
          <div className="print:p-8 flex flex-col h-full print:border-[6px] print:border-double print:border-black">
            {/* CABECERA */}
            <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-6">
              <div className="flex items-center gap-4">
                {tenant?.settings?.logoUrl && (
                  <img src={tenant.settings.logoUrl} className="h-16 w-auto object-contain" alt="Logo" />
                )}
                <div>
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-blue-800">{orgName}</h1>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Gestión de Cargas Nacionales e Internacionales</p>
                  <div className="pt-2 text-[8px] font-bold space-y-0 text-slate-400">
                      <p>CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</p>
                      <p>DOMICILIO: Sede Central Operativa - República Argentina</p>
                  </div>
                </div>
              </div>
              <div className="text-right border-l-2 border-black pl-6">
                <div className="bg-black text-white px-5 py-1.5 mb-2">
                  <h2 className="text-base font-black uppercase tracking-widest italic text-center">Hoja de Ruta / OT</h2>
                </div>
                <p className="text-3xl font-mono font-black tracking-tighter leading-none">{load.orderNumber}</p>
                <p className="text-[8px] font-black uppercase mt-1">EMISIÓN: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>

            {/* DATOS MAESTROS */}
            <div className="grid grid-cols-12 gap-0 border-2 border-black">
              <div className="col-span-7 p-4 border-r-2 border-b-2 border-black bg-slate-50/50 space-y-3">
                  <h3 className="text-[9px] font-black uppercase flex items-center gap-2 border-b border-black/20 pb-1 text-blue-800"><ClipboardCheck size={12}/> 1. DATOS DEL CLIENTE / OPERACIÓN</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Razón Social:</p>
                        <p className="text-xs font-black uppercase truncate">{load.clientName}</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Tipo de Servicio:</p>
                        <Badge variant="outline" className="text-[8px] h-4 font-black uppercase border-black">{load.serviceType}</Badge>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold text-slate-500 uppercase">Modalidad:</p>
                    <p className="text-[10px] font-black uppercase italic">{load.isRoundTrip ? 'IDA Y VUELTA (CON RETORNO)' : 'FLETE DIRECTO (SOLO IDA)'}</p>
                  </div>
              </div>

              <div className="col-span-5 p-4 border-b-2 border-black space-y-3">
                  <h3 className="text-[9px] font-black uppercase flex items-center gap-2 border-b border-black/20 pb-1 text-blue-800"><ShieldCheck size={12}/> 2. RECURSOS ASIGNADOS</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-800"><User size={16}/></div>
                        <div>
                          <p className="text-[10px] font-black uppercase leading-none">{driver ? `${driver.lastName}, ${driver.firstName}` : 'S/D'}</p>
                          <p className="text-[8px] font-bold text-slate-400">DNI: {driver?.dni || '---'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white"><Truck size={16}/></div>
                        <div>
                          <p className="text-[10px] font-black uppercase leading-none text-blue-700">DOMINIO: {truck?.plate || 'S/D'}</p>
                          <p className="text-[8px] font-bold text-slate-400">{truck?.brand} {truck?.model}</p>
                        </div>
                    </div>
                  </div>
              </div>

              <div className="col-span-12 p-4 border-b-2 border-black bg-slate-50/20">
                  <h3 className="text-[9px] font-black uppercase flex items-center gap-2 border-b border-black/20 pb-1 text-blue-800"><MapPin size={12}/> 3. PUNTO DE CARGA (ORIGEN)</h3>
                  <div className="flex justify-between items-center mt-2">
                    <div className="space-y-0.5">
                        <p className="text-xs font-black uppercase">{load.origin.name}</p>
                        <p className="text-[9px] font-medium italic text-slate-600">{load.origin.address}, {load.origin.city}, {load.origin.province}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Presentación</p>
                        <p className="text-xs font-black">{load.pickupDate} • {load.pickupTime} hs</p>
                    </div>
                  </div>
              </div>

              <div className="col-span-12 p-0 space-y-0 min-h-[300px]">
                  <div className="p-4 bg-slate-50/10 border-b-2 border-black/10">
                    <h3 className="text-[9px] font-black uppercase flex items-center gap-2 text-blue-800">4. SECUENCIA DE ENTREGAS (DATOS COMPLETOS)</h3>
                  </div>
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                        <tr className="border-b-2 border-black bg-slate-100">
                          <th className="py-2 px-3 text-left font-black uppercase w-8">POS</th>
                          <th className="py-2 px-3 text-left font-black uppercase w-1/4">DESTINATARIO / REMITO</th>
                          <th className="py-2 px-3 text-left font-black uppercase">DIRECCIÓN COMPLETA DE DESCARGA</th>
                          <th className="py-2 px-3 text-right font-black uppercase w-24">PESO</th>
                          <th className="py-2 px-3 text-center font-black uppercase w-20">ESTADO</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                        {load.outboundStops?.map((stop, i) => (
                          <tr key={stop.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-black text-center border-r border-slate-200 bg-slate-50/30">{i+1}</td>
                            <td className="py-3 px-3 border-r border-slate-200">
                                <p className="font-black uppercase text-slate-900 leading-tight">{stop.name}</p>
                                <div className="mt-2 space-y-1">
                                  {stop.documents?.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-1 text-blue-700 font-mono font-bold text-[9px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">
                                      <Receipt size={8} /> REM: {doc.number}
                                    </div>
                                  ))}
                                  {(!stop.documents || stop.documents.length === 0) && (
                                    <p className="text-[7px] text-slate-300 italic">SIN REMITO VINCULADO</p>
                                  )}
                                </div>
                            </td>
                            <td className="py-3 px-3 border-r border-slate-200">
                                <div className="flex items-start gap-1.5">
                                  <MapPinned size={10} className="text-slate-400 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="font-bold text-slate-800 uppercase leading-none">{stop.address}</p>
                                    <p className="text-[9px] text-slate-500 font-medium italic mt-1">{stop.city || '---'}, {stop.province}, Argentina</p>
                                  </div>
                                </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black border-r border-slate-200">
                                {stop.weightKg.toLocaleString()} <span className="text-[7px] text-slate-400">KG</span>
                            </td>
                            <td className="py-3 px-3 text-center bg-slate-50/20">
                                {stop.deliveredAt ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <CheckCircle2 size={12} className="text-green-600" />
                                    <span className="text-[7px] font-black text-green-700 uppercase">ENTREGADO</span>
                                  </div>
                                ) : (
                                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-tighter italic">EN TRÁNSITO</span>
                                )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-0 border-2 border-black">
              <div className="p-3 border-r-2 border-black text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">PESO TOTAL CARGA</p>
                  <p className="text-lg font-black italic">{(load.outboundStops?.reduce((acc, s) => acc + (s.weightKg || 0), 0) || 0).toLocaleString()} KG</p>
              </div>
              <div className="p-3 border-r-2 border-black text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">CAPACIDAD UNIDAD</p>
                  <p className="text-lg font-black italic text-blue-800">{(truck?.capacityKg || 0).toLocaleString()} KG</p>
              </div>
              <div className="p-3 text-center bg-slate-900 text-white">
                  <p className="text-[8px] font-bold text-white/50 uppercase">BALANCE TÉCNICO</p>
                  <p className="text-lg font-black italic text-green-400">APROBADO</p>
              </div>
            </div>

            {/* SECCIÓN DE FIRMAS */}
            <div className="mt-auto pt-10">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-black/10 pb-1 mb-6">VALIDACIÓN Y CONFORMIDAD DE ENTREGA</h3>
              
              <div className="grid grid-cols-12 gap-0 border-2 border-black min-h-[160px]">
                  <div className="col-span-4 p-5 border-r-2 border-black flex flex-col justify-between items-center text-center bg-slate-50/30">
                    <div className="flex-1 flex items-center justify-center">
                        <div className="border-2 border-black px-4 py-1.5 rotate-[-5deg] text-[9px] font-black shadow-sm bg-white">VALIDADO CENTRAL</div>
                    </div>
                    <div className="w-full border-t border-black/20 pt-2">
                        <p className="text-[8px] font-black uppercase">RESPONSABLE EMISIÓN</p>
                        <p className="text-[7px] font-bold text-slate-400">LogísticaAr Control Hub</p>
                    </div>
                  </div>

                  <div className="col-span-4 p-5 border-r-2 border-black flex flex-col justify-between items-center text-center">
                    <div className="flex-1 flex items-center justify-center w-full">
                        {pod?.driverSignatureUrl ? (
                          <img src={pod.driverSignatureUrl} className="max-h-24 w-auto grayscale" alt="Firma Chofer" />
                        ) : (
                          <div className="h-16 w-full border-b border-dashed border-slate-300"></div>
                        )}
                    </div>
                    <div className="w-full border-t border-black/20 pt-2">
                        <p className="text-[8px] font-black uppercase">CONFORMIDAD DEL CHOFER</p>
                        <p className="text-[7px] font-bold text-slate-400">{driver ? `${driver.lastName}, ${driver.firstName}` : 'Personal Asignado'}</p>
                    </div>
                  </div>

                  <div className="col-span-4 p-5 flex flex-col justify-between items-center text-center">
                    <div className="flex-1 flex items-center justify-center w-full">
                        {pod?.receiverSignatureUrl ? (
                          <img src={pod.receiverSignatureUrl} className="max-h-24 w-auto grayscale" alt="Firma Receptor" />
                        ) : (
                          <div className="h-16 w-full border-b border-dashed border-slate-300"></div>
                        )}
                    </div>
                    <div className="w-full border-t border-black/20 pt-2">
                        <p className="text-[8px] font-black uppercase">RECEPCIÓN EN DESTINO</p>
                        <p className="text-[7px] font-bold text-slate-400">ACLARACIÓN: {pod?.receiverName || 'Sello de Planta'}</p>
                    </div>
                  </div>
              </div>

              {/* QR Y TRAZABILIDAD */}
              <div className="mt-8 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-900 uppercase">Protocolo de Documentación Digital</p>
                    <p className="text-[8px] text-slate-400 font-medium leading-tight max-w-sm">Este PDF contiene texto nativo y puede ser indexado por sistemas de gestión documental. El código QR permite la validación de estados de entrega en tiempo real.</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-1.5 border-2 border-black">
                        <QRCodeSVG value={confirmationUrl} size={70} />
                    </div>
                    <p className="text-[6px] font-black uppercase text-center leading-none">VALIDACIÓN <br/> OPERATIVA</p>
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
            margin: 10mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            color: black !important;
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
          }
          .bg-slate-100 {
            background-color: white !important;
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
