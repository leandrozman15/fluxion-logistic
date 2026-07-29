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
  const logoUrl = tenant?.settings?.logoUrl || "/icono.png";

  return (
    <div className="min-h-screen bg-slate-200 py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto space-y-6 print:space-y-0">
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo</Button>
          <Button onClick={() => window.print()} className="bg-blue-600 shadow-md"><Printer className="mr-2 h-4 w-4" /> Imprimir / Guardar PDF</Button>
        </div>

        <div className="bg-white shadow-2xl p-10 print:shadow-none min-h-[297mm] flex flex-col border border-slate-300 print:border-none rounded-sm relative overflow-hidden">
          {/* MARCA DE AGUA CORPORATIVA */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] rotate-[-45deg] pointer-events-none">
             <Package size={600} />
          </div>

          {/* HEADER DEL DOCUMENTO */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-blue-600 font-black text-3xl italic tracking-tighter uppercase">
                <div className="relative w-12 h-12 shrink-0">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span>{orgName}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sistema de Gestión de Cargas AR-1</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-black uppercase bg-slate-900 text-white px-4 py-1 mb-2 inline-block italic">Ficha Técnica de Artículo</h1>
              <div className="space-y-0">
                <p className="text-2xl font-mono text-blue-600 font-black">{product.sku}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Emisión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8 relative z-10">
             {/* COLUMNA IZQUIERDA: IMAGEN Y QR */}
             <div className="col-span-4 space-y-6">
                <div className="aspect-square bg-slate-50 border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                   {product.photoUrl ? (
                     <img src={product.photoUrl} className="w-full h-full object-cover" alt={product.name} />
                   ) : (
                     <Package size={80} className="text-slate-200" />
                   )}
                </div>
                
                <div className="p-4 bg-slate-50 border rounded-2xl space-y-3">
                   <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <QrCode size={14} /> Validación Digital
                   </h3>
                   <div className="flex justify-center bg-white p-3 rounded-xl border border-slate-100">
                      <QRCodeSVG value={validationUrl} size={120} />
                   </div>
                   <p className="text-[8px] text-slate-400 text-center leading-tight">Escanee para validar la vigencia de esta ficha en el sistema central.</p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-2">
                   <h3 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2">
                      <ShieldCheck size={14} /> Auditoría Logística
                   </h3>
                   <p className="text-[9px] text-blue-700 leading-relaxed italic">Este documento certifica las dimensiones y requisitos de manipuleo para la correcta asignación de unidad de transporte.</p>
                </div>
             </div>

             {/* COLUMNA DERECHA: DATOS TÉCNICOS */}
             <div className="col-span-8 space-y-8">
                {/* IDENTIFICACIÓN BÁSICA */}
                <section className="space-y-4">
                   <div className="border-l-4 border-blue-600 pl-4">
                      <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{product.name}</h2>
                      <p className="text-sm font-bold text-slate-400 uppercase mt-1">{product.brand} | {product.category}</p>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Descripción del Producto</h3>
                      <p className="text-xs text-slate-700 leading-relaxed">{product.description || "Sin descripción técnica adicional registrada."}</p>
                   </div>
                </section>

                {/* LOGÍSTICA Y PESOS */}
                <section className="grid grid-cols-2 gap-4">
                   <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-blue-400 flex items-center gap-2"><Scale size={14}/> Masa y Volumen</h3>
                      <div className="space-y-4">
                         <div>
                            <p className="text-[9px] font-bold text-white/40 uppercase">Peso Unitario Neto</p>
                            <p className="text-2xl font-black italic">{product.unitWeightKg} <span className="text-xs font-normal opacity-50">KG</span></p>
                         </div>
                         <div className="border-t border-white/10 pt-3">
                            <p className="text-[9px] font-bold text-white/40 uppercase">Volumen Declarado</p>
                            <p className="text-lg font-black italic">{product.unitVolumeM3} <span className="text-xs font-normal opacity-50">M³</span></p>
                         </div>
                      </div>
                   </div>
                   <div className="p-5 bg-slate-50 border rounded-3xl space-y-3">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Layers size={14}/> Estibaje y Embalaje</h3>
                      <div className="space-y-4">
                         <div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase">Unidades por Pallet</p>
                            <p className="text-2xl font-black italic text-slate-800">{product.unitsPerPallet} <span className="text-xs font-normal text-slate-400 uppercase">u.</span></p>
                         </div>
                         <div className="border-t border-slate-200 pt-3">
                            <p className="text-[9px] font-bold text-slate-500 uppercase">Tipo de Bulto</p>
                            <p className="text-sm font-black text-slate-800 uppercase italic">{product.packagingType}</p>
                         </div>
                      </div>
                   </div>
                </section>

                {/* ADUANA Y CUMPLIMIENTO */}
                <section className="space-y-4">
                   <h3 className="text-xs font-black bg-slate-100 text-slate-600 px-3 py-2 flex items-center gap-2 rounded uppercase tracking-widest">
                      <Ship size={14} /> Cumplimiento Normativo AR/Mercosur
                   </h3>
                   <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-2">
                      <div className="space-y-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase">Posición Arancelaria (NCM)</span>
                         <p className="text-sm font-mono font-bold text-blue-700">{product.ncmCode || "NO DECLARADO"}</p>
                      </div>
                      <div className="space-y-1 text-right">
                         <span className="text-[9px] font-black text-slate-400 uppercase">Código Global (GTIN)</span>
                         <p className="text-sm font-mono font-bold text-slate-800">{product.gtin || "-"}</p>
                      </div>
                      <div className="space-y-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase">Certificado SENASA</span>
                         <p className="text-sm font-bold text-slate-800">{product.senasaHabilitation || "N/A"}</p>
                      </div>
                      <div className="space-y-1 text-right">
                         <span className="text-[9px] font-black text-slate-400 uppercase">Registro ANMAT</span>
                         <p className="text-sm font-bold text-slate-800">{product.anmatHabilitation || "N/A"}</p>
                      </div>
                   </div>
                </section>

                {/* REQUISITOS ESPECIALES */}
                <section className="grid grid-cols-2 gap-4">
                   {product.requiresReefer && (
                     <div className="p-4 bg-blue-600 text-white rounded-2xl flex items-start gap-4">
                        <ThermometerSnowflake size={32} className="shrink-0" />
                        <div>
                           <h4 className="text-[10px] font-black uppercase italic tracking-widest text-blue-200">Cadena de Frío</h4>
                           <p className="text-xl font-black italic">{product.tempRange?.min}°C a {product.tempRange?.max}°C</p>
                           <p className="text-[8px] font-bold uppercase mt-1">Requiere Camión Refrigerado</p>
                        </div>
                     </div>
                   )}
                   {product.dangerLevel !== 'none' ? (
                     <div className={cn(
                       "p-4 rounded-2xl flex items-start gap-4 text-white",
                       product.dangerLevel === 'high' ? "bg-red-600" : "bg-orange-500"
                     )}>
                        <AlertTriangle size={32} className="shrink-0" />
                        <div>
                           <h4 className="text-[10px] font-black uppercase italic tracking-widest opacity-70">Mercancía Peligrosa</h4>
                           <p className="text-xl font-black italic">ONU: {product.onuNumber}</p>
                           <p className="text-[8px] font-bold uppercase mt-1">Clase de Peligro: {product.dangerLevel.toUpperCase()}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl flex items-start gap-4">
                        <CheckCircle2 size={32} className="shrink-0" />
                        <div>
                           <h4 className="text-[10px] font-black uppercase italic tracking-widest opacity-70">Tipo de Carga</h4>
                           <p className="text-lg font-black italic">CARGA GENERAL</p>
                           <p className="text-[8px] font-bold uppercase mt-1">Sin restricciones químicas</p>
                        </div>
                     </div>
                   )}
                </section>
             </div>
          </div>

          {/* FIRMAS Y PIE DE PÁGINA */}
          <div className="mt-auto pt-8 border-t-2 border-slate-100 relative z-10">
             <div className="flex justify-between items-end">
                <div className="space-y-4 w-1/3">
                   <div className="h-16 border-b border-slate-300"></div>
                   <p className="text-[9px] font-black uppercase text-center">Responsable Logística / Calidad</p>
                </div>
                <div className="text-right space-y-1">
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">{orgName} - Gestión de Catálogo v4.0</p>
                   <p className="text-[7px] text-slate-300 font-mono">{product.id}</p>
                </div>
             </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .print-hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}