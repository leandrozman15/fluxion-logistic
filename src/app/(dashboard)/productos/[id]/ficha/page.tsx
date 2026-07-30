'use client';

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, ArrowLeft, Loader2, Package, Scale, 
  Layers, Ship, ThermometerSnowflake, AlertTriangle, 
  QrCode, ShieldCheck, Box, CheckCircle2, Info, LayoutGrid, FileText
} from "lucide-react";
import { Product, Tenant } from "@/app/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ProductTechnicalSheetPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();

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

  if (loading) return <div className="h-screen flex items-center justify-center gap-2 font-bold animate-pulse text-slate-500"><Loader2 className="animate-spin" /> GENERANDO FICHA TÉCNICA...</div>;
  if (!product) return <div className="p-20 text-center">Producto no encontrado.</div>;

  const validationUrl = typeof window !== 'undefined' ? `${window.location.origin}/productos/${product.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto space-y-6 print:space-y-0">
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border rounded-xl"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <Button onClick={() => window.print()} className="bg-slate-900 text-white hover:bg-black rounded-xl font-bold shadow-xl">
             <Printer className="mr-2 h-4 w-4" /> Imprimir Ficha Nativa
          </Button>
        </div>

        {/* DOCUMENTO NATIVO: FICHA TÉCNICA INDUSTRIAL (ALTA DENSIDAD) */}
        <div className="bg-white shadow-2xl p-10 print:p-8 print:shadow-none min-h-[297mm] flex flex-col font-sans text-black border-[10px] border-double border-slate-900">
          
          {/* CABECERA DE FICHA COMPRIMIDA */}
          <div className="flex justify-between items-start border-b-[4px] border-black pb-6 mb-8">
            <div className="flex items-center gap-6">
               {tenant?.settings?.logoUrl && (
                 <img src={tenant.settings.logoUrl} className="h-16 w-auto object-contain" alt="Logo" />
               )}
               <div>
                 <h1 className="text-4xl font-black uppercase italic tracking-tighter text-blue-800 leading-none">{orgName}</h1>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Catálogo Técnico Integral de Artículos</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 italic">Normativa de Seguridad y Transporte AR v2.0</p>
               </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-900 text-white px-5 py-1.5 mb-2">
                 <h2 className="text-base font-black uppercase tracking-widest italic">Technical Data Sheet</h2>
              </div>
              <p className="text-3xl font-mono font-black text-slate-900 tracking-tighter">SKU: {product.sku}</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8">
             {/* COLUMNA VISUAL Y VALIDACIÓN */}
             <div className="col-span-4 space-y-6">
                <div className="aspect-square border-[3px] border-black p-1 bg-white shadow-lg">
                   <div className="w-full h-full border border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                      {product.photoUrl ? (
                        <img src={product.photoUrl} className="w-full h-full object-cover" alt={product.name} />
                      ) : (
                        <Package size={120} className="text-slate-200" />
                      )}
                   </div>
                </div>

                <div className="p-5 border-2 border-black bg-slate-50/50 space-y-4 rounded-sm">
                   <h4 className="text-[10px] font-black uppercase text-center border-b border-black/20 pb-2 tracking-widest">Validación de Registro</h4>
                   <div className="flex justify-center bg-white p-2 border border-slate-100 shadow-inner">
                      <QRCodeSVG value={validationUrl} size={130} />
                   </div>
                   <p className="text-[7px] font-black text-center leading-tight uppercase text-slate-500">Ficha generada dinámicamente. <br/>Verifique vigencia operacional mediante QR.</p>
                </div>

                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado Catálogo</p>
                   <Badge className="w-full justify-center bg-green-600 border-none font-black text-[10px] h-8 uppercase tracking-widest">ACTIVO / VIGENTE</Badge>
                </div>
             </div>

             {/* COLUMNA DE ESPECIFICACIONES (TABLA NATIVA ALTA DENSIDAD) */}
             <div className="col-span-8 space-y-6">
                <div className="border-b-[3px] border-black pb-3">
                   <h2 className="text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">{product.name}</h2>
                   <p className="text-lg font-black uppercase text-blue-700 mt-2 tracking-tight">{product.brand} | CATEGORÍA: {product.category}</p>
                </div>

                {/* 1. LOGÍSTICA DE ARRASTRE Y CARGA */}
                <div className="space-y-3">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-4 py-1.5 inline-block">1. ESPECIFICACIONES LOGÍSTICAS</h3>
                   <div className="grid grid-cols-2 gap-0 border-2 border-black">
                      <div className="p-4 border-r-2 border-b-2 border-black hover:bg-slate-50 transition-colors">
                         <p className="text-[9px] font-black uppercase text-slate-400">Peso Bruto Unitario</p>
                         <p className="text-3xl font-black italic tracking-tighter">{product.unitWeightKg} KG</p>
                      </div>
                      <div className="p-4 border-b-2 border-black hover:bg-slate-50 transition-colors">
                         <p className="text-[9px] font-black uppercase text-slate-400">Volumen Unitario</p>
                         <p className="text-3xl font-black italic tracking-tighter">{product.unitVolumeM3} M³</p>
                      </div>
                      <div className="p-4 border-r-2 border-black hover:bg-slate-50 transition-colors">
                         <p className="text-[9px] font-black uppercase text-slate-400">Unidades por Pallet</p>
                         <p className="text-2xl font-black tracking-tighter">{product.unitsPerPallet} Un.</p>
                      </div>
                      <div className="p-4 hover:bg-slate-50 transition-colors">
                         <p className="text-[9px] font-black uppercase text-slate-400">Tipo de Embalaje</p>
                         <p className="text-2xl font-black uppercase italic tracking-tighter">{product.packagingType}</p>
                      </div>
                   </div>
                </div>

                {/* 2. IDENTIFICACIÓN AR */}
                <div className="space-y-3">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.2em] bg-slate-200 text-slate-800 px-4 py-1.5 inline-block">2. IDENTIFICACIÓN ADUANERA / FISCAL</h3>
                   <table className="w-full border-2 border-black text-left text-[11px] font-bold border-collapse">
                      <tbody className="divide-y divide-black">
                         <tr>
                            <td className="p-3 bg-slate-50 w-1/3 uppercase border-r-2 border-black">Posición NCM:</td>
                            <td className="p-3 font-mono text-sm tracking-widest">{product.ncmCode || 'SIN DECLARAR'}</td>
                         </tr>
                         <tr>
                            <td className="p-3 bg-slate-50 uppercase border-r-2 border-black">Código GTIN/EAN:</td>
                            <td className="p-3 font-mono text-slate-600">{product.gtin || '---'}</td>
                         </tr>
                         <tr>
                            <td className="p-3 bg-slate-50 uppercase border-r-2 border-black">País de Origen:</td>
                            <td className="p-3 uppercase text-blue-800">{product.origin === 'nacional' ? 'REPUBLICA ARGENTINA' : 'MERCADERÍA IMPORTADA'}</td>
                         </tr>
                         <tr>
                            <td className="p-3 bg-slate-50 uppercase border-r-2 border-black">Certif. SENASA / ANMAT:</td>
                            <td className="p-3 uppercase font-mono">{product.senasaHabilitation || product.anmatHabilitation || 'N/A'}</td>
                         </tr>
                      </tbody>
                   </table>
                </div>

                {/* 3. SEGURIDAD VIAL Y AMBIENTAL */}
                <div className="space-y-3">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.2em] bg-slate-900 text-white px-4 py-1.5 inline-block">3. REQUISITOS DE TRANSPORTE Y SEGURIDAD</h3>
                   <div className="p-6 border-2 border-black bg-slate-50/50 space-y-6">
                      {product.requiresReefer && (
                        <div className="flex items-center gap-6 border-b border-black/10 pb-4">
                           <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 border-2 border-blue-200"><ThermometerSnowflake size={32} /></div>
                           <div>
                              <p className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Protocolo de Cadena de Frío Requerido:</p>
                              <p className="text-3xl font-black italic tracking-tighter">RANGO: {product.tempRange?.min}°C A {product.tempRange?.max}°C</p>
                           </div>
                        </div>
                      )}
                      <div className="flex items-center gap-6">
                         <div className={cn(
                           "w-14 h-14 rounded-full flex items-center justify-center border-2",
                           product.dangerLevel !== 'none' ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"
                         )}>
                           {product.dangerLevel !== 'none' ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Seguridad Química y Protocolo Vial:</p>
                            <p className={cn(
                              "text-3xl font-black italic uppercase tracking-tighter",
                              product.dangerLevel !== 'none' ? "text-red-700" : "text-green-700"
                            )}>
                               {product.dangerLevel !== 'none' ? `CLASE PELIGRO: ${product.dangerLevel} / ONU ${product.onuNumber}` : 'CARGA GENERAL - SIN RESTRICCIONES'}
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* PIE DE PÁGINA INSTITUCIONAL */}
          <div className="mt-auto pt-8 border-t-4 border-black flex justify-between items-end">
             <div className="text-[9px] font-black uppercase italic space-y-1 text-slate-400">
                <p>LogísticaAr Intelligent Fleet Management System</p>
                <p>Fecha de Ultima Auditoría Ficha: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                <p className="text-[7px] font-bold">Ref ID: {product.id.toUpperCase()}</p>
             </div>
             <div className="text-right">
                <div className="inline-block border-[3px] border-black p-4 text-center bg-slate-50 shadow-sm">
                   <p className="text-[11px] font-black uppercase tracking-widest">APROBADO CONTROL CALIDAD</p>
                   <div className="h-8 flex items-center justify-center my-1">
                      <ShieldCheck size={24} className="text-slate-300" />
                   </div>
                   <p className="text-[8px] font-bold text-slate-500 uppercase">AUDITORÍA CENTRAL LOGÍSTICA AR</p>
                </div>
             </div>
          </div>

        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          .print\:hidden { display: none !important; }
          header, nav, aside, footer, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
