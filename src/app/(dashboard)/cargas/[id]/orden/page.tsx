
'use client';

import { useMemo, useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Loader2, ClipboardCheck, ShieldCheck, Truck, User, MapPin, Download
} from "lucide-react";
import { Load, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

function LoadOrderContent() {
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
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loadLoading, loadingExtras, load]);

  if (loadLoading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2 font-bold animate-pulse text-slate-500"><Loader2 className="animate-spin" /> GENERANDO HOJA DE RUTA A4...</div>;
  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";

  return (
    <div className="min-h-screen bg-slate-800 py-8 print:bg-white print:py-0 overflow-y-auto">
      <div className="max-w-[210mm] mx-auto space-y-6">
        <div className="flex justify-between items-center px-4 print:hidden">
          <Button variant="outline" onClick={() => router.back()} className="text-white border-white/20 hover:bg-white/10 rounded-xl bg-slate-900/50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <div className="flex gap-2">
             <Badge className="bg-blue-600 text-white border-none">PREVIO A4 VECTORIAL</Badge>
             <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-blue-50 rounded-xl font-black shadow-2xl px-10 h-12">
               <Download className="mr-2 h-5 w-5" /> GENERAR PDF A4
             </Button>
          </div>
        </div>

        {/* DOCUMENTO A4 VECTORIAL */}
        <div className="bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] mx-auto text-black border-[12px] border-double border-slate-900 print:border-none flex flex-col font-sans overflow-hidden">
          <div className="p-12 print:p-10 flex flex-col h-full w-full box-border">
            <div className="flex justify-between items-start border-b-[5px] border-black pb-8 mb-8">
              <div className="flex items-center gap-6">
                {tenant?.settings?.logoUrl && <img src={tenant.settings.logoUrl} className="h-20 w-auto object-contain" alt="Logo" />}
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none text-blue-800">{orgName}</h1>
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 mt-2">Transporte Terrestre Nacional e Internacional</p>
                  <p className="pt-3 text-[10px] font-bold text-slate-400">CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</p>
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

            <div className="grid grid-cols-12 border-[3px] border-black rounded-sm overflow-hidden mb-8">
              <div className="col-span-7 p-6 border-r-[3px] border-b-[3px] border-black bg-slate-50/50 space-y-4">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 border-b-2 border-black/10 pb-2 text-blue-900"><ClipboardCheck size={14}/> 1. DATOS DEL CLIENTE</h3>
                  <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Razón Social:</p>
                      <p className="text-lg font-black uppercase leading-tight">{load.clientName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Modalidad:</p>
                    <p className="text-xs font-black uppercase italic text-slate-700">{load.isRoundTrip ? 'LOGÍSTICA INTEGRAL (RETORNO)' : 'TRANSPORTE DIRECTO'}</p>
                  </div>
              </div>
              <div className="col-span-5 p-6 border-b-[3px] border-black space-y-4">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 border-b-2 border-black/10 pb-2 text-blue-900"><ShieldCheck size={14}/> 2. RECURSOS</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-800"><User size={20}/></div>
                        <div>
                          <p className="text-sm font-black uppercase leading-none">{driver ? `${driver.lastName}, ${driver.firstName}` : 'S/D'}</p>
                          <p className="text-[10px] font-bold text-slate-400">DNI: {driver?.dni || '---'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white"><Truck size={20}/></div>
                        <div>
                          <p className="text-sm font-black uppercase leading-none text-blue-800">DOMINIO: {truck?.plate || 'S/D'}</p>
                        </div>
                    </div>
                  </div>
              </div>
              <div className="col-span-12 p-6 bg-slate-50/30">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 border-b-2 border-black/10 pb-2 text-blue-900"><MapPin size={14}/> 3. PUNTO DE CARGA</h3>
                  <div className="flex justify-between items-center mt-3">
                    <div>
                        <p className="text-sm font-black uppercase">{load.origin.name}</p>
                        <p className="text-xs font-bold text-slate-600 italic">{load.origin.address}, {load.origin.city}</p>
                    </div>
                    <div className="text-right bg-white border-2 border-black p-2 px-4 shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Presentación</p>
                        <p className="text-sm font-black font-mono">{load.pickupDate} • {load.pickupTime} hs</p>
                    </div>
                  </div>
              </div>
            </div>

            <div className="border-[3px] border-black flex-1 flex flex-col min-h-[400px]">
              <div className="p-4 bg-slate-200 border-b-[3px] border-black">
                <h3 className="text-[11px] font-black uppercase text-blue-900">4. SECUENCIA DE ENTREGAS</h3>
              </div>
              <table className="w-full text-xs border-collapse table-fixed">
                <thead>
                    <tr className="border-b-[3px] border-black bg-slate-100">
                      <th className="py-3 px-4 text-center font-black uppercase w-12">POS</th>
                      <th className="py-3 px-4 text-left font-black uppercase w-48">DESTINATARIO</th>
                      <th className="py-3 px-4 text-left font-black uppercase">DIRECCIÓN</th>
                      <th className="py-3 px-4 text-right font-black uppercase w-24">PESO</th>
                    </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10">
                    {load.outboundStops?.map((stop, i) => (
                      <tr key={stop.id} className="hover:bg-slate-50/50">
                        <td className="py-5 px-4 font-black text-center border-r-2 border-slate-200 text-base">{i+1}</td>
                        <td className="py-5 px-4 border-r-2 border-slate-200">
                            <p className="font-black uppercase text-slate-900 text-sm leading-tight truncate">{stop.name}</p>
                            <div className="mt-2 space-y-1">
                              {stop.documents?.map(doc => (
                                <div key={doc.id} className="text-blue-800 font-mono font-black text-[9px] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">REM: {doc.number}</div>
                              ))}
                            </div>
                        </td>
                        <td className="py-5 px-4 border-r-2 border-slate-200">
                            <p className="font-black text-slate-800 uppercase text-xs">{stop.address}</p>
                            <p className="text-[10px] text-slate-500 font-bold italic mt-1 uppercase">{stop.city}, {stop.province}</p>
                        </td>
                        <td className="py-5 px-4 text-right font-mono font-black text-sm">
                            {stop.weightKg.toLocaleString()} <span className="text-[10px] text-slate-400">KG</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="mt-auto pt-12">
              <div className="grid grid-cols-12 gap-0 border-[3px] border-black min-h-[180px] rounded-sm">
                  <div className="col-span-4 p-6 border-r-[3px] border-black flex flex-col justify-between items-center text-center bg-slate-50/50">
                    <div className="border-[3px] border-black px-5 py-2 rotate-[-5deg] text-[10px] font-black shadow-lg bg-white uppercase">VALIDADO CENTRAL</div>
                    <p className="text-[9px] font-black uppercase tracking-widest mt-4">RESPONSABLE EMISIÓN</p>
                  </div>
                  <div className="col-span-4 p-6 border-r-[3px] border-black flex flex-col justify-between items-center text-center">
                    <div className="h-20 w-full border-b-2 border-dashed border-slate-300"></div>
                    <p className="text-[9px] font-black uppercase tracking-widest">FIRMA CHOFER</p>
                  </div>
                  <div className="col-span-4 p-6 flex flex-col justify-between items-center text-center">
                    <div className="h-20 w-full border-b-2 border-dashed border-slate-300"></div>
                    <p className="text-[9px] font-black uppercase tracking-widest">RECEPCIÓN EN DESTINO</p>
                  </div>
              </div>
              <div className="mt-10 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-slate-900 uppercase italic">Documentación Digital Nativa A4</p>
                    <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">LogísticaAr Control Hub - Trazabilidad Total</p>
                  </div>
                  <div className="p-2 border-[3px] border-black bg-white shadow-md">
                      <QRCodeSVG value={confirmationUrl} size={85} />
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0mm; }
          body { background: white !important; margin: 0; padding: 0; width: 210mm; height: 297mm; }
          .print\:hidden { display: none !important; }
          header, nav, aside, footer, button { display: none !important; }
          .min-h-screen { min-h-0 !important; height: auto !important; padding: 0 !important; }
          .w-\[210mm\] { width: 210mm !important; height: 297mm !important; max-width: none !important; margin: 0 !important; border: none !important; box-shadow: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

export default function LoadOrderDocumentPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center gap-2 font-bold animate-pulse text-slate-500"><Loader2 className="animate-spin" /> GENERANDO HOJA DE RUTA A4...</div>}>
      <LoadOrderContent />
    </Suspense>
  );
}
