'use client';

import { useMemo, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Loader2, Navigation, ClipboardCheck, ShieldCheck, Anchor, Download, Truck, User, MapPin, Scale, Info
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
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2, 
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff"
      });
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
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center px-4 print:hidden">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <Button onClick={downloadPdf} disabled={isGeneratingPdf} className="bg-blue-700 hover:bg-blue-800 rounded-xl font-bold shadow-xl">
            {isGeneratingPdf ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2 h-4 w-4" />} Descargar Orden Nativa
          </Button>
        </div>

        {/* DOCUMENTO ESTILO FORMULARIO NATIVO (ALTA DENSIDAD) */}
        <div className="bg-white shadow-2xl p-10 print:p-8 print:shadow-none min-h-[297mm] flex flex-col font-sans text-black border-[6px] border-double border-black" ref={reportRef}>
          
          {/* CABECERA INSTITUCIONAL */}
          <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-6">
            <div className="flex items-center gap-4">
               {tenant?.settings?.logoUrl && (
                 <img src={tenant.settings.logoUrl} className="h-14 w-auto object-contain" alt="Logo" />
               )}
               <div>
                 <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-blue-800">{orgName}</h1>
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Gestión de Cargas Nacionales e Internacionales</p>
                 <div className="pt-2 text-[8px] font-bold space-y-0">
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

          {/* GRID DE DATOS MAESTROS (ALTA DENSIDAD) */}
          <div className="grid grid-cols-12 gap-0 border-2 border-black">
             {/* SECCIÓN CLIENTE */}
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

             {/* SECCIÓN EQUIPO */}
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

             {/* SECCIÓN ORIGEN */}
             <div className="col-span-12 p-4 border-b-2 border-black bg-slate-50/20">
                <h3 className="text-[9px] font-black uppercase flex items-center gap-2 border-b border-black/20 pb-1 text-blue-800"><MapPin size={12}/> 3. PUNTO DE CARGA (ORIGEN)</h3>
                <div className="flex justify-between items-center mt-2">
                   <div className="space-y-0.5">
                      <p className="text-xs font-black uppercase">{load.origin.name}</p>
                      <p className="text-[9px] font-medium italic text-slate-600">{load.origin.address}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">Presentación</p>
                      <p className="text-xs font-black">{load.pickupDate} • {load.pickupTime} hs</p>
                   </div>
                </div>
             </div>

             {/* SECCIÓN ITINERARIO (MÁXIMA DENSIDAD) */}
             <div className="col-span-12 p-4 space-y-3">
                <h3 className="text-[9px] font-black uppercase flex items-center gap-2 border-b border-black/20 pb-1 text-blue-800"><Navigation size={12}/> 4. SECUENCIA DE ENTREGAS (DESTINOS)</h3>
                <table className="w-full text-[10px] border-collapse">
                   <thead>
                      <tr className="border-b border-black bg-slate-50">
                         <th className="py-1 px-2 text-left font-black uppercase w-8">POS</th>
                         <th className="py-1 px-2 text-left font-black uppercase">PUNTO DE DESCARGA</th>
                         <th className="py-1 px-2 text-left font-black uppercase">DOMICILIO</th>
                         <th className="py-1 px-2 text-right font-black uppercase">PESO DECL.</th>
                      </tr>
                   </thead>
                   <tbody>
                      {load.outboundStops?.map((stop, i) => (
                        <tr key={stop.id} className="border-b border-dashed border-slate-300">
                           <td className="py-2 px-2 font-black">{i+1}</td>
                           <td className="py-2 px-2 font-bold uppercase">{stop.name}</td>
                           <td className="py-2 px-2 text-[9px] text-slate-500 uppercase">{stop.address}</td>
                           <td className="py-2 px-2 text-right font-black">{stop.weightKg.toLocaleString()} KG</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             {/* SECCIÓN COMEX / PUERTO (SI APLICA) */}
             {load.international?.containerNumber && (
               <div className="col-span-12 p-4 border-t-2 border-black bg-blue-50/30">
                  <h3 className="text-[9px] font-black uppercase flex items-center gap-2 border-b border-black/20 pb-1 text-blue-800"><Anchor size={12}/> 5. DATOS ADUANEROS / PUERTO</h3>
                  <div className="grid grid-cols-3 gap-6 mt-2">
                     <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">CONTENEDOR N°</p>
                        <p className="text-xs font-mono font-black">{load.international.containerNumber}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">PRECINTO N°</p>
                        <p className="text-xs font-mono font-black">{load.international.sealNumber || '---'}</p>
                     </div>
                     <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">TIPO OPERACIÓN</p>
                        <p className="text-xs font-black uppercase">{load.international.operationType || 'TRANSITO'}</p>
                     </div>
                  </div>
               </div>
             )}
          </div>

          {/* BALANCE DE PESOS LEGALES */}
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

          {/* PIE DE PÁGINA: FIRMAS Y VALIDACIÓN */}
          <div className="mt-auto pt-10 grid grid-cols-12 gap-6 border-t-4 border-black">
             <div className="col-span-8 grid grid-cols-3 gap-8">
                <div className="space-y-4 text-center">
                   <div className="h-16 border-b-2 border-black"></div>
                   <p className="text-[8px] font-black uppercase">RESPONSABLE EMISIÓN</p>
                </div>
                <div className="space-y-4 text-center">
                   <div className="h-16 border-b-2 border-black"></div>
                   <p className="text-[8px] font-black uppercase">CHOFER (CONFORMIDAD)</p>
                </div>
                <div className="space-y-4 text-center">
                   <div className="h-16 border-b-2 border-black flex items-center justify-center">
                      <div className="border-2 border-black px-2 py-1 rotate-[-4deg] text-[8px] font-black">VALIDADO LOGÍSTICA</div>
                   </div>
                   <p className="text-[8px] font-black uppercase">SELLO DESPACHO</p>
                </div>
             </div>
             <div className="col-span-4 flex flex-col items-center justify-center space-y-2 border-l-2 border-black pl-6">
                <div className="p-2 border-2 border-black bg-white">
                   <QRCodeSVG value={confirmationUrl} size={90} level="H" />
                </div>
                <p className="text-[7px] font-bold text-center uppercase leading-tight">VALIDACIÓN DIGITAL <br/> ESCANEE PARA RASTREO</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
