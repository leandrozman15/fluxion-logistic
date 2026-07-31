
'use client';

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, orderBy, getDoc } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  DollarSign, ArrowLeft, Loader2, CheckCircle2, 
  AlertTriangle, Receipt, Download, Truck, User, MapPin, CreditCard, XCircle, PieChart as PieChartIcon
} from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip 
} from "recharts";
import { Load, Expense, ExpenseStatus, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'COMBUSTIBLE',
  toll: 'PEAJE',
  meal: 'COMIDA',
  lodging: 'HOSPEDAJE',
  maintenance: 'MANTENIMIENTO',
  other: 'OTROS'
};

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function LoadWalletPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<TruckType | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const tenantRef = useMemo(() => {
    if (!db) return null;
    return doc(db, "tenants", "default_tenant");
  }, [db]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(collection(db, "loads", id as string, "expenses"), orderBy("createdAt", "desc"));
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  useEffect(() => {
    async function fetchExtras() {
      if (!db || !load) return;
      setLoadingExtras(true);
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
        console.error("Error fetching extras:", e);
      } finally {
        setLoadingExtras(false);
      }
    }
    fetchExtras();
  }, [db, load]);

  const stats = useMemo(() => {
    if (!expenses) return { total: 0, pending: 0, approved: 0 };
    return {
      total: expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0),
      pending: expenses.filter(e => e.status === 'registered').length,
      approved: expenses.reduce((acc, exp) => exp.status === 'approved' ? acc + exp.amount : acc, 0)
    };
  }, [expenses]);

  const pieData = useMemo(() => {
    if (!expenses) return [];
    const totals: Record<string, number> = {};
    expenses.forEach(exp => {
      const label = CATEGORY_LABELS[exp.category] || exp.category.toUpperCase();
      totals[label] = (totals[label] || 0) + (exp.amount || 0);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [expenses]);

  const handleUpdateStatus = (expenseId: string, status: ExpenseStatus) => {
    if (!db || !id) return;
    setIsUpdatingId(expenseId);
    
    const docRef = doc(db, "loads", id as string, "expenses", expenseId);
    const updateData = { status, updatedAt: serverTimestamp() };

    updateDoc(docRef, updateData)
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setIsUpdatingId(null));
  };

  const handleUpdateReceipt = (expenseId: string, value: string) => {
    if (!db || !id) return;
    const docRef = doc(db, "loads", id as string, "expenses", expenseId);
    updateDoc(docRef, { receiptNumber: value, updatedAt: serverTimestamp() });
  };

  const downloadPdf = () => {
    window.print();
  };

  if (loading || loadingExtras) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Carga no encontrada.</div>;

  const balanceFinal = stats.approved - (load.budget?.initialAdvance || 0);
  const budgetProgress = load.budget?.totalBudget ? (stats.approved / load.budget.totalBudget) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-800 py-8 print:bg-white print:py-0 overflow-y-auto">
      {/* HEADER WEB - OCULTO EN IMPRESIÓN */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full bg-slate-900/50 border-white/20 text-white"><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Auditoría de Gastos</h1>
            <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-1">Orden #{load.orderNumber} | {load.clientName}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <Badge className="bg-green-600 text-white border-none">VISTA PREVIA TEXTO NATIVO</Badge>
           <Button className="font-black h-11 px-8 rounded-xl shadow-2xl bg-white text-slate-900 hover:bg-blue-50" onClick={downloadPdf}>
             <Download size={18} className="mr-2" /> GENERAR REPORTE (PDF TEXTO)
           </Button>
        </div>
      </div>

      {/* DASHBOARD WEB - OCULTO EN IMPRESIÓN */}
      <div className="max-w-[210mm] mx-auto grid gap-4 md:grid-cols-4 px-4 mb-8 print:hidden">
        <Card className="bg-slate-900 text-white border-white/10 shadow-xl rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-[9px] uppercase text-white/40 font-black tracking-widest">Anticipo</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black italic text-green-400">${load.budget?.initialAdvance?.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Auditado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black italic text-slate-800">${stats.approved.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="md:col-span-2 bg-white border-none shadow-sm rounded-2xl">
          <CardHeader className="pb-2"><CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Consumo Presupuesto</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-1">
            <Progress value={budgetProgress} className="h-1.5 rounded-full" />
            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
               <span>CONSUMIDO: ${stats.approved.toLocaleString()}</span>
               <span>DISPONIBLE: ${load.budget?.totalBudget?.toLocaleString() || '0'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DOCUMENTO PARA IMPRESIÓN (TEXTO NATIVO VECTORIAL) */}
      <div className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] print:shadow-none w-[210mm] min-h-[297mm] mx-auto text-black p-12 font-sans border-[8px] border-double border-slate-900 print:border-none">
         <div className="flex flex-col h-full">
            <div className="flex justify-between items-start border-b-[4px] border-black pb-8 mb-8">
               <div className="flex items-center gap-6">
                  {tenant?.settings?.logoUrl && <img src={tenant.settings.logoUrl} className="h-20 w-auto" alt="Logo" />}
                  <div>
                    <h1 className="text-4xl font-black uppercase italic text-blue-800 leading-none">{tenant?.name || 'LOGÍSTICA AR'}</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Planilla de Rendición Contable de Gastos (NATIVA)</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-1">Audit Report v3.0 - Texto Seleccionable</p>
                  </div>
               </div>
               <div className="text-right">
                  <div className="bg-black text-white px-5 py-2 text-[11px] font-black uppercase italic mb-3">FINANCIAL AUDIT</div>
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
                  <p className="text-xs font-bold text-slate-500 uppercase">{truck?.brand} {truck?.model}</p>
               </div>
            </div>

            <table className="w-full border-[3px] border-black mb-10 text-left border-collapse">
               <thead>
                  <tr className="bg-slate-200 border-b-[3px] border-black">
                     <th className="p-4 text-[11px] font-black uppercase w-24">FECHA</th>
                     <th className="p-4 text-[11px] font-black uppercase">CONCEPTO / LUGAR</th>
                     <th className="p-4 text-[11px] font-black uppercase w-40">COMPROBANTE</th>
                     <th className="p-4 text-right text-[11px] font-black uppercase w-32">MONTO (ARS)</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-black/10">
                  {expenses?.filter(e => e.status === 'approved').map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50">
                       <td className="p-4 text-xs font-mono font-bold">{exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "dd/MM/yy") : '---'}</td>
                       <td className="p-4">
                          <p className="text-sm font-black uppercase italic leading-none">{CATEGORY_LABELS[exp.category] || exp.category}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">LUGAR: {exp.location}</p>
                       </td>
                       <td className="p-4 text-xs font-mono font-black uppercase text-blue-800">{exp.receiptNumber || 'S/D'}</td>
                       <td className="p-4 text-right text-sm font-black italic">${exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!expenses || expenses.filter(e => e.status === 'approved').length === 0) && (
                    <tr>
                       <td colSpan={4} className="p-10 text-center text-xs font-black text-slate-300 uppercase italic tracking-widest">No hay comprobantes aprobados para este viaje.</td>
                    </tr>
                  )}
               </tbody>
               <tfoot>
                  <tr className="border-t-[4px] border-black bg-slate-50">
                     <td colSpan={3} className="p-5 text-right text-xs font-black uppercase italic tracking-widest">Total Comprobantes Auditados:</td>
                     <td className="p-5 text-right text-lg font-black italic">${stats.approved.toLocaleString()}</td>
                  </tr>
                  <tr>
                     <td colSpan={3} className="p-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Fondos Iniciales (Anticipo):</td>
                     <td className="p-3 text-right text-lg font-black text-red-600 italic">-${(load.budget?.initialAdvance || 0).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-[3px] border-black bg-blue-50/30">
                     <td colSpan={3} className="p-6 text-right text-sm font-black uppercase italic tracking-[0.3em] text-blue-900">Total Liquidación Final:</td>
                     <td className={cn("p-6 text-right text-3xl font-black italic tracking-tighter", balanceFinal >= 0 ? "text-red-700" : "text-green-700")}>
                        ${Math.abs(balanceFinal).toLocaleString()}
                     </td>
                  </tr>
               </tfoot>
            </table>

            <div className="mt-auto pt-16 border-t-[5px] border-black flex justify-between items-end">
               <div className="text-center w-[42%] space-y-5">
                  <div className="h-24 border-b-[3px] border-black border-dashed flex items-end justify-center">
                     <p className="text-[10px] font-bold text-slate-300 pb-2">FIRMA DIGITAL / HOLÓGRAFA</p>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Conformidad Conductor</p>
               </div>
               <div className="text-center w-[42%] space-y-5">
                  <div className="h-24 border-b-[3px] border-black flex items-center justify-center">
                     <div className="border-[4px] border-black px-8 py-3 text-sm font-black uppercase shadow-xl bg-slate-50 rotate-[-3deg]">AUDITADO OK</div>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Administración Central Logística Ar</p>
               </div>
            </div>
         </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; color: black !important; width: 210mm; height: 297mm; }
          .print\:hidden { display: none !important; }
          header, nav, aside, footer, button, .sidebar-trigger { display: none !important; }
          .min-h-screen { min-h-0 !important; padding: 0 !important; background: white !important; }
          .bg-white { background: white !important; }
          .border-\[8px\] { border: none !important; }
          .shadow-\[0_0_50px_rgba\(0\,0\,0\,0\.5\)\] { box-shadow: none !important; }
          * { text-shadow: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
