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
    <div className="space-y-6 pb-20 print:bg-white print:p-0">
      {/* HEADER WEB */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Auditoría Contable de Viaje</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Orden #{load.orderNumber} | {load.clientName}</p>
          </div>
        </div>
        <Button className="font-black h-11 px-8 rounded-2xl shadow-xl bg-blue-700 hover:bg-blue-800 text-white" onClick={downloadPdf}>
          <Download size={18} className="mr-2" /> DESCARGAR PDF (TEXTO)
        </Button>
      </div>

      {/* DASHBOARD WEB */}
      <div className="grid gap-4 md:grid-cols-4 print:hidden">
        <Card className="bg-slate-900 text-white border-none shadow-xl rounded-[2rem]">
          <CardHeader className="pb-2"><CardTitle className="text-[9px] uppercase text-white/40 font-black tracking-widest">Anticipo Entregado</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black italic text-green-400 leading-none">${load.budget?.initialAdvance?.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Tickets Auditados</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black italic text-slate-800 leading-none">${stats.approved.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="md:col-span-2 border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Consumo Presupuesto</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Progress value={budgetProgress} className="h-2 rounded-full" />
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
               <span>AUDITADO: ${stats.approved.toLocaleString()}</span>
               <span>TOPE: ${load.budget?.totalBudget?.toLocaleString() || '0'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl rounded-[2.5rem] bg-white">
          <CardHeader className="bg-slate-50/50 border-b py-6 px-8"><CardTitle className="text-sm font-black uppercase italic">Checklist de Auditoría</CardTitle></CardHeader>
          <CardContent className="p-0">
             <Table>
               <TableHeader><TableRow><TableHead className="px-8 text-[10px] font-black uppercase">Concepto</TableHead><TableHead className="text-[10px] font-black uppercase">Comprobante</TableHead><TableHead className="text-center text-[10px] font-black uppercase">Monto</TableHead><TableHead className="pr-8 text-right text-[10px] font-black uppercase">Acción</TableHead></TableRow></TableHeader>
               <TableBody>
                 {expenses?.map(exp => (
                   <TableRow key={exp.id}>
                     <TableCell className="px-8"><p className="font-black text-xs uppercase">{CATEGORY_LABELS[exp.category] || exp.category}</p><p className="text-[8px] text-slate-400">{exp.location}</p></TableCell>
                     <TableCell><Input placeholder="N°" className="h-8 text-[10px] font-mono font-bold" defaultValue={exp.receiptNumber} onBlur={(e) => handleUpdateReceipt(exp.id, e.target.value)} /></TableCell>
                     <TableCell className="text-center font-black text-sm italic">${exp.amount?.toLocaleString()}</TableCell>
                     <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-1">
                          {exp.status === 'registered' ? (
                            <><Button size="icon" variant="outline" className="h-7 w-7 text-green-600" onClick={() => handleUpdateStatus(exp.id, 'approved')}><CheckCircle2 size={14}/></Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 text-red-600" onClick={() => handleUpdateStatus(exp.id, 'rejected')}><XCircle size={14}/></Button></>
                          ) : <Badge className={cn("text-[8px]", exp.status === 'approved' ? "bg-green-600" : "bg-red-600")}>{exp.status.toUpperCase()}</Badge>}
                        </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
          </CardContent>
        </Card>
        <div className="space-y-6">
           <Card className="rounded-[2rem] bg-white p-6 flex flex-col items-center">
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">{pieData.map((e,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><RechartsTooltip/></PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-2">Distribución de Gastos</p>
           </Card>
        </div>
      </div>

      {/* DOCUMENTO PARA IMPRESIÓN (TEXTO NATIVO) */}
      <div className="hidden print:block w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans">
         <div className="border-[4px] border-double border-black p-8 flex flex-col min-h-full">
            <div className="flex justify-between items-start border-b-[3px] border-black pb-6 mb-8">
               <div className="flex items-center gap-5">
                  {tenant?.settings?.logoUrl && <img src={tenant.settings.logoUrl} className="h-20 w-auto" alt="Logo" />}
                  <div>
                    <h1 className="text-4xl font-black uppercase italic text-blue-800">{tenant?.name || 'LOGÍSTICA AR'}</h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Planilla de Rendición Contable de Gastos (NATIVA)</p>
                  </div>
               </div>
               <div className="text-right">
                  <div className="bg-black text-white px-4 py-1 text-[11px] font-black uppercase italic mb-2">AUDIT REPORT</div>
                  <p className="text-3xl font-mono font-black">OT: {load.orderNumber}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 border-2 border-black mb-8 bg-slate-50">
               <div className="p-5 border-r-2 border-black space-y-1">
                  <p className="text-[9px] font-black uppercase text-blue-800 tracking-widest">Personal de Conducción</p>
                  <p className="text-xl font-black uppercase italic">{driver ? `${driver.lastName}, ${driver.firstName}` : '---'}</p>
                  <p className="text-[10px] font-mono">DNI N° {driver?.dni || '---'}</p>
               </div>
               <div className="p-5 space-y-1">
                  <p className="text-[9px] font-black uppercase text-blue-800 tracking-widest">Unidad de Transporte</p>
                  <p className="text-xl font-black uppercase italic">DOMINIO: {truck?.plate || '---'}</p>
                  <p className="text-[10px]">{truck?.brand} {truck?.model}</p>
               </div>
            </div>

            <table className="w-full border-2 border-black mb-8 text-left border-collapse">
               <thead>
                  <tr className="bg-slate-100 border-b-2 border-black">
                     <th className="p-3 text-[10px] font-black uppercase">FECHA</th>
                     <th className="p-3 text-[10px] font-black uppercase">CONCEPTO</th>
                     <th className="p-3 text-[10px] font-black uppercase">COMPROBANTE</th>
                     <th className="p-3 text-right text-[10px] font-black uppercase">MONTO (ARS)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                  {expenses?.filter(e => e.status === 'approved').map(exp => (
                    <tr key={exp.id}>
                       <td className="p-3 text-[10px] font-mono">{exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "dd/MM/yy") : '---'}</td>
                       <td className="p-3">
                          <p className="text-[11px] font-black uppercase italic">{CATEGORY_LABELS[exp.category] || exp.category}</p>
                          <p className="text-[8px] text-slate-400">LUGAR: {exp.location}</p>
                       </td>
                       <td className="p-3 text-[10px] font-mono uppercase">{exp.receiptNumber || 'S/D'}</td>
                       <td className="p-3 text-right text-xs font-black">${exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
               </tbody>
               <tfoot>
                  <tr className="border-t-[3px] border-black bg-slate-50">
                     <td colSpan={3} className="p-4 text-right text-[10px] font-black uppercase italic">Total Comprobantes Auditados:</td>
                     <td className="p-4 text-right text-base font-black">${stats.approved.toLocaleString()}</td>
                  </tr>
                  <tr>
                     <td colSpan={3} className="p-2 text-right text-[10px] font-black text-slate-400">Fondos Iniciales (Anticipo):</td>
                     <td className="p-2 text-right text-base font-black text-red-600">-${(load.budget?.initialAdvance || 0).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-2 border-black bg-blue-50/20">
                     <td colSpan={3} className="p-5 text-right text-xs font-black uppercase italic tracking-widest text-blue-900">Total Liquidación Final:</td>
                     <td className={cn("p-5 text-right text-2xl font-black italic", balanceFinal >= 0 ? "text-red-700" : "text-green-700")}>
                        ${Math.abs(balanceFinal).toLocaleString()}
                     </td>
                  </tr>
               </tfoot>
            </table>

            <div className="mt-auto pt-12 border-t-4 border-black flex justify-between items-end">
               <div className="text-center w-[40%] space-y-4">
                  <div className="h-20 border-b-2 border-black border-dashed"></div>
                  <p className="text-[9px] font-black uppercase">Firma Conductor</p>
               </div>
               <div className="text-center w-[40%] space-y-4">
                  <div className="h-20 border-b-2 border-black flex items-center justify-center">
                     <div className="border-[3px] border-black px-6 py-2 text-xs font-black uppercase">AUDITADO OK</div>
                  </div>
                  <p className="text-[9px] font-black uppercase">Administración Central</p>
               </div>
            </div>
         </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; color: black !important; }
          .print\:hidden { display: none !important; }
          header, nav, aside, footer, button, .sidebar-trigger { display: none !important; }
          * { text-shadow: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
