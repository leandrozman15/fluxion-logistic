'use client';

import { useMemo } from "react";
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
  ShieldCheck, 
  Box, 
  CheckCircle2, 
  LayoutGrid, 
  FileText,
  Building2,
  Globe,
  Info as InfoIcon
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
  if (!product) return <div className="p-20 text-center">Producto no encontrado en el catálogo.</div>;

  const validationUrl = typeof window !== 'undefined' ? `${window.location.origin}/productos/${product.id}` : '';
  const orgName = tenant?.name || "LOGÍSTICA AR";

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0 overflow-y-auto">
      <div className="max-w-[210mm] mx-auto space-y-6 print:space-y-0">
        {/* TOOLBAR WEB */}
        <div className="flex justify-between items-center print:hidden px-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-600 bg-white shadow-sm border rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo
          </Button>
          <Button onClick={() => window.print()} className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold shadow-xl">
             <Printer className="mr-2 h-4 w-4" /> DESCARGAR PDF A4
          </Button>
        </div>

        {/* DOCUMENTO A4 */}
        <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto flex flex-col font-sans text-slate-900 print:shadow-none overflow-hidden relative border-t-[12px] border-blue-600">
          
          {/* CABECERA CORPORATIVA */}
          <div className="p-12 pb-6 border-b flex justify-between items-start">
             <div className="flex gap-6 items-center">
                {tenant?.settings?.logoUrl ? (
                   <img src={tenant.settings.logoUrl} className="h-20 w-auto object-contain" alt="Logo" />
                ) : (
                   <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <Building2 size={32} />
                   </div>
                )}
                <div>
                   <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-slate-900">{orgName}</h1>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mt-2">Sistema Central de Gestión de Cargas</p>
                   <div className="flex items-center gap-4 mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><FileText size={12} /> CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</span>
                      <span className="flex items-center gap-1"><Globe size={12} /> Argentina</span>
                   </div>
                </div>
             </div>
             <div className="text-right">
                <div className="bg-slate-900 text-white px-6 py-2 rounded-sm mb-3">
                   <h2 className="text-xs font-black uppercase tracking-[0.2em] italic text-center">FICHA TÉCNICA</h2>
                </div>
                <p className="text-4xl font-mono font-black tracking-tighter leading-none">{product.sku}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-2">Versión Digital: {format(new Date(), "yyyy-MM")}</p>
             </div>
          </div>

          <div className="flex-1 px-12 py-8 space-y-10">
             {/* SECCIÓN 1: IDENTIFICACIÓN PRINCIPAL */}
             <div className="grid grid-cols-12 gap-8">
                <div className="col-span-8 space-y-4">
                   <div className="space-y-1">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[8px] font-black uppercase px-2 mb-1">{product.category}</Badge>
                      <h2 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-[0.9]">{product.name}</h2>
                      <p className="text-xl font-bold text-slate-400 uppercase italic mt-2">{product.brand || 'Marca no especificada'}</p>
                   </div>
                   
                   {/* DESCRIPCIÓN DEL PRODUCTO */}
                   <div className="pt-6">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2 flex items-center gap-2">
                        <InfoIcon size={14} /> Descripción del Artículo
                      </h3>
                      <div className="p-6 bg-slate-50 border-l-4 border-blue-600 rounded-r-2xl">
                         <p className="text-sm leading-relaxed font-medium text-slate-600 italic">
                            {product.description || 'No hay una descripción técnica cargada para este artículo. Consulte con el departamento comercial para más detalles.'}
                         </p>
                      </div>
                   </div>
                </div>

                {/* IMAGEN Y QR */}
                <div className="col-span-4 flex flex-col gap-6">
                   <div className="aspect-square bg-white border-2 border-slate-100 rounded-3xl shadow-xl p-2 flex items-center justify-center overflow-hidden">
                      {product.photoUrl ? (
                        <img src={product.photoUrl} className="w-full h-full object-cover rounded-2xl" alt={product.name} />
                      ) : (
                        <Package size={80} className="text-slate-100" />
                      )}
                   </div>
                   <div className="p-4 bg-slate-900 text-white rounded-3xl flex flex-col items-center gap-3 shadow-lg">
                      <div className="p-2 bg-white rounded-xl">
                         <QRCodeSVG value={validationUrl} size={100} />
                      </div>
                      <p className="text-[7px] font-black text-center uppercase tracking-widest opacity-50">Auditoría Operacional QR</p>
                   </div>
                </div>
             </div>

             {/* SECCIÓN 2: ESPECIFICACIONES TÉCNICAS (GRIDS) */}
             <div className="space-y-6">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-100 pb-2">Configuración Logística</h3>
                <div className="grid grid-cols-4 gap-4">
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                      <Scale size={20} className="text-blue-600" />
                      <p className="text-[9px] font-black text-slate-400 uppercase">Peso Bruto</p>
                      <p className="text-2xl font-black italic">{product.unitWeightKg} <span className="text-xs font-normal">KG</span></p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                      <LayoutGrid size={20} className="text-blue-600" />
                      <p className="text-[9px] font-black text-slate-400 uppercase">Volumen</p>
                      <p className="text-2xl font-black italic">{product.unitVolumeM3} <span className="text-xs font-normal">M³</span></p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                      <Layers size={20} className="text-blue-600" />
                      <p className="text-[9px] font-black text-slate-400 uppercase">u. x Pallet</p>
                      <p className="text-2xl font-black italic">{product.unitsPerPallet || '--'} <span className="text-xs font-normal">Un.</span></p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2">
                      <Box size={20} className="text-blue-600" />
                      <p className="text-[9px] font-black text-slate-400 uppercase">Embalaje</p>
                      <p className="text-xl font-black uppercase italic truncate">{product.packagingType}</p>
                   </div>
                </div>
             </div>

             {/* SECCIÓN 3: CUMPLIMIENTO Y SEGURIDAD */}
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-100 pb-2">Identificación Mercosur</h3>
                   <div className="p-6 border-2 border-slate-100 rounded-3xl space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase text-slate-400">Posición NCM</span>
                         <span className="font-mono font-black text-blue-700">{product.ncmCode || 'NO DEFINIDA'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] font-black uppercase text-slate-400">Origen Mercadería</span>
                         <Badge className="bg-slate-900 border-none uppercase text-[8px] font-black">{product.origin}</Badge>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 border-b-2 border-slate-100 pb-2">Seguridad y Riesgos</h3>
                   <div className="p-6 border-2 border-slate-100 rounded-3xl space-y-4">
                      {product.requiresReefer ? (
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><ThermometerSnowflake size={20} /></div>
                           <p className="text-sm font-black italic">RANGO: {product.tempRange?.min}°C A {product.tempRange?.max}°C</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 opacity-30">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><ThermometerSnowflake size={20} /></div>
                           <p className="text-[10px] font-black uppercase">Ambiente Controlado: NO</p>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                         <div className={cn(
                           "w-10 h-10 rounded-full flex items-center justify-center text-white",
                           product.dangerLevel !== 'none' ? "bg-red-600 shadow-lg shadow-red-200" : "bg-green-600"
                         )}>
                            {product.dangerLevel !== 'none' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                         </div>
                         <div className="space-y-0.5">
                            <p className="text-xs font-black uppercase tracking-tighter">
                               {product.dangerLevel !== 'none' ? `CLASE PELIGRO: ${product.dangerLevel.toUpperCase()}` : 'CARGA GENERAL'}
                            </p>
                            {product.onuNumber && <p className="text-[8px] font-bold text-slate-400 uppercase">N° ONU: {product.onuNumber}</p>}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* FOOTER DE VALIDEZ */}
          <div className="p-12 pt-0 mt-auto">
             <div className="border-t-2 border-slate-900 pt-8 flex justify-between items-end">
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase italic text-slate-900">Validado por Auditoría Central LogísticaAr</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Generado el {format(new Date(), "dd/MM/yyyy HH:mm")} | Ref: {product.id.substring(0,8)}</p>
                </div>
                <div className="text-right">
                   <div className="inline-block border-[3px] border-slate-900 p-4 bg-slate-50 rotate-[-2deg]">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center">APROBADO OK</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase mt-1 text-center">Documento Técnico Certificado</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; margin: 0; padding: 0; width: 210mm; height: 297mm; }
          .print\:hidden { display: none !important; }
          header, nav, aside, footer, .sidebar-trigger, button { display: none !important; }
          .min-h-screen { min-h-0 !important; padding: 0 !important; background: white !important; }
          .w-\[210mm\], .max-w-\[210mm\] { width: 210mm !important; height: 297mm !important; border: none !important; margin: 0 !important; box-shadow: none !important; }
          * { text-shadow: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}