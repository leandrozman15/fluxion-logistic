
'use client';

import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection } from "@/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, orderBy, getDoc } from "firebase/firestore";
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
  PieChart, CreditCard, Wallet, XCircle, MapPin, Download, Save
} from "lucide-react";
import { Load, Expense, ExpenseStatus, Driver, Truck, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
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
        if (load.assignedDriverId) {
          const dSnap = await getDoc(doc(db, "drivers", load.assignedDriverId));
          if (dSnap.exists()) setDriver(dSnap.data() as Driver);
        }
        if (load.assignedTruckId) {
          const tSnap = await getDoc(doc(db, "trucks", load.assignedTruckId));
          if (tSnap.exists()) setTruck(tSnap.data() as Truck);
        }
      } catch (e) {
        console.error("Error fetching report extras:", e);
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

  const handleUpdateStatus = (expenseId: string, status: ExpenseStatus) => {
    if (!db || !id) return;
    setIsUpdatingId(expenseId);
    
    const docRef = doc(db, "loads", id as string, "expenses", expenseId);
    const updateData = {
      status,
      updatedAt: serverTimestamp()
    };

    updateDoc(docRef, updateData)
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
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rendicion_Gastos_${load?.orderNumber || 'Viaje'}.pdf`);
      toast({ title: "PDF Generado con éxito" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading || loadingExtras) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Carga no encontrada.</div>;

  const balanceFinal = (load.budget?.initialAdvance || 0) - stats.total;

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER WEB */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Rendición de Gastos</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Orden #{load.orderNumber} | {load.clientName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="font-bold h-10 px-6 rounded-xl shadow-sm bg-white" 
            onClick={downloadPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <Loader2 className="animate-spin mr-2" /> : <Download size={16} className="mr-2" />} 
            Descargar Auditoría
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-900 text-white border-none shadow-xl rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] uppercase text-white/40 font-black tracking-widest">Saldo Anticipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-green-400 leading-none">
               ${balanceFinal.toLocaleString()}
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
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Progress value={load.budget?.totalBudget ? (stats.total / load.budget.totalBudget) * 100 : 0} className="h-2 rounded-full" />
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
               <Receipt className="text-blue-600" /> Detalle de Tickets Auditados
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
               <TableHeader className="bg-slate-50/30">
                 <TableRow>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest">Categoría / Lugar</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest">N° Factura / Ticket</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Monto</TableHead>
                   <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Audit.</TableHead>
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
                          className="h-8 text-[10px] font-mono font-bold bg-slate-50 border-none rounded-lg focus:ring-1 ring-blue-200"
                          defaultValue={exp.receiptNumber || ""}
                          onBlur={(e) => handleUpdateReceipt(exp.id, e.target.value)}
                        />
                     </TableCell>
                     <TableCell className="text-center font-black text-slate-900 text-sm italic">${exp.amount?.toLocaleString()}</TableCell>
                     <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {exp.status === 'registered' ? (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-full"
                                onClick={() => handleUpdateStatus(exp.id, 'approved')}
                              >
                                {isUpdatingId === exp.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-full"
                                onClick={() => handleUpdateStatus(exp.id, 'rejected')}
                              >
                                {isUpdatingId === exp.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />}
                              </Button>
                            </>
                          ) : (
                            <Badge className={cn(
                              "text-[8px] uppercase font-black",
                              exp.status === 'approved' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                              {exp.status === 'approved' ? 'OK' : 'RECHAZADO'}
                            </Badge>
                          )}
                        </div>
                     </TableCell>
                   </TableRow>
                 ))}
                 {(!expenses || expenses.length === 0) && (
                   <TableRow>
                     <TableCell colSpan={4} className="text-center py-32 text-slate-400 italic text-xs font-bold uppercase tracking-widest">Sin actividad financiera registrada.</TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
           <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
             <CardHeader className="bg-slate-50/50 border-b py-4">
               <CardTitle className="text-xs font-black uppercase tracking-widest">Distribución de Costos</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 pt-6 text-center">
                <PieChart size={48} className="mx-auto text-blue-100" />
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Gráfico de Reparto Mensual</p>
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
               <Button 
                variant="outline" 
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white hover:text-blue-700 font-black text-[10px] uppercase h-12 rounded-xl tracking-widest" 
                onClick={downloadPdf}
                disabled={isGeneratingPdf}
               >
                 {isGeneratingPdf ? <Loader2 className="animate-spin mr-2" /> : <Download size={14} className="mr-2" />} 
                 GENERAR PDF DE CIERRE
               </Button>
             </CardContent>
           </Card>
        </div>
      </div>

      {/* DOCUMENTO NATIVO PARA PDF (OCULTO EN WEB) */}
      <div className="fixed top-0 left-[-9999px] w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans" ref={reportRef}>
         <div className="border-4 border-black p-8 flex flex-col min-h-full">
            <div className="flex justify-between items-start border-b-4 border-black pb-8 mb-8">
               <div className="flex items-center gap-4">
                  {tenant?.settings?.logoUrl && (
                    <img src={tenant.settings.logoUrl} className="h-16 w-auto object-contain" alt="Logo" />
                  )}
                  <div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter text-blue-700">{tenant?.name || 'LOGÍSTICA AR'}</h1>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Planilla de Rendición Contable</p>
                  </div>
               </div>
               <div className="text-right">
                  <h2 className="text-xl font-black uppercase bg-black text-white px-4 py-1 italic mb-2">Internal Audit Report</h2>
                  <p className="text-3xl font-mono font-black text-slate-800">OT: {load.orderNumber}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 border-2 border-black mb-10">
               <div className="p-6 border-r-2 border-black space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Chofer Responsable</p>
                  <p className="text-lg font-black uppercase">{driver ? `${driver.lastName}, ${driver.firstName}` : '---'}</p>
                  <p className="text-xs font-mono">DNI: {driver?.dni || '---'}</p>
               </div>
               <div className="p-6 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Unidad de Transporte</p>
                  <p className="text-lg font-black uppercase">PATENTE: {truck?.plate || '---'}</p>
                  <p className="text-xs font-mono">{truck?.brand} {truck?.model}</p>
               </div>
            </div>

            <table className="w-full border-2 border-black mb-10 text-left">
               <thead>
                  <tr className="bg-slate-100 border-b-2 border-black">
                     <th className="p-3 text-[10px] font-black uppercase w-8">Audit.</th>
                     <th className="p-3 text-[10px] font-black uppercase">Fecha</th>
                     <th className="p-3 text-[10px] font-black uppercase">Concepto / Lugar</th>
                     <th className="p-3 text-[10px] font-black uppercase">N° Comprobante</th>
                     <th className="p-3 text-right text-[10px] font-black uppercase">Monto (ARS)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-black">
                  {expenses?.filter(e => e.status === 'approved').map(exp => (
                    <tr key={exp.id}>
                       <td className="p-3 text-center">
                          <div style={{ color: '#16a34a', fontSize: '14px', fontWeight: 'bold' }}>✓</div>
                       </td>
                       <td className="p-3 text-[11px] font-mono">{exp.createdAt?.toDate ? new Date(exp.createdAt.toDate()).toLocaleDateString() : '---'}</td>
                       <td className="p-3">
                          <p className="text-[11px] font-black uppercase">{CATEGORY_LABELS[exp.category] || exp.category}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">{exp.location}</p>
                       </td>
                       <td className="p-3 text-[11px] font-mono font-black uppercase">{exp.receiptNumber || '---'}</td>
                       <td className="p-3 text-right text-[11px] font-black">${exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
               </tbody>
               <tfoot>
                  <tr className="border-t-4 border-black bg-slate-50">
                     <td colSpan={4} className="p-4 text-right text-xs font-black uppercase">Total Gastos Auditados:</td>
                     <td className="p-4 text-right text-base font-black">${stats.total.toLocaleString()}</td>
                  </tr>
                  <tr>
                     <td colSpan={4} className="p-2 text-right text-xs font-black uppercase">Anticipo de Fondos:</td>
                     <td className="p-2 text-right text-base font-black text-red-600">-${(load.budget?.initialAdvance || 0).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-2 border-black">
                     <td colSpan={4} className="p-4 text-right text-sm font-black uppercase italic">Saldo Neto de Auditoría:</td>
                     <td className={cn("p-4 text-right text-xl font-black italic", balanceFinal >= 0 ? "text-green-600" : "text-red-600")}>
                        ${Math.abs(balanceFinal).toLocaleString()}
                     </td>
                  </tr>
               </tfoot>
            </table>

            <div className="mt-auto pt-10 border-t-4 border-black flex justify-between items-end">
               <div className="text-center w-1/3 space-y-4">
                  <div className="h-20 border-b-2 border-black"></div>
                  <p className="text-[10px] font-black uppercase">Firma del Conductor</p>
               </div>
               <div className="text-center w-1/3 space-y-4">
                  <div className="h-20 border-b-2 border-black flex items-center justify-center">
                     <p className="text-[10px] font-black uppercase border-2 border-black p-2 rotate-[-5deg]">AUDITADO OK</p>
                  </div>
                  <p className="text-[10px] font-black uppercase">Firma Administración</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
