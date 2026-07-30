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
  PieChart, CreditCard, Wallet, XCircle, MapPin, Download, Save, Truck, User
} from "lucide-react";
import { Load, Expense, ExpenseStatus, Driver, Truck as TruckType, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

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
        if (load.assignedDriverId) {
          const dSnap = await getDoc(doc(db, "drivers", load.assignedDriverId));
          if (dSnap.exists()) setDriver(dSnap.data() as Driver);
        }
        if (load.assignedTruckId) {
          const tSnap = await getDoc(doc(db, "trucks", load.assignedTruckId));
          if (tSnap.exists()) setTruck(tSnap.data() as TruckType);
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
        scale: 3,
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff"
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rendicion_Gastos_${load?.orderNumber || 'Viaje'}.pdf`);
      toast({ title: "Planilla PDF descargada con éxito" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading || loadingExtras) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!load) return <div className="p-10 text-center">Carga no encontrada.</div>;

  const balanceFinal = stats.approved - (load.budget?.initialAdvance || 0);

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
        <div className="flex gap-2">
          <Button 
            className="font-black h-11 px-8 rounded-2xl shadow-xl bg-blue-700 hover:bg-blue-800 text-white border-none" 
            onClick={downloadPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? <Loader2 className="animate-spin mr-2" /> : <Download size={18} className="mr-2" />} 
            DESCARGAR PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 print:hidden">
        <Card className="bg-slate-900 text-white border-none shadow-xl rounded-[2rem]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] uppercase text-white/40 font-black tracking-widest">Anticipo Entregado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic text-green-400 leading-none">
               ${load.budget?.initialAdvance?.toLocaleString()}
            </div>
            <p className="text-[9px] text-white/30 font-bold uppercase mt-2 italic">Fondos iniciales de ruta</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Tickets Auditados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black italic text-slate-800 leading-none">${stats.approved.toLocaleString()}</div>
            <p className="text-[9px] text-orange-500 font-bold uppercase flex items-center gap-1 mt-2">
               <AlertTriangle size={10} /> {stats.pending} tickets por verificar
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-[9px] uppercase text-slate-400 font-black tracking-widest">Consumo de Presupuesto Global</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Progress value={load.budget?.totalBudget ? (stats.approved / load.budget.totalBudget) * 100 : 0} className="h-2 rounded-full" />
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
               <span>GASTO AUDITADO: ${stats.approved.toLocaleString()}</span>
               <span>TOPE ESTIMADO: ${load.budget?.totalBudget?.toLocaleString() || '0'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl rounded-[2.5rem] bg-white">
          <CardHeader className="bg-slate-50/50 border-b py-6 px-8">
             <CardTitle className="text-sm font-black flex items-center gap-2 uppercase italic">
               <Receipt className="text-blue-600" /> Checklist de Auditoría (Tickets)
             </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
               <TableHeader className="bg-slate-50/30">
                 <TableRow>
                   <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">Concepto / Lugar</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest">N° Comprobante</TableHead>
                   <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Monto</TableHead>
                   <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acción</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {expenses?.map(exp => (
                   <TableRow key={exp.id} className="hover:bg-slate-50/50 group transition-colors">
                     <TableCell className="px-8">
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
                          placeholder="N° de Ticket" 
                          className="h-8 text-[10px] font-mono font-bold bg-slate-50 border-none rounded-lg focus:ring-2 ring-blue-100"
                          defaultValue={exp.receiptNumber || ""}
                          onBlur={(e) => handleUpdateReceipt(exp.id, e.target.value)}
                        />
                     </TableCell>
                     <TableCell className="text-center font-black text-slate-900 text-sm italic">${exp.amount?.toLocaleString()}</TableCell>
                     <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-1.5">
                          {exp.status === 'registered' ? (
                            <>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8 text-green-600 border-green-100 hover:bg-green-600 hover:text-white rounded-xl shadow-sm transition-all"
                                onClick={() => handleUpdateStatus(exp.id, 'approved')}
                              >
                                {isUpdatingId === exp.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8 text-red-600 border-red-100 hover:bg-red-600 hover:text-white rounded-xl shadow-sm transition-all"
                                onClick={() => handleUpdateStatus(exp.id, 'rejected')}
                              >
                                {isUpdatingId === exp.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />}
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1">
                               {exp.status === 'approved' ? (
                                 <Badge className="bg-green-600 text-white border-none font-black text-[9px] h-6 px-3 rounded-lg flex gap-1 items-center">
                                    <CheckCircle2 size={12} /> OK
                                 </Badge>
                               ) : (
                                 <Badge className="bg-red-600 text-white border-none font-black text-[9px] h-6 px-3 rounded-lg flex gap-1 items-center">
                                    <XCircle size={12} /> NO
                                 </Badge>
                               )}
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300" onClick={() => handleUpdateStatus(exp.id, 'registered')}><XCircle size={12}/></Button>
                            </div>
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
           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
             <CardHeader className="bg-slate-50/50 border-b py-4">
               <CardTitle className="text-xs font-black uppercase tracking-widest">Distribución de Costos</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 pt-6 text-center">
                <PieChart size={64} className="mx-auto text-blue-100 opacity-50" />
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Analítica de Reparto Mensual</p>
             </CardContent>
           </Card>

           <Card className="bg-blue-700 text-white border-none shadow-2xl rounded-[2rem] overflow-hidden">
             <CardHeader className="bg-white/5 border-b border-white/10 py-5 px-6">
               <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                 <CreditCard size={18} className="text-blue-300" /> Cierre Contable
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-5 pt-6 px-6 pb-8">
               <p className="text-[11px] font-bold opacity-80 leading-relaxed uppercase italic">La planilla final concilia los fondos entregados contra los comprobantes auditados físicamente.</p>
               <Button 
                variant="outline" 
                className="w-full bg-white text-blue-800 hover:bg-slate-50 border-none font-black text-xs uppercase h-14 rounded-2xl tracking-widest shadow-xl" 
                onClick={downloadPdf}
                disabled={isGeneratingPdf}
               >
                 {isGeneratingPdf ? <Loader2 className="animate-spin mr-2" /> : <Download size={18} className="mr-2" />} 
                 DESCARGAR RENDICIÓN PDF
               </Button>
             </CardContent>
           </Card>
        </div>
      </div>

      {/* DOCUMENTO NATIVO PARA PDF (DENSIDAD PROFESIONAL) */}
      <div className="fixed top-0 left-[-9999px] w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans border-[1px] border-slate-200" ref={reportRef}>
         <div className="border-[4px] border-double border-black p-8 flex flex-col min-h-full">
            {/* ENCABEZADO OFICIAL */}
            <div className="flex justify-between items-start border-b-[3px] border-black pb-6 mb-8">
               <div className="flex items-center gap-5">
                  {tenant?.settings?.logoUrl && (
                    <img src={tenant.settings.logoUrl} className="h-20 w-auto object-contain" alt="Logo" />
                  )}
                  <div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter text-blue-800 leading-none">{tenant?.name || 'LOGÍSTICA AR'}</h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Planilla de Rendición Contable de Gastos</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">CUIT: {tenant?.settings?.cuit || '30-XXXXXXXX-X'}</p>
                  </div>
               </div>
               <div className="text-right">
                  <div className="bg-black text-white px-4 py-1 text-[11px] font-black uppercase tracking-widest italic mb-2">AUDIT REPORT</div>
                  <p className="text-3xl font-mono font-black text-slate-900 tracking-tighter">OT: {load.orderNumber}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">EMISIÓN: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
               </div>
            </div>

            {/* SECCIÓN DATOS MAESTROS (DOS COLUMNAS) */}
            <div className="grid grid-cols-2 border-2 border-black mb-8 bg-slate-50/30">
               <div className="p-5 border-r-2 border-black space-y-2">
                  <div className="flex items-center gap-2 text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1"><User size={12}/> Personal de Conducción</div>
                  <p className="text-xl font-black uppercase italic leading-none">{driver ? `${driver.lastName}, ${driver.firstName}` : '---'}</p>
                  <p className="text-[10px] font-mono font-bold text-slate-500">DNI N° {driver?.dni || '---'}</p>
               </div>
               <div className="p-5 space-y-2">
                  <div className="flex items-center gap-2 text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1"><Truck size={12}/> Unidad de Transporte</div>
                  <p className="text-xl font-black uppercase italic leading-none">DOMINIO: {truck?.plate || '---'}</p>
                  <p className="text-[10px] font-bold text-slate-500">{truck?.brand} {truck?.model} ({(truck?.capacityKg || 0)/1000} TN)</p>
               </div>
            </div>

            {/* TABLA DE AUDITORÍA (MÁXIMA DENSIDAD) */}
            <table className="w-full border-2 border-black mb-8 text-left border-collapse">
               <thead>
                  <tr className="bg-slate-100 border-b-2 border-black">
                     <th className="p-3 text-[10px] font-black uppercase w-10 text-center">AUDIT.</th>
                     <th className="p-3 text-[10px] font-black uppercase w-24">FECHA</th>
                     <th className="p-3 text-[10px] font-black uppercase">CONCEPTO / DESCRIPCIÓN</th>
                     <th className="p-3 text-[10px] font-black uppercase">N° COMPROBANTE</th>
                     <th className="p-3 text-right text-[10px] font-black uppercase w-32">MONTO (ARS)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                  {expenses?.filter(e => e.status === 'approved').map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50">
                       <td className="p-3 text-center">
                          <div style={{ color: '#16a34a', fontSize: '18px', fontWeight: '900' }}>✓</div>
                       </td>
                       <td className="p-3 text-[10px] font-mono font-bold">{exp.createdAt?.toDate ? format(exp.createdAt.toDate(), "dd/MM/yy") : '---'}</td>
                       <td className="p-3">
                          <p className="text-[11px] font-black uppercase italic leading-none">{CATEGORY_LABELS[exp.category] || exp.category}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">UBICACIÓN: {exp.location}</p>
                       </td>
                       <td className="p-3 text-[10px] font-mono font-black text-blue-700 uppercase">{exp.receiptNumber || 'S/D'}</td>
                       <td className="p-3 text-right text-xs font-black">${exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
               </tbody>
               <tfoot>
                  <tr className="border-t-[3px] border-black bg-slate-50">
                     <td colSpan={4} className="p-4 text-right text-[10px] font-black uppercase italic">Suma de Comprobantes Auditados:</td>
                     <td className="p-4 text-right text-base font-black">${stats.approved.toLocaleString()}</td>
                  </tr>
                  <tr>
                     <td colSpan={4} className="p-2 text-right text-[10px] font-black uppercase text-slate-400">Fondos Iniciales (Anticipo de Ruta):</td>
                     <td className="p-2 text-right text-base font-black text-red-600">-${(load.budget?.initialAdvance || 0).toLocaleString()}</td>
                  </tr>
                  <tr className="border-t-2 border-black bg-blue-50/20">
                     <td colSpan={4} className="p-5 text-right text-xs font-black uppercase italic tracking-widest text-blue-900">Total Liquidación Final:</td>
                     <td className={cn("p-5 text-right text-2xl font-black italic tracking-tighter", balanceFinal >= 0 ? "text-red-700" : "text-green-700")}>
                        ${Math.abs(balanceFinal).toLocaleString()}
                     </td>
                  </tr>
               </tfoot>
            </table>

            {/* SECCIÓN DE FIRMAS LEGALES */}
            <div className="mt-auto pt-12 border-t-4 border-black flex justify-between items-end">
               <div className="text-center w-[40%] space-y-4">
                  <div className="h-20 border-b-2 border-black border-dashed"></div>
                  <p className="text-[9px] font-black uppercase tracking-widest">Firma y Aclaración Conductor</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase">Declaración jurada de gastos incurridos</p>
               </div>
               <div className="text-center w-[40%] space-y-4">
                  <div className="h-20 border-b-2 border-black flex items-center justify-center">
                     <div className="border-[3px] border-black px-6 py-2 rotate-[-5deg] text-xs font-black uppercase shadow-sm">AUDITADO OK</div>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest">Validación Administración Central</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase">Proceso de auditoría digital certificado</p>
               </div>
            </div>

            <div className="mt-8 text-center">
               <p className="text-[7px] font-bold text-slate-300 uppercase tracking-[0.5em]">LogísticaAr - Sistema de Gestión de Activos Inteligentes - Rendición N° {load.id.substring(0,8).toUpperCase()}</p>
            </div>
         </div>
      </div>
    </div>
  );
}