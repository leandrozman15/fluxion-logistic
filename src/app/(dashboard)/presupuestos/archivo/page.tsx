'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Archive, Calendar, Download, Eye, Loader2, RotateCcw, Search } from "lucide-react";
import { Quotation, QuotationStatus, Tenant } from "@/app/lib/types";

import { useToast } from "@/hooks/use-toast";
import { listQuotations, updateQuotation } from "@/lib/quotations-api";
import { getTenantProfile } from "@/lib/settings-api";

const ARCHIVE_STATUSES: QuotationStatus[] = ['accepted', 'rejected', 'expired', 'ordered'];

function getArchiveBadge(status: QuotationStatus) {
  switch (status) {
    case 'accepted':
      return <Badge className="bg-emerald-600 text-white border-none uppercase text-[9px] font-black">Aceptado</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="uppercase text-[9px] font-black">Rechazado</Badge>;
    case 'expired':
      return <Badge variant="secondary" className="uppercase text-[9px] font-black">Vencido</Badge>;
    case 'ordered':
      return <Badge className="bg-slate-900 text-white border-none uppercase text-[9px] font-black">Convertido</Badge>;
    default:
      return <Badge variant="outline" className="uppercase text-[9px] font-black">{status}</Badge>;
  }
}

export default function PresupuestosArchivoPage() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [isReopeningId, setIsReopeningId] = useState<string | null>(null);
  const [tenantProfile, setTenantProfile] = useState<Tenant | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQuotes() {
      if (!tenantId) {
        if (active) {
          setQuotes([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const result = await listQuotations({ page: 1, pageSize: 300 });
        if (active) setQuotes(result.data);
      } catch (error) {
        if (active) {
          toast({ variant: 'destructive', title: 'Error al cargar archivo', description: (error as Error).message });
          setQuotes([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQuotes();
    getTenantProfile().then((profile) => { if (active) setTenantProfile(profile as unknown as Tenant); }).catch(() => {});
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const archivedQuotes = useMemo(() => {
    if (!quotes) return [];
    const search = searchTerm.toLowerCase();

    return quotes.filter((quote) => {
      if (!ARCHIVE_STATUSES.includes(quote.status)) return false;

      return (
        (quote.number || '').toLowerCase().includes(search) ||
        (quote.clientName || '').toLowerCase().includes(search) ||
        (quote.clientCuit || '').toLowerCase().includes(search)
      );
    });
  }, [quotes, searchTerm]);

  const handleDownloadPDF = async (quote: Quotation) => {
    setIsDownloadingId(quote.id);
    try {
      const { generateQuotationPDF } = await import("@/lib/pdf-service");
      await generateQuotationPDF(quote, tenantProfile || undefined);
      toast({ title: 'PDF Generado', description: `Se ha descargado la cotización ${quote.number}.` });
    } catch {
      toast({ variant: 'destructive', title: 'Error al generar PDF' });
    } finally {
      setIsDownloadingId(null);
    }
  };

  const handleReopenQuote = async (quote: Quotation) => {
    if (!tenantId) return;

    setIsReopeningId(quote.id);
    try {
      const updated = await updateQuotation(quote.id, {
        status: 'draft',
      });
      setQuotes((prev) => prev.map((row) => (row.id === quote.id ? updated : row)));

      toast({ title: 'Presupuesto reabierto', description: `${quote.number} volvió a Borrador.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al reabrir presupuesto', description: (error as Error).message });
    } finally {
      setIsReopeningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Archivo de Presupuestos</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Historial de cotizaciones cerradas y convertidas.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 h-5 w-5 text-white/30" />
            <Input
              type="search"
              placeholder="Buscar por número, cliente o CUIT..."
              className="bg-white/10 border-white/20 text-white pl-12 h-12 text-sm font-bold rounded-2xl focus:bg-white/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Archive className="text-emerald-300" />
            <span className="text-sm font-black uppercase italic">{archivedQuotes.length} Presupuestos Cerrados</span>
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center">
              <Loader2 className="animate-spin text-emerald-600 w-10 h-10" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">N° Presupuesto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Emisión / Vence</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Total</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado de Cierre</TableHead>
                  <TableHead className="pr-8 text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32 text-slate-400 italic font-bold uppercase text-xs">
                      No hay presupuestos archivados.
                    </TableCell>
                  </TableRow>
                ) : (
                  archivedQuotes.map((quote) => (
                    <TableRow key={quote.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-8 font-mono font-black text-blue-600 text-sm">{quote.number}</TableCell>
                      <TableCell>
                        <div className="font-black text-slate-900 uppercase italic text-xs leading-none">{quote.clientName}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1">{quote.clientCuit}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" /> {quote.date}
                          </span>
                          <span className="text-[10px] text-red-500 font-black uppercase">Vence: {quote.expiryDate}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-slate-900 italic">${(quote.totalAmount || 0).toLocaleString()}</TableCell>
                      <TableCell>{getArchiveBadge(quote.status)}</TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:bg-blue-50" asChild>
                            <Link href={`/presupuestos/${quote.id}`}>
                              <Eye size={18} />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleDownloadPDF(quote)}
                            disabled={isDownloadingId === quote.id}
                          >
                            {isDownloadingId === quote.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download size={18} />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-orange-600 hover:bg-orange-50"
                            onClick={() => handleReopenQuote(quote)}
                            disabled={isReopeningId === quote.id}
                          >
                            {isReopeningId === quote.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw size={18} />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
