'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Plus, Search, MoreVertical, Trash2, Edit2, 
  Loader2, DollarSign, Calendar, Clock, Eye, Download, Printer, Archive
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Quotation, QuotationStatus, Tenant } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { generateQuotationPDF } from "@/lib/pdf-service";

export default function PresupuestosPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  
  // AlertDialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const quotesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "quotations"), orderBy("createdAt", "desc"));
  }, [db, tenantId]);

  const { data: quotes, loading } = useCollection<Quotation>(quotesQuery);

  const tenantRef = useMemo(() => (db && tenantId) ? doc(db, "tenants", tenantId) : null, [db, tenantId]);
  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    return quotes.filter(q => 
      (q.number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.clientName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [quotes, searchTerm]);

  const handleDownloadPDF = async (quote: Quotation) => {
    setIsDownloadingId(quote.id);
    try {
      await generateQuotationPDF(quote, tenant || undefined);
      toast({ title: "PDF Generado", description: `Se ha descargado la cotización ${quote.number}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!db || !tenantId || !deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "tenants", tenantId, "quotations", deleteId));
      toast({ title: "Presupuesto eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case 'draft': return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 uppercase text-[9px] font-black">Borrador</Badge>;
      case 'sent': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[9px] font-black">Enviado</Badge>;
      case 'accepted': return <Badge className="bg-green-600 text-white border-none uppercase text-[9px] font-black italic">Aceptado</Badge>;
      case 'rejected': return <Badge variant="destructive" className="uppercase text-[9px] font-black">Rechazado</Badge>;
      case 'expired': return <Badge variant="secondary" className="uppercase text-[9px] font-black">Vencido</Badge>;
      case 'ordered': return <Badge className="bg-emerald-900 text-white border-none uppercase text-[9px] font-black">Convertido</Badge>;
      default: return <Badge className="uppercase text-[9px] font-black">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Presupuestos de Venta</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión de cotizaciones comerciales y propuestas de flete.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-12 px-5 rounded-2xl font-black uppercase text-[11px] border-slate-200 bg-white" asChild>
            <Link href="/presupuestos/archivo">
              <Archive className="w-4 h-4 mr-2" /> Archivo
            </Link>
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-100 font-black italic uppercase text-[11px] h-12 px-6 rounded-2xl" asChild>
            <Link href="/presupuestos/nuevo">
              <Plus className="w-5 h-5 mr-2" /> Nueva Cotización
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por número o cliente..." 
              className="pl-10 h-10 bg-white border-none shadow-inner rounded-xl text-xs font-bold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-emerald-600 w-10 h-10" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Presupuesto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Emisión / Vence</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Total</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">
                      No hay presupuestos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => router.push(`/presupuestos/${quote.id}`)}>
                      <TableCell className="px-8 font-mono font-black text-blue-600 text-sm">{quote.number}</TableCell>
                      <TableCell>
                        <div className="font-black text-slate-900 uppercase italic text-xs leading-none">{quote.clientName}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1">{quote.clientCuit}</div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1"><Calendar size={10} className="text-slate-400" /> {quote.date}</span>
                            <span className="text-[10px] text-red-500 font-black flex items-center gap-1 uppercase">Vence: {quote.expiryDate}</span>
                         </div>
                      </TableCell>
                      <TableCell className="font-black text-slate-900 italic">${(quote.totalAmount || 0).toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell className="text-right pr-8" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100"><MoreVertical size={20} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 p-2">Gestión Comercial</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="cursor-pointer font-bold h-10 rounded-lg">
                              <Link href={`/presupuestos/${quote.id}`}><Eye className="w-4 h-4 mr-2" /> Ver Detalle</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="font-bold h-10 rounded-lg cursor-pointer text-blue-600 bg-blue-50"
                              onClick={() => handleDownloadPDF(quote)}
                              disabled={isDownloadingId === quote.id}
                            >
                              {isDownloadingId === quote.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />} 
                              Descargar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem 
                              className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-10 rounded-lg cursor-pointer" 
                              onSelect={(e) => { e.preventDefault(); setDeleteId(quote.id); }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-[2.5rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic tracking-tighter">¿Eliminar Presupuesto?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500">
              Esta acción es permanente y se perderá el historial de esta cotización.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-red-100"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              ELIMINAR DEFINITIVAMENTE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
