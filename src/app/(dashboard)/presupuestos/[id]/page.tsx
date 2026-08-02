
'use client';

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, ArrowLeft, Loader2, Download, 
  CheckCircle2, XCircle, Send, Printer,
  User, Calendar, Clock, DollarSign, Calculator, Info
} from "lucide-react";
import { Quotation, QuotationStatus, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateQuotationPDF } from "@/lib/pdf-service";

export default function QuotationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const quoteRef = useMemo(() => (db && tenantId && id) ? doc(db, "tenants", tenantId, "quotations", id as string) : null, [db, tenantId, id]);
  const { data: quote, loading } = useDoc<Quotation>(quoteRef);

  const tenantRef = useMemo(() => (db && tenantId) ? doc(db, "tenants", tenantId) : null, [db, tenantId]);
  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const handleUpdateStatus = async (newStatus: QuotationStatus) => {
    if (!quoteRef) return;
    setIsUpdating(true);
    try {
      await updateDoc(quoteRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: `Estado actualizado: ${newStatus.toUpperCase()}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownload = async () => {
    if (!quote) return;
    setIsDownloading(true);
    try {
      await generateQuotationPDF(quote, tenant || undefined);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>;
  if (!quote) return <div className="p-20 text-center">Presupuesto no encontrado.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Detalle de Cotización</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Revisión y acciones comerciales para {quote.number}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="font-bold text-[10px] uppercase rounded-xl border-slate-200" onClick={handleDownload} disabled={isDownloading}>
             {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Download size={14} className="mr-2" />} BAJAR PDF
           </Button>
           <Button className="bg-blue-600 h-10 px-6 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-100">
             <Send size={14} className="mr-2" /> ENVIAR POR EMAIL
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
               <div className="flex justify-between items-center">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Información del Cliente</p>
                     <CardTitle className="text-2xl font-black uppercase italic tracking-tighter leading-none">{quote.clientName}</CardTitle>
                  </div>
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 border border-white/5 shadow-2xl">
                     <User size={32} />
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-2 gap-8 border-b">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">CUIT / ID Tributario</p>
                  <p className="text-lg font-mono font-black text-slate-800 tracking-tighter">{quote.clientCuit}</p>
               </div>
               <div className="space-y-1 text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado Propuesta</p>
                  <div className="flex justify-end gap-2 mt-1">
                    {quote.status === 'draft' && <Badge className="bg-slate-500">BORRADOR</Badge>}
                    {quote.status === 'sent' && <Badge className="bg-blue-600 animate-pulse">ENVIADO</Badge>}
                    {quote.status === 'accepted' && <Badge className="bg-green-600">ACEPTADO OK</Badge>}
                    {quote.status === 'rejected' && <Badge variant="destructive">RECHAZADO</Badge>}
                  </div>
               </div>
            </CardContent>
            <CardContent className="p-0">
               <Table>
                  <TableHeader className="bg-slate-50">
                     <TableRow>
                        <TableHead className="px-8 text-[10px] font-black uppercase">Ítem / SKU</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase">Cant.</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">P. Unit</TableHead>
                        <TableHead className="text-right pr-8 text-[10px] font-black uppercase">Total</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {quote.items.map((item, i) => (
                       <TableRow key={i}>
                          <TableCell className="px-8 py-4">
                             <div className="font-bold text-xs uppercase">{item.name}</div>
                             <div className="text-[9px] text-slate-400 font-mono">{item.sku}</div>
                          </TableCell>
                          <TableCell className="text-center font-black text-slate-700">{item.quantity}</TableCell>
                          <TableCell className="text-right text-xs font-medium text-slate-500">${item.unitPrice.toLocaleString()}</TableCell>
                          <TableCell className="text-right pr-8 font-black text-slate-900">${(item.quantity * item.unitPrice).toLocaleString()}</TableCell>
                       </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md rounded-[2rem] overflow-hidden bg-white">
             <CardHeader className="bg-slate-50 py-3 border-b"><CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Condiciones Comerciales</CardTitle></CardHeader>
             <CardContent className="p-6">
                <p className="text-xs italic text-slate-600 leading-relaxed font-medium">
                   {quote.notes || 'No se han especificado cláusulas particulares para este presupuesto.'}
                </p>
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
              <CardHeader className="border-b border-white/5 p-8"><CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-emerald-400"><Calculator size={18}/> Resumen Financiero</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-5">
                 <div className="flex justify-between text-xs opacity-60"><span>Subtotal Neto</span><span>${quote.subtotal.toLocaleString()}</span></div>
                 <div className="flex justify-between text-xs opacity-60"><span>Impuestos (IVA)</span><span>${quote.taxTotal.toLocaleString()}</span></div>
                 <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">VALOR FINAL COTIZADO</p>
                    <p className="text-4xl font-black italic tracking-tighter text-emerald-400">${quote.totalAmount.toLocaleString()}</p>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b py-4"><CardTitle className="text-xs uppercase font-black text-slate-400">Control de Ciclo</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-3">
                 {quote.status !== 'accepted' && (
                   <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase rounded-xl" onClick={() => handleUpdateStatus('accepted')} disabled={isUpdating}>
                      <CheckCircle2 size={16} className="mr-2" /> MARCAR COMO ACEPTADO
                   </Button>
                 )}
                 {quote.status !== 'rejected' && (
                   <Button variant="outline" className="w-full h-12 border-red-100 text-red-600 bg-red-50 hover:bg-red-100 font-black text-[10px] uppercase rounded-xl" onClick={() => handleUpdateStatus('rejected')} disabled={isUpdating}>
                      <XCircle size={16} className="mr-2" /> RECHAZAR PROPUESTA
                   </Button>
                 )}
                 <p className="text-[9px] text-center text-slate-400 font-bold uppercase mt-4">Actualizado: {new Date(quote.updatedAt?.seconds * 1000).toLocaleString()}</p>
              </CardContent>
           </Card>

           <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex items-start gap-4">
              <Info size={24} className="text-blue-600 shrink-0 mt-1" />
              <div className="space-y-1">
                 <p className="text-xs font-black text-blue-800 uppercase italic">Trazabilidad Técnica</p>
                 <p className="text-[10px] text-blue-600 leading-relaxed font-medium">Al aceptar el presupuesto, el sistema podrá vincular estos ítems a una nueva Hoja de Ruta automáticamente.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
