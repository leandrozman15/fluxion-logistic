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
  QrCode, ShieldCheck, Box, CheckCircle2
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
    <div className="min-h-screen bg-slate-200 py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-0">
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
          <Button onClick={() => window.print()} className="bg-blue-600"><Printer className="mr-2 h-4 w-4" /> Imprimir Ficha Nativa</Button>
        </div>

        {/* DOCUMENTO NATIVO: FICHA TÉCNICA INDUSTRIAL */}
        <div className="bg-white shadow-2xl p-12 print:shadow-none min-h-[297mm] flex flex-col font-sans text-black border-8 border-double border-slate-900">
          
          {/* CABECERA DE FICHA */}
          <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-10">
            <div className="space-y-2">
              <h1 className="text-4xl font-black uppercase italic tracking-tighter text-blue-700">{orgName}</h1>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Catálogo Técnico de Artículos</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black uppercase bg-black text-white px-4 py-1 italic mb-2">Technical Data Sheet</h2>
              <p className="text-2xl font-mono font-black text-slate-800">{product.sku}</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-10">
             {/* COLUMNA VISUAL */}
             <div className="col-span-4 space-y-8">
                <div className="aspect-square border-4 border-black p-1 bg-white">
                   <div className="w-full h-full border border-black flex items-center justify-center overflow-hidden">
                      {product.photoUrl ? (
                        <img src={product.photoUrl} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={100} className="text-slate-200" />
                      )}
                   </div>
                </div>

                <div className="p-4 border-2 border-black space-y-4">
                   <p className="text-[10px] font-black uppercase text-center border-b border-black pb-2">Validación de Registro</p>
                   <div className="flex justify-center bg-white">
                      <QRCodeSVG value={validationUrl} size={140} />
                   </div>
                   <p className="text-[7px] font-bold text-center leading-tight uppercase">Documento generado dinámicamente. <br/>Verifique vigencia mediante código QR.</p>
                </div>
             </div>

             {/* COLUMNA DE ESPECIFICACIONES (TABLA NATIVA) */}
             <div className="col-span-8 space-y-8">
                <div className="border-b-4 border-black pb-4">
                   <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{product.name}</h2>
                   <p className="text-lg font-bold uppercase text-slate-500 mt-2">{product.brand} | {product.category}</p>
                </div>

                <div className="space-y-6">
                   <h3 className="text-xs font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 inline-block">1. Especificaciones Logísticas</h3>
                   <div className="grid grid-cols-2 gap-0 border-2 border-black">
                      <div className="p-4 border-r-2 border-b-2 border-black">
                         <p className="text-[9px] font-black uppercase text-slate-400">Peso Bruto Unitario</p>
                         <p className="text-2xl font-black italic">{product.unitWeightKg} KG</p>
                      </div>
                      <div className="p-4 border-b-2 border-black">
                         <p className="text-[9px] font-black uppercase text-slate-400">Volumen Unitario</p>
                         <p className="text-2xl font-black italic">{product.unitVolumeM3} M³</p>
                      </div>
                      <div className="p-4 border-r-2 border-black">
                         <p className="text-[9px] font-black uppercase text-slate-400">Unidades por Pallet</p>
                         <p className="text-xl font-black">{product.unitsPerPallet} Un.</p>
                      </div>
                      <div className="p-4">
                         <p className="text-[9px] font-black uppercase text-slate-400">Tipo de Embalaje</p>
                         <p className="text-xl font-black uppercase italic">{product.packagingType}</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-800 px-3 py-1.5 inline-block">2. Identificación Aduanera / Fiscal</h3>
                   <table className="w-full border-2 border-black text-left text-[11px] font-bold">
                      <tbody className="divide-y divide-black">
                         <tr>
                            <td className="p-3 bg-slate-50 w-1/3 uppercase">Posición NCM:</td>
                            <td className="p-3 font-mono text-sm">{product.ncmCode || 'SIN DECLARAR'}</td>
                         </tr>
                         <tr>
                            <td className="p-3 bg-slate-50 uppercase">Código GTIN:</td>
                            <td className="p-3 font-mono">{product.gtin || '---'}</td>
                         </tr>
                         <tr>
                            <td className="p-3 bg-slate-50 uppercase">Origen Mercadería:</td>
                            <td className="p-3 uppercase">{product.origin}</td>
                         </tr>
                         <tr>
                            <td className="p-3 bg-slate-50 uppercase">Certificación SENASA/ANMAT:</td>
                            <td className="p-3 uppercase">{product.senasaHabilitation || product.anmatHabilitation || 'N/A'}</td>
                         </tr>
                      </tbody>
                   </table>
                </div>

                <div className="space-y-4">
                   <h3 className="text-xs font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 inline-block">3. Requisitos de Transporte</h3>
                   <div className="p-6 border-2 border-black bg-slate-50 space-y-4">
                      {product.requiresReefer && (
                        <div className="flex items-center gap-6">
                           <ThermometerSnowflake size={40} />
                           <div>
                              <p className="text-[10px] font-black uppercase">REQUISITO DE FRÍO:</p>
                              <p className="text-2xl font-black italic">RANGO {product.tempRange?.min}°C A {product.tempRange?.max}°C</p>
                           </div>
                        </div>
                      )}
                      <div className="flex items-center gap-6">
                         {product.dangerLevel !== 'none' ? <AlertTriangle size={40} className="text-red-600" /> : <CheckCircle2 size={40} className="text-green-600" />}
                         <div>
                            <p className="text-[10px] font-black uppercase">SEGURIDAD QUÍMICA:</p>
                            <p className="text-xl font-black italic uppercase">
                               {product.dangerLevel !== 'none' ? `CLASE PELIGRO: ${product.dangerLevel} / ONU ${product.onuNumber}` : 'CARGA GENERAL - SIN RESTRICCIONES'}
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="mt-auto pt-10 border-t-4 border-black flex justify-between items-end">
             <div className="text-[9px] font-black uppercase italic space-y-1">
                <p>LogísticaAr - Gestión de Activos Inteligentes</p>
                <p>Fecha de Actualización Ficha: {format(new Date(), "dd/MM/yyyy")}</p>
             </div>
             <div className="text-right">
                <div className="inline-block border-2 border-black p-4 text-center">
                   <p className="text-[10px] font-black uppercase">APROBADO CALIDAD</p>
                   <div className="h-10"></div>
                   <p className="text-[8px] font-bold">LOGÍSTICA CENTRAL AR</p>
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
