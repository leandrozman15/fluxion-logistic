
'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Plus, Search, MoreVertical, Trash2, Edit2, 
  Loader2, DollarSign, Calendar, Clock, Eye, Download, Printer
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
import { Quotation, QuotationStatus } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function PresupuestosPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  // AlertDialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const quotesQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "quotations"), orderBy("createdAt", "desc"));
  }, [db, tenantId]);

  const { data: quotes, loading } = useCollection<Quotation>(quotesQuery);

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    return quotes.filter(q => 
      (q.number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.clientName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [quotes, searchTerm]);

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
      case 'draft': return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Borrador</Badge>;
      case 'sent': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Enviado</Badge>;
      case 'accepted': return <Badge className="bg-green-600 text-white border-none">Aceptado</Badge>;
      case 'rejected': return <Badge variant="destructive">Rechazado</Badge>;
      case 'expired': return <Badge variant="secondary">Vencido</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-emerald-600" /> Presupuestos de Venta
          </h1>
          <p className="text-slate-500 text-sm">Gestión de cotizaciones comerciales y propuestas de flete.</p>
        </div>
        
        <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100" asChild>
          <Link href="/presupuestos/nuevo">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Presupuesto
          </Link>
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por número o cliente..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-emerald-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>N° Presupuesto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Emisión / Vence</TableHead>
                  <TableHead>Total (ARS)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">
                      No hay presupuestos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((quote) => (
                    <TableRow key={quote.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono font-bold text-blue-600">{quote.number}</TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 uppercase text-xs">{quote.clientName}</div>
                        <div className="text-[10px] text-slate-400">{quote.clientCuit}</div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium flex items-center gap-1"><Calendar size={10} className="text-slate-400" /> {quote.date}</span>
                            <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><Clock size={10} /> Exp: {quote.expiryDate}</span>
                         </div>
                      </TableCell>
                      <TableCell className="font-black text-slate-800">${quote.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><MoreVertical size={18} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-none shadow-2xl">
                            <DropdownMenuItem asChild className="cursor-pointer font-bold h-10 rounded-lg">
                              <Link href={`/presupuestos/${quote.id}`}><Eye className="w-4 h-4 mr-2" /> Ver Detalle</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="font-bold h-10 rounded-lg cursor-pointer">
                              <Download className="w-4 h-4 mr-2" /> Bajar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-10 rounded-lg cursor-pointer" 
                              onSelect={() => setDeleteId(quote.id)}
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
        <AlertDialogContent className="rounded-[2rem]">
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
              CONFIRMAR ELIMINACIÓN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
