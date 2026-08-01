
'use client';

import { useMemo, useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, collection, query, orderBy, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Loader2, Receipt, Download
} from "lucide-react";
import { Load, Expense, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'COMBUSTIBLE',
  toll: 'PEAJE',
  meal: 'COMIDA',
  lodging: 'HOSPEDAJE',
  maintenance: 'MANTENIMIENTO',
  other: 'OTROS'
};

function LoadWalletContent() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { tenantId } = useTenant();
  
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<TruckType | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const autoPrint = searchParams.get('print') === 'true';

  const loadRef = useMemo(() => {
    if (!db || !id || !tenantId) return null;
    return doc(db, "tenants", tenantId, "loads", id as string);
  }, [db, id, tenantId]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "loads", id as string, "expenses"), orderBy("createdAt", "desc"));
  }, [db, id, tenantId]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  useEffect(() => {
    async function fetchExtras() {
      if (!db || !load || !tenantId) return;
      setLoadingExtras(true);
      try {
        if (load.assignedDriverId && load.assignedDriverId !== 'none') {
          const dSnap = await getDoc(doc(db, "tenants", tenantId, "drivers", load.assignedDriverId));
          if (dSnap.exists()) setDriver(dSnap.data() as Driver);
        }
        if (load.assignedTruckId) {
          const tSnap = await getDoc(doc(db, "tenants", tenantId, "trucks", load.assignedTruckId));
          if (tSnap.exists()) setTruck(tSnap.data() as TruckType);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingExtras(false);
      }
    }
    fetchExtras();
  }, [db, load, tenantId]);

  useEffect(() => {
    if (autoPrint && !loading && !loadingExtras && expenses) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, loadingExtras, expenses]);

  if (loading || loadingExtras) return <div className="h-screen flex items-center justify-center gap-2 font-bold animate-pulse text-slate-500"><Loader2 className="animate-spin" /> GENERANDO RENDICIÓN A4...</div>;
  if (!load) return <div className="p-10 text-center">Carga no encontrada.</div>;

  const statsApproved = expenses?.filter(e => e.status === 'approved').reduce((acc, exp) => acc + (exp.amount || 0), 0) || 0;
  const balanceFinal = (load.budget?.initialAdvance || 0) - statsApproved;

  return (
    <div className="min-h-screen bg-slate-800 py-8 print:bg-white print:py-0 overflow-y-auto">
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center px-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full bg-slate-900/50 border-white/20 text-white"><ArrowLeft size={18} /></Button>
        <div className="flex gap-2">
           <Badge className="bg-blue-600 text-white border-none">PREVIO A4 VECTORIAL</Badge>
           <Button className="font-black h-11 px-8 rounded-xl shadow-2xl bg-white text-slate-900 hover:bg-blue-50" onClick={() => window.print()}>
             <Download size={18} className="mr-2" /> GENERAR PDF A4
           </Button>
        </div>
      </div>

      <div className="bg-white shadow-2xl print:shadow-none w-[210mm] min-h-[297mm] mx-auto text-black border-[12px] border-double border-slate-900 print:border-none p-12 print:p-10 font-sans flex flex-col overflow-hidden box-border">
         <div className="flex justify-between items-start border-b-[5px] border-black pb-8 mb-8">
            <div className="flex items-center gap-6">
               {tenant?.settings?.logoUrl && <img src={tenant.settings.logoUrl} className="h-20 w-auto" alt="Logo" />}
               <div>
                 <h1 className="text-4xl font-black uppercase italic text-blue-800 leading-none">{tenant?.name || 'LOGÍSTICA AR'}</h1>
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Planilla de Rendición Contable de Gastos</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-1">Audit Report v3.0 - Texto Vectorial A4</p>
               </div>
            </div>
            <div className="text-right">
               <div className="bg-black text-white px-5 py-2 text-[11px] font-black uppercase italic mb-3 text-center">FINANCIAL AUDIT</div>
               <p className="text-3xl font-mono font-black tracking-tighter">OT: {load.orderNumber}</p>
               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>
         </div>

         <div className="grid grid-cols-2 border-[3px] border-black mb-10 bg-slate-50 rounded-sm overflow-hidden">
            <div className="p-6 border-r-[3px] border-black space-y-1">
               <p className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Personal de Conducción</p>
               <p className="text-2xl font-black uppercase italic tracking-tight">{driver ? `${driver.lastName}, ${driver.firstName}` : '---'}</p>
               <p className="text-xs font-mono font-bold text-slate-500">DNI N° {driver?.dni || '---'}</p>
            </div>
            <div className="p-6 space-y-1">
               <p className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Unidad de Transporte</p>
               <p className="text-2xl font-black uppercase italic tracking-tight">DOMINIO: {truck?.plate || '---'}</p>
            </div>
         </div>

         <table className="w-full border-[3px] border-black mb-10 text-left border-collapse table-fixed">
            <thead>
               <tr className="bg-slate-200 border-b-[3px] border-black">
                  <th className="p-4 text-[11px] font-black uppercase w-24">FECHA</th>
                  <th className="p-4 text-[11px] font-black uppercase">CONCEPTO / LUGAR</th>
                  <th className="p-4 text-right text-[11px] font-black uppercase w-32">MONTO (ARS)</th>
               </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
               {expenses?.filter(e => e.status === 'approved').map(exp => (
                 <tr key={exp.id}>
                    <td className="p-4 text-xs font-mono font-bold">{exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "dd/MM/yy") : '---'}</td>
                    <td className="p-4">
                       <p className="text-sm font-black uppercase italic leading-none">{CATEGORY_LABELS[exp.category] || exp.category}</p>
                       <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">LUGAR: {exp.location}</p>
                    </td>
                    <td className="p-4 text-right text-sm font-black italic">${exp.amount.toLocaleString()}</td>
                 </tr>
               ))}
               {(!expenses || expenses.filter(e => e.status === 'approved').length === 0) && (
                 <tr><td colSpan={3} className="p-10 text-center text-xs font-black text-slate-300 uppercase italic tracking-widest">Sin comprobantes aprobados para este viaje.</td></tr>
               )}
            </tbody>
            <tfoot>
               <tr className="border-t-[4px] border-black bg-slate-50">
                  <td colSpan={2} className="p-5 text-right text-xs font-black uppercase italic tracking-widest">Anticipo Otorgado:</td>
                  <td className="p-5 text-right text-lg font-black italic">${(load.budget?.initialAdvance || 0).toLocaleString()}</td>
               </tr>
               <tr className="border-t-[2px] border-black bg-slate-50">
                  <td colSpan={2} className="p-5 text-right text-xs font-black uppercase italic tracking-widest">Total Gastos Auditados:</td>
                  <td className="p-5 text-right text-lg font-black italic text-red-700">-${statsApproved.toLocaleString()}</td>
               </tr>
               <tr className="border-t-[3px] border-black bg-blue-50/30">
                  <td colSpan={2} className="p-6 text-right text-sm font-black uppercase italic tracking-[0.3em] text-blue-900">Saldo Final a Liquidar:</td>
                  <td className={cn("p-6 text-right text-3xl font-black italic tracking-tighter", balanceFinal < 0 ? "text-red-700" : "text-green-700")}>
                     ${Math.abs(balanceFinal).toLocaleString()}
                     <span className="text-xs block font-bold uppercase tracking-widest">{balanceFinal >= 0 ? '(A FAVOR CIA)' : '(REINTEGRO)'}</span>
                  </td>
               </tr>
            </tfoot>
         </table>

         <div className="mt-auto pt-16 border-t-[5px] border-black flex justify-between items-end">
            <div className="text-center w-[45%] space-y-4">
               <div className="h-20 border-b-[3px] border-black border-dashed"></div>
               <p className="text-[10px] font-black uppercase tracking-widest">Firma Conductor</p>
            </div>
            <div className="text-center w-[45%] space-y-4">
               <div className="h-20 border-[3px] border-black flex items-center justify-center bg-slate-50 rotate-[-2deg] shadow-xl">
                  <p className="text-xs font-black uppercase">AUDITADO OK</p>
               </div>
               <p className="text-[10px] font-black uppercase tracking-widest">Administración Central</p>
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

export default function LoadWalletPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center gap-2 font-bold animate-pulse text-slate-500"><Loader2 className="animate-spin" /> GENERANDO RENDICIÓN A4...</div>}>
      <LoadWalletContent />
    </Suspense>
  );
}
