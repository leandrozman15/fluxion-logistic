'use client';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, ArrowLeft, Loader2, Download, 
  CheckCircle2, XCircle, Send,
  User, Calendar, DollarSign, Calculator, Package,
  Truck, Briefcase, Landmark, MapPin, Receipt
} from "lucide-react";
import { Quotation, QuotationStatus, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateQuotationPDF } from "@/lib/pdf-service";
import { getQuotationById, updateQuotation } from "@/lib/quotations-api";

const statusConfig: Record<QuotationStatus, { label: string, color: string }> = {
  draft: { label: 'Borrador', color: 'bg-slate-500' },
  sent: { label: 'Enviado', color: 'bg-blue-600' },
  viewed: { label: 'Visto por Cliente', color: 'bg-indigo-600' },
  accepted: { label: 'Aceptado OK', color: 'bg-green-600' },
  rejected: { label: 'Rechazado', color: 'bg-red-600' },
  expired: { label: 'Vencido', color: 'bg-orange-600' },
  ordered: { label: 'Convertido en Pedido', color: 'bg-emerald-900' }
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const quoteId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadQuote() {
      if (!quoteId || !tenantId) {
        if (active) {
          setQuote(null);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const payload = await getQuotationById(quoteId);
        if (active) setQuote(payload);
      } catch (error) {
        if (active) {
          toast({ variant: 'destructive', title: 'Error al cargar presupuesto', description: (error as Error).message });
          setQuote(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQuote();
    return () => {
      active = false;
    };
  }, [quoteId, tenantId, toast]);

  const tenantRef = useMemo(() => (db && tenantId) ? doc(db, "tenants", tenantId) : null, [db, tenantId]);
  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const handleUpdateStatus = async (newStatus: QuotationStatus) => {
    if (!quoteId) return;
    setIsUpdating(true);
    try {
      const updated = await updateQuotation(quoteId, { status: newStatus });
      setQuote(updated);
      toast({ title: `Estado actualizado: ${newStatus.toUpperCase()}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar", description: (e as Error).message });
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
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
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
             {isDownloading ? <Loader2 className="animate-spin mr-2" /> : <Download size={14} className="mr-2" />} DESCARGAR PDF A4
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
                     <p className="text-[10px] font-bold text-white/40 uppercase">CUIT: {quote.clientCuit} • {quote.ivaCondition}</p>
                  </div>
                  <Badge className={cn("text-white border-none px-4 h-6 font-black text-[9px] uppercase", statusConfig[quote.status].color)}>
                     {statusConfig[quote.status].label}
                  </Badge>
               </div>
            </CardHeader>
            
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-b bg-slate-50/50">
               <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">Ejecutivo Cta.</p>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Briefcase size={12} className="text-blue-500" /> {quote.sellerName || 'Administración'}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">Validez Propuesta</p>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Calendar size={12} className="text-blue-500" /> Hasta {quote.expiryDate}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">Moneda / Camb.</p>
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Landmark size={12} className="text-blue-500" /> {quote.currency} (1 = ${(quote.exchangeRate || 1).toLocaleString()})</p>
               </div>
            </CardContent>

            <CardContent className="p-0">
               <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-white border-b">
                        <TableRow>
                          <TableHead className="px-8 text-[10px] font-black uppercase">Ítem / SKU</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase">Cant.</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Unitario</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Desc.</TableHead>
                          <TableHead className="text-right pr-8 text-[10px] font-black uppercase">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quote.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-50 border rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                      {item.photoUrl ? <img src={item.photoUrl} className="w-full h-full object-cover" /> : <Package size={16} className="text-slate-300" />}
                                  </div>
                                  <div>
                                      <div className="font-bold text-xs uppercase text-slate-700">{item.name}</div>
                                      <div className="text-[9px] text-slate-400 font-mono font-bold uppercase">{item.sku}</div>
                                  </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-black text-slate-700">{item.quantity} <span className="text-[8px] font-normal opacity-50 uppercase">{item.unit}</span></TableCell>
                            <TableCell className="text-right text-xs font-medium text-slate-500">${(item.unitPrice || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-[10px] font-bold text-red-500">-{item.discountPercent}%</TableCell>
                            <TableCell className="text-right pr-8 font-black text-slate-900">${(item.subtotal || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                </Table>
               </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-md rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 py-4 border-b flex flex-row items-center gap-2">
                    <Truck size={16} className="text-blue-600" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Información Logística</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">Tipo Entrega:</span>
                        <span className="font-black text-slate-700 uppercase italic">{quote.deliveryType}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">Transporte:</span>
                        <span className="font-black text-slate-700 uppercase italic">{quote.includeTransport ? 'INCLUIDO EN PRECIO' : 'NO INCLUIDO'}</span>
                    </div>
                    <div className="pt-2 border-t mt-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dirección de Destino:</p>
                        <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5"><MapPin size={12}/> {quote.deliveryAddress}</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 py-4 border-b flex flex-row items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Condiciones de Venta</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">Forma de Pago:</span>
                        <span className="font-black text-slate-700 uppercase">{quote.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">Tiempo Entrega:</span>
                        <span className="font-black text-slate-700 uppercase">{quote.deliveryTimeDays} Días</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase">Garantía:</span>
                        <span className="font-black text-slate-700 uppercase">{quote.warrantyInfo}</span>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden">
              <CardHeader className="border-b border-white/5 p-8">
                 <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-emerald-400"><Calculator size={18}/> Liquidación Comercial</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                 <div className="flex justify-between text-xs opacity-60 uppercase font-bold"><span>Suma Netos</span><span>${(quote.subtotal || 0).toLocaleString()}</span></div>
                 <div className="flex justify-between text-xs text-red-400 uppercase font-black"><span>(-) Descuento Gral.</span><span>-${(quote.commercialDiscount || 0).toLocaleString()}</span></div>
                 <div className="flex justify-between text-xs text-blue-400 uppercase font-black"><span>(+) Recargo Logístico</span><span>+${(quote.logisticSurcharge || 0).toLocaleString()}</span></div>
                 <div className="flex justify-between text-xs opacity-60 uppercase font-bold"><span>IVA Gravado</span><span>${(quote.taxTotal || 0).toLocaleString()}</span></div>
                 <div className="pt-6 border-t border-white/10 flex flex-col items-center gap-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em]">VALOR FINAL DE OPERACIÓN</p>
                    <p className="text-5xl font-black italic tracking-tighter text-emerald-400 leading-none">
                       {quote.currency === 'ARS' ? '$' : quote.currency + ' '} {(quote.totalAmount || 0).toLocaleString()}
                    </p>
                    {quote.currency !== 'ARS' && (
                        <p className="text-[9px] font-bold text-white/30 uppercase mt-2">Ref: ARS ${((quote.totalAmount || 0) * (quote.exchangeRate || 1)).toLocaleString()}</p>
                    )}
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b py-4"><CardTitle className="text-xs font-black uppercase text-slate-400">Control de Ciclo Administrativo</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-3">
                 {quote.status === 'draft' && (
                    <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase rounded-xl" onClick={() => handleUpdateStatus('sent')} disabled={isUpdating}>
                        <Send size={16} className="mr-2" /> ENVIAR PRESUPUESTO
                    </Button>
                 )}
                 {quote.status !== 'accepted' && quote.status !== 'ordered' && (
                   <Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase rounded-xl" onClick={() => handleUpdateStatus('accepted')} disabled={isUpdating}>
                      <CheckCircle2 size={16} className="mr-2" /> MARCAR COMO ACEPTADO
                   </Button>
                 )}
                 {quote.status === 'accepted' && (
                    <Button className="w-full h-12 bg-emerald-900 hover:bg-black text-white font-black text-[10px] uppercase rounded-xl" onClick={() => handleUpdateStatus('ordered')} disabled={isUpdating}>
                        <Receipt size={16} className="mr-2" /> CONVERTIR EN PEDIDO
                    </Button>
                 )}
                 {quote.status !== 'rejected' && quote.status !== 'ordered' && (
                   <Button variant="outline" className="w-full h-12 border-red-100 text-red-600 bg-red-50 hover:bg-red-100 font-black text-[10px] uppercase rounded-xl" onClick={() => handleUpdateStatus('rejected')} disabled={isUpdating}>
                      <XCircle size={16} className="mr-2" /> ANULAR PROPUESTA
                   </Button>
                 )}
                 <p className="text-[8px] text-center text-slate-300 font-bold uppercase mt-4">ID Transacción: {quote.id}</p>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
