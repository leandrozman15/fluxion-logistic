'use client';

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  ArrowLeft, 
  Loader2, 
  Package, 
  Scale, 
  Layers, 
  Ship, 
  ThermometerSnowflake, 
  AlertTriangle, 
  CheckCircle2, 
  LayoutGrid, 
  FileText,
  Building2,
  Globe,
  Info as InfoIcon,
  Box,
  Download
} from "lucide-react";
import { Product, Tenant } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ProductTechnicalSheetPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const productRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "products", id as string);
  }, [db, id]);

  const { data: product, loading } = useDoc<Product>(productRef);

  const tenantRef = useMemo(() => {
    if (!db) return null;
    return doc(db, "tenants", "default_tenant");
  }, [db]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

  if (!mounted || loading) return <div className="h-screen flex items-center justify-center gap-2 font-bold animate-pulse text-slate-500"><Loader2 className="animate-spin" /> GENERANDO FICHA TÉCNICA A4...</div>;
  if (!product) return <div className="p-20 text-center text-slate-400">Producto no encontrado en el catálogo.</div>;

  const validationUrl = typeof window !== 'undefined' ? `${window.location.origin}/productos/${product.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";

  return (
    <div className="min-h-screen bg-slate-800 py-8 print:bg-white print:py-0 overflow-y-auto">
      <div className="max-w-[210mm] mx-auto space-y-6 print:space-y-0">
        {/* TOOLBAR WEB - OCULTO EN IMPRESIÓN */}
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="outline" onClick={() => router.back()} className="text-white border-white/20 hover:bg-white/10 rounded-xl bg-slate-900/50">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo
          </Button>
          <div className="flex gap-2">
             <Badge className="bg-blue-600 text-white border-none">VISTA PREVIA A4 REAL</Badge>
             <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-blue-50 rounded-xl font-black shadow-2xl px-8 h-11">
               <Download className="mr-2 h-5 w-5" /> GUARDAR PDF A4
             </Button>
          </div>
        </div>

        {/* DOCUMENTO PROFESIONAL - FORMATO A4 ESTRICTO (210x297mm) */}
        <div className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] print:shadow-none w-[210mm] min-h-[297mm] flex flex-col font-sans text-slate-900 border-[12px] border-double border-slate-900 print:border-none mx-auto overflow-hidden relative box-border">
          
          <div className="p-12 print:p-10 flex flex-col h-full w-full box-border flex-1">
            {/* CABECERA CORPORATIVA */}
            <div className="flex justify-between items-start border-b-[5px] border-slate-900 pb-8 mb-8">
              <div className="flex items-center gap-6">
                {tenant?.settings?.logoUrl ? (
                  <img src={tenant.settings.logoUrl} className="h-20 w-auto object-contain" alt="Logo" />
                ) : (
                  <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Building2 size={32} />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none text-blue-800">{orgName}</h1>
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 mt-2">Sistema Central de Gestión de Cargas</p>
                  <div className="pt-3 text-[10px] font-bold space-y-0.5 text-slate-400">
                      <p>CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</p>
                      <p className="flex items-center gap-1"><Globe size={10}/> Sede Central Operativa - República Argentina</p>
                  </div>
                </div>
              </div>
              <div className="text-right border-l-[3px] border-slate-900 pl-8">
                <div className="bg-slate-900 text-white px-6 py-2 mb-3">
                  <h2 className="text-lg font-black uppercase tracking-[0.2em] italic text-center">Ficha Técnica</h2>
                </div>
                <p className="text-4xl font-mono font-black tracking-tighter leading-none">{product.sku}</p>
                <p className="text-[10px] font-black uppercase mt-2 text-slate-500">VERSIÓN: {format(new Date(), "MM/yyyy")}</p>
              </div>
            </div>

            {/* SECCIÓN 1: IDENTIFICACIÓN PRINCIPAL */}
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-8 space-y-6">
                 <div className="space-y-1">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-black uppercase px-2 py-0.5 mb-2">{product.category}</Badge>
                    <h2 className="text-6xl font-black uppercase tracking-tighter text-slate-900 leading-[0.85]">{product.name}</h2>
                    <p className="text-2xl font-bold text-slate-400 uppercase italic mt-4">{product.brand || 'Marca no especificada'}</p>
                 </div>
                 
                 {/* DESCRIPCIÓN DEL PRODUCTO */}
                 <div className="pt-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-900 mb-3 flex items-center gap-2 border-b-2 border-slate-100 pb-1">
                      <InfoIcon size={14} /> Descripción del Artículo
                    </h3>
                    <div className="p-6 bg-slate-50 border-l-[6px] border-blue-600 rounded-r-2xl shadow-sm">
                       <p className="text-[13px] leading-relaxed font-medium text-slate-600 italic">
                          {product.description || 'No hay una descripción técnica cargada para este artículo. Consulte con el departamento comercial para más detalles.'}
                       </p>
                    </div>
                 </div>
              </div>

              {/* IMAGEN Y QR */}
              <div className="col-span-4 flex flex-col gap-6">
                 <div className="aspect-square bg-white border-[3px] border-slate-900 rounded-3xl shadow-xl p-2 flex items-center justify-center overflow-hidden">
                    {product.photoUrl ? (
                      <img src={product.photoUrl} className="w-full h-full object-cover rounded-2xl" alt={product.name} />
                    ) : (
                      <Package size={100} className="text-slate-100" />
                    )}
                 </div>
                 <div className="p-6 bg-slate-900 text-white rounded-[2rem] flex flex-col items-center gap-4 shadow-2xl">
                    <div className="p-3 bg-white rounded-2xl shadow-inner">
                       <QRCodeSVG value={validationUrl} size={110} />
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">AUDITORÍA QR</p>
                      <p className="text-[7px] font-bold uppercase opacity-30">Trazabilidad Operativa</p>
                    </div>
                 </div>
              </div>
            </div>

            {/* SECCIÓN 2: ESPECIFICACIONES TÉCNICAS (GRIDS) */}
            <div className="mt-12 space-y-6">
              <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-[3px] border-slate-100 pb-2">Parámetros de Distribución</h3>
              <div className="grid grid-cols-5 gap-0 border-[3px] border-slate-900 rounded-xl overflow-hidden shadow-lg">
                 <div className="bg-slate-50 p-5 border-r-[3px] border-slate-900 flex flex-col items-center text-center gap-2">
                    <Scale size={20} className="text-blue-700" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Peso Bruto</p>
                    <p className="text-2xl font-black italic">{product.unitWeightKg} <span className="text-xs font-normal opacity-50">KG</span></p>
                 </div>
                 <div className="bg-white p-5 border-r-[3px] border-slate-900 flex flex-col items-center text-center gap-2">
                    <Box size={20} className="text-blue-700" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Volumen</p>
                    <p className="text-2xl font-black italic">{product.unitVolumeM3} <span className="text-xs font-normal opacity-50">M³</span></p>
                 </div>
                 <div className="bg-slate-50 p-5 border-r-[3px] border-slate-900 flex flex-col items-center text-center gap-2">
                    <LayoutGrid size={20} className="text-blue-700" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Un. por Caja</p>
                    <p className="text-2xl font-black italic">{product.unitsPerBox || '--'}</p>
                 </div>
                 <div className="bg-white p-5 border-r-[3px] border-slate-900 flex flex-col items-center text-center gap-2">
                    <Layers size={20} className="text-blue-700" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Un. por Pallet</p>
                    <p className="text-2xl font-black italic">{product.unitsPerPallet || '--'}</p>
                 </div>
                 <div className="bg-slate-900 p-5 text-white flex flex-col items-center text-center gap-2">
                    <Package size={20} className="text-blue-400" />
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-tighter">Embalaje</p>
                    <p className="text-lg font-black uppercase italic leading-none mt-1">{product.packagingType}</p>
                 </div>
              </div>
            </div>

            {/* SECCIÓN 3: CUMPLIMIENTO Y SEGURIDAD */}
            <div className="grid grid-cols-2 gap-10 mt-12">
              <div className="space-y-4">
                 <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-[3px] border-slate-100 pb-2">Identificación Mercosur</h3>
                 <div className="p-8 border-[3px] border-slate-900 rounded-[2rem] space-y-5 bg-slate-50/30">
                    <div className="flex justify-between items-center">
                       <span className="text-[11px] font-black uppercase text-slate-400">Posición NCM</span>
                       <span className="text-lg font-mono font-black text-blue-800 tracking-wider">{product.ncmCode || 'NO DEFINIDA'}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-5">
                       <span className="text-[11px] font-black uppercase text-slate-400">Origen Mercadería</span>
                       <Badge className="bg-slate-900 text-white border-none uppercase text-[10px] font-black px-4 py-1 italic tracking-widest">{product.origin}</Badge>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-[3px] border-slate-100 pb-2">Seguridad y Riesgos</h3>
                 <div className="p-8 border-[3px] border-slate-900 rounded-[2rem] space-y-6">
                    {product.requiresReefer ? (
                      <div className="flex items-center gap-5">
                         <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 shadow-sm">
                            <ThermometerSnowflake size={32} />
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-blue-500 uppercase">Ambiente Controlado</p>
                            <p className="text-lg font-black italic uppercase tracking-tighter">RANGO: {product.tempRange?.min}°C A {product.tempRange?.max}°C</p>
                         </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-5 opacity-25 grayscale">
                         <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <ThermometerSnowflake size={32} />
                         </div>
                         <p className="text-[11px] font-black uppercase tracking-widest">No requiere cadena de frío</p>
                      </div>
                    )}

                    <div className="flex items-center gap-5 border-t border-slate-100 pt-6">
                       <div className={cn(
                         "w-14 h-14 rounded-2xl flex items-center justify-center text-white",
                         product.dangerLevel !== 'none' ? "bg-red-600 shadow-xl shadow-red-200" : "bg-green-600"
                       )}>
                          {product.dangerLevel !== 'none' ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Clasificación de Riesgo</p>
                          <p className="text-lg font-black uppercase italic tracking-tighter">
                             {product.dangerLevel !== 'none' ? `CLASE PELIGRO: ${product.dangerLevel.toUpperCase()}` : 'CARGA GENERAL SEGURA'}
                          </p>
                          {product.onuNumber && <p className="text-[10px] font-mono font-black text-red-600 uppercase">IDENTIFICACIÓN ONU: {product.onuNumber}</p>}
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* SECCIÓN FINAL DE FIRMAS Y VALIDEZ */}
            <div className="mt-auto pt-16">
              <div className="border-t-[6px] border-slate-900 pt-10 flex justify-between items-end">
                <div className="space-y-2">
                   <p className="text-[12px] font-black uppercase italic text-slate-900 tracking-tighter">Validado por Auditoría Central LogísticaAr</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                     Generado el {format(new Date(), "dd/MM/yyyy HH:mm")} | Ref ID: {product.id.substring(0,12).toUpperCase()}
                   </p>
                   <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mt-2">Documento Técnico Legal - Formato A4 Vectorial</p>
                </div>
                <div className="text-right">
                   <div className="inline-block border-[5px] border-slate-900 p-6 bg-slate-50 rotate-[-3deg] shadow-2xl">
                      <p className="text-[12px] font-black uppercase tracking-[0.3em] text-center leading-none">APROBADO OK</p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase mt-2 text-center">Ficha Técnica Certificada</p>
                   </div>
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
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
          }
          .print\:hidden {
            display: none !important;
          }
          header, nav, aside, footer, .sidebar-trigger, button, .badge {
            display: none !important;
          }
          /* Re-habilitar badges específicos para impresión si es necesario, o estilizarlos como texto */
          .print\:badge {
             display: inline-block !important;
             border: 1px solid black !important;
          }
          .min-h-screen {
            min-h-0 !important;
            height: auto !important;
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
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
