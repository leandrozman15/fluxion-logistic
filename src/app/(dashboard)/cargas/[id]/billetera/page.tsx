'use client';

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, orderBy } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  DollarSign, ArrowLeft, Loader2, CheckCircle2, 
  AlertTriangle, Receipt, Printer, FileText,
  PieChart, CreditCard, Wallet, XCircle, Trash2, Save, MapPin
} from "lucide-react";
import { Load, Expense, ExpenseStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'COMBUSTIBLE',
  toll: 'PEAJE',
  meal: 'COMIDA',
  lodging: 'HOSPEDAJE',
  maintenance: 'MANTENIMIENTO',
  other: 'OTROS'
};

export default function LoadWalletPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  const loadRef = useMemo(() => {
    if (!db || !id) return null;
    return doc(db, "loads", id as string);
  }, [db, id]);

  const { data: load, loading } = useDoc<Load>(loadRef);

  const expensesQuery = useMemo(() => {
    if (!db || !id) return null;
    return query(collection(db, "loads", id as string, "expenses"), orderBy("createdAt", "desc"));
  }, [db, id]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const stats = useMemo(() => {
    if (!expenses) return { total: 0, pending: 0, approved: 0 };
    return {
      total: expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0),
      pending: expenses.filter(e => e.status === 'registered').length,
      approved: expenses.reduce((acc, exp) => exp.status === 'approved' ? acc + exp.amount : acc, 0)
    };
  }, [expenses]);

  const handleUpdateStatus = (expenseId: string, status: ExpenseStatus) => {
    if (!db || !id) return;
    setIsUpdatingId(expenseId);
    
    const docRef = doc(db, "loads", id as string, "expenses", expenseId);
    const updateData = {
      status,
      updatedAt: serverTimestamp()
    };

    // NO usar await aquí para permitir actualizaciones optimistas en la UI
    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: `Gasto ${status === 'approved' ? 'Aprobado' : 'Rechazado'}` });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsUpdatingId(null);
      });
  };

  const handleUpdateReceipt = (expenseId: string, value: string) => {
    if (!db || !id) return;
    const docRef = doc(db, "loads", id as string, "expenses", expenseId);
    const updateData = {
      receiptNumber: value,
      updatedAt: serverTimestamp()
    };

    updateDoc(docRef, updateData).catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: updateData,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Carga no encontrada.</div>;

  const budgetUsed = load.budget?.totalBudget ? (stats.total / load.budget.totalBudget) * 100 : 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Rendición de Gastos</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Orden #{load.orderNumber} | {load.clientName}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none font-bold" onClick={() => window.print()}>
            <Printer size={16} className="mr-2" /> Imprimir Reporte
          </Button>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 uppercase px-4 h-10 font-black">
             {load.clientName}
          </Badge>
        </div>
      </div>

      {/* CABECERA PARA IMPRESIÓN (OCULTA EN WEB) */}
      <div className="hidden print:block border-b-4 border-slate-900 pb-6 mb-8">
         <div className="flex justify-between items-start">
            <div>
               <h1 className="text-3xl font-black italic uppercase text-blue-600">Rendición de Gastos de Viaje</h1>
               <p className="text-sm font-bold text-slate-500 uppercase">Sistema Centralizado de Auditoría Logística</p>
            </div>
            <div className="text-right">
               <p className="text-lg font-black font-mono">ORDEN: {load.orderNumber}</p>
               <p className="text-xs text-slate-400">Emisión: {new Date().toLocaleDateString()}</p>
            </div>
         </div>
         <div className="grid grid-cols-3 gap-8 mt-6">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-slate-400 uppercase">Cliente / Operación</p>
               <p className="text-sm font-bold uppercase">{load.clientName}</p>
            </div>
            <div className="space-y-1">
               <p className="text-[10px] font-black text-slate-400 uppercase">Tipo de Carga</p>
               <p className="text-sm font-bold uppercase">{load.serviceType}</p>
            </div>
            <div className="space-y-1 text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase">Estado de Viaje</p>
               <p className="text-sm font-bold uppercase">{load.status}</p>
            </div>
         </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900 text-white border-none shadow-xl rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] uppercase text-white/40 font-black tracking-widest">Saldo Anticipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-green-400 leading-none">
               ${((load.budget?.initialAdvance || 0) - stats.total).toLocaleString()}
            </div>
            <p className="text-[9px] text-white/30 font-bold uppercase mt-2">Base: ${load.budget?.initialAdvance?.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Gastos Auditados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-slate-800 leading-none">${stats.total.toLocaleString()}</div>
            <p className="text-[9px] text-orange-500 font-bold uppercase flex items-center gap-1 mt-2">
               <AlertTriangle size={10} /> {stats.pending} tickets por verificar
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Uso de Presupuesto</CardTitle>
            <Badge variant={budgetUsed > 90 ? 'destructive' : 'secondary'} className="text-[10px] font-black border-none h-5">
              {Math.round(budgetUsed)}%
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Progress value={budgetUsed} className={cn("h-2 rounded-full", budgetUsed > 90 ? "bg-red-100" : "bg-slate-100")} />
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
               <span>CONSUMO: ${stats.total.toLocaleString()}</span>
               <span>MÁXIMO: ${load.budget?.totalBudget?.toLocaleString() || '0'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl rounded-[2rem] bg-white">
          <CardHeader className="bg-slate-50/50 border-b py-6">
             <CardTitle className="text-sm font-black flex items-center gap-2 uppercase italic">
               <Receipt className="text-blue-600" /> Detalle de Tickets y Facturas
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
               <TableHeader className="bg-slate-50/30">
                 <TableRow>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest">Categoría / Lugar</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest">N° Factura / Ticket</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Monto</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest">Audit.</TableHead>
                   <TableHead className="text-right text-[10px] font-black uppercase tracking-widest print:hidden">Acciones</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {expenses?.map(exp => (
                   <TableRow key={exp.id} className="hover:bg-slate-50/50 group transition-colors">
                     <TableCell>
                       <div className="space-y-1">
                         <div className="font-black text-slate-800 text-xs uppercase italic">
                           {CATEGORY_LABELS[exp.category] || exp.category.toUpperCase()}
                         </div>
                         <div className="text-[9px] text-slate-400 uppercase font-bold flex items-center gap-1">
                            <MapPin size={8}/> {exp.location}
                         </div>
                       </div>
                     </TableCell>
                     <TableCell>
                        <Input 
                          placeholder="F-0001-0000..." 
                          className="h-8 text-[10px] font-mono font-bold bg-slate-50 border-none rounded-lg focus:ring-1 ring-blue-200 print:bg-transparent print:p-0"
                          defaultValue={exp.receiptNumber || ""}
                          onBlur={(e) => handleUpdateReceipt(exp.id, e.target.value)}
                        />
                     </TableCell>
                     <TableCell className="text-center font-black text-slate-900 text-sm italic">${exp.amount?.toLocaleString()}</TableCell>
                     <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[8px] uppercase font-black h-4 px-2 border-none italic",
                          exp.status === 'approved' ? "bg-green-100 text-green-700" :
                          exp.status === 'rejected' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                        )}>
                          {exp.status === 'registered' ? 'PENDIENTE' : exp.status === 'approved' ? 'APROBADO' : 'RECHAZADO'}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right print:hidden">
                        <div className="flex justify-end gap-1">
                          {exp.status === 'registered' && (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-green-600 hover:bg-green-50 rounded-full"
                                onClick={() => handleUpdateStatus(exp.id, 'approved')}
                                title="Aprobar Gasto"
                                disabled={isUpdatingId === exp.id}
                              >
                                {isUpdatingId === exp.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-red-600 hover:bg-red-50 rounded-full"
                                onClick={() => handleUpdateStatus(exp.id, 'rejected')}
                                title="Rechazar Gasto"
                                disabled={isUpdatingId === exp.id}
                              >
                                {isUpdatingId === exp.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 rounded-full">
                             <FileText size={14} />
                          </Button>
                        </div>
                     </TableCell>
                   </TableRow>
                 ))}
                 {(!expenses || expenses.length === 0) && (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-32 text-slate-400 italic text-xs font-bold uppercase tracking-widest">Sin actividad financiera registrada.</TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
          </CardContent>
        </Card>

        <div className="space-y-6 print:hidden">
           <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
             <CardHeader className="bg-slate-50/50 border-b py-4">
               <CardTitle className="text-xs font-black uppercase tracking-widest">Distribución de Costos</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 pt-6">
                <div className="h-[180px] bg-slate-50/50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-100">
                   <PieChart size={32} className="text-slate-200 mb-2" />
                   <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Análisis por Categoría</p>
                </div>
                <div className="space-y-2">
                   {['COMBUSTIBLE', 'PEAJES', 'VIÁTICOS'].map(cat => (
                     <div key={cat} className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                       <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> {cat}</span>
                       <span className="text-slate-900 italic">33%</span>
                     </div>
                   ))}
                </div>
             </CardContent>
           </Card>

           <Card className="bg-blue-600 text-white border-none shadow-xl rounded-3xl overflow-hidden">
             <CardHeader className="bg-blue-700/50 border-b border-blue-500/30 py-4">
               <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest">
                 <CreditCard size={16} className="text-blue-200" /> Cierre Contable
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4 pt-6">
               <p className="text-[10px] font-bold opacity-80 leading-relaxed uppercase">La liquidación final concilia los anticipos entregados contra los comprobantes auditados.</p>
               <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white hover:text-blue-700 font-black text-[10px] uppercase h-12 rounded-xl tracking-widest" onClick={() => window.print()}>
                 <Printer size={14} className="mr-2" /> GENERAR PDF DE CIERRE
               </Button>
             </CardContent>
           </Card>
        </div>

        {/* PIE DE PÁGINA PARA IMPRESIÓN */}
        <div className="hidden print:grid grid-cols-2 gap-10 mt-12 col-span-3 pt-10 border-t border-slate-200">
           <div className="space-y-4">
              <div className="h-20 border-b border-slate-300"></div>
              <p className="text-[10px] font-black uppercase text-center">Firma del Conductor</p>
           </div>
           <div className="space-y-4">
              <div className="h-20 border-b border-slate-300"></div>
              <p className="text-[10px] font-black uppercase text-center">Responsable de Auditoría</p>
           </div>
           <div className="col-span-2 text-center mt-10">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">DOCUMENTO DE RENDICIÓN OFICIAL - LOGÍSTICA AR</p>
           </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { background: white !important; font-size: 12pt; }
          .print\:hidden { display: none !important; }
          .print\:block { display: block !important; }
          .print\:grid { display: grid !important; }
          input { border: none !important; padding: 0 !important; }
          .shadow-sm, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
          .rounded-3xl, .rounded-[2rem] { border-radius: 4px !important; }
          tr { border-bottom: 1px solid #e2e8f0 !important; }
        }
      `}</style>
    </div>
  );
}
