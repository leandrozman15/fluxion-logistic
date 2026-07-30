
'use client';

import { useMemo, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Loader2, Navigation, ClipboardCheck, ShieldCheck, Anchor, Download
} from "lucide-react";
import { Load, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function LoadOrderDocumentPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<TruckType | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  const downloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Orden_Carga_${load?.orderNumber || 'Flete'}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loadLoading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2 text-slate-500 font-bold animate-pulse"><Loader2 className="animate-spin" /> GENERANDO DOCUMENTACIÓN OFICIAL...</div>;
  if (!load) return <div className="p-20 text-center">Orden no encontrada.</div>;

  const confirmationUrl = typeof window !== 'undefined' ? `${window.location.origin}/rutas/${load.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";

  return (
    <div className="min-h-screen bg-slate-200 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <Button onClick={downloadPdf} disabled={isGeneratingPdf} className="bg-blue-600">
            {isGeneratingPdf ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2 h-4 w-4" />} Descargar Orden Nativa
          </Button>
        </div>

        {/* DOCUMENTO ESTILO NATIVO (OFICIAL) */}
        <div className="bg-white shadow-2xl p-10 min-h-[297mm] flex flex-col font-sans text-black border-4 border-double border-black" ref={reportRef}>
          {/* CABECERA OFICIAL */}
          <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-8">
            <div className="space-y-1">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none text-blue-700">{orgName}</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gestión de Cargas Nacionales e Internacionales</p>
              <div className="pt-2 text-[9px] font-bold space-y-0.5">
                 <p>CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</p>
                 <p>DOMICILIO: Sede Central Operativa AR</p>
              </div>
            </div>
            <div className="text-right border-l-2 border-black pl-8">
              <div className="bg-black text-white px-6 py-2 mb-4">
                 <h2 className="text-xl font-black uppercase tracking-widest italic">Orden de Carga</h2>
              </div>
              <p className="text-4xl font-mono font-black tracking-tighter leading-none">{load.orderNumber}</p>
              <p className="text-[10px] font-black uppercase mt-2">Emisión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-0 border-2 border-black">
             <div className="col-span-6 p-6 border-r-2 border-b-2 border-black space-y-4 bg-slate-50/30">
                <h3 className="text-[10px] font-black uppercase flex items-center gap-2 border-b border-black pb-1"><ClipboardCheck size={14}/> 1. Datos del Cliente / Operación</h3>
                <div className="space-y-1">
                   <p className="text-xs font-bold text-slate-500 uppercase">Razón Social:</p>
                   <p className="text-base font-black uppercase">{load.clientName}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-xs font-bold text-slate-500 uppercase">Tipo de Servicio:</p>
                   <p className="text-sm font-black uppercase italic">{load.serviceType} {load.isRoundTrip ? '(IDA Y VUELTA)' : '(SOLO IDA)'}</p>
                </div>
             </div>

             <div className="col-span-6 p-6 border-b-2 border-black space-y-4">
                <h3 className="text-[10px] font-black uppercase flex items-center gap-2 border-b border-black pb-1"><ShieldCheck size={14}/> 2. Equipo y Conductor</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Conductor:</p>
                      <p className="text-sm font-black uppercase">{driver ? `${driver.lastName}, ${driver.firstName}` : 'S/D'}</p>
                      <p className="text-[10px] font-bold">DNI: {driver?.dni || '---'}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Unidad (Tractor):</p>
                      <p className="text-sm font-black uppercase text-blue-700">PAT: {truck?.plate || 'S/D'}</p>
                      <p className="text-[10px] font-bold">{truck?.brand} {truck?.model}</p>
                   </div>
                </div>
             </div>

             <div className="col-span-12 p-6 space-y-6">
                <h3 className="text-[10px] font-black uppercase flex items-center gap-2 border-b border-black pb-1"><Navigation size={14}/> 3. Itinerario Logístico de Entrega</h3>
                <div className="space-y-6">
                   <div className="flex gap-6 items-start">
                      <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-black text-lg bg-black text-white shrink-0">O</div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase text-slate-400">Punto de Carga (Origen)</p>
                         <p className="text-sm font-black uppercase">{load.origin.name}</p>
                         <p className="text-[11px] font-bold italic text-slate-600">{load.origin.address}</p>
                      </div>
                   </div>
                   {load.outboundStops?.map((stop, i) => (
                      <div key={stop.id} className="flex gap-6 items-start border-t border-dotted border-slate-300 pt-4">
                         <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-black text-lg shrink-0">{i+1}</div>
                         <div className="flex-1">
                            <p className="text-sm font-black uppercase">{stop.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{stop.address}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-slate-400">Peso Bruto</p>
                            <p className="text-base font-black italic">{stop.weightKg.toLocaleString()} KG</p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>

          <div className="mt-auto pt-10 grid grid-cols-12 gap-8 border-t-4 border-black">
             <div className="col-span-8">
                <div className="grid grid-cols-3 gap-10">
                   <div className="space-y-4 text-center">
                      <div className="h-24 border-b-2 border-black"></div>
                      <p className="text-[9px] font-black uppercase">Emisión Central</p>
                   </div>
                   <div className="space-y-4 text-center">
                      <div className="h-24 border-b-2 border-black"></div>
                      <p className="text-[9px] font-black uppercase">Transportista</p>
                   </div>
                   <div className="space-y-4 text-center">
                      <div className="h-24 border-b-2 border-black"></div>
                      <p className="text-[9px] font-black uppercase">Receptor</p>
                   </div>
                </div>
             </div>
             <div className="col-span-4 flex flex-col items-center justify-center space-y-2 border-l-2 border-black pl-8">
                <div className="p-3 border-2 border-black bg-white">
                   <QRCodeSVG value={confirmationUrl} size={110} level="H" />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
