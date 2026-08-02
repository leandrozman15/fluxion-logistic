'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, addDoc, serverTimestamp, doc, setDoc, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, ArrowLeft, Save, Plus, Trash2, 
  Search, Package, Calculator, ShoppingCart,
  Loader2, CheckCircle2, ChevronRight, User, Receipt,
  DollarSign, Info
} from "lucide-react";
import { Client, Product, Quotation, QuotationItem } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { logSystemEvent } from "@/lib/audit-service";

export default function NewQuotationPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");

  const [formData, setFormData] = useState<Partial<Quotation>>({
    number: "",
    date: format(new Date(), "yyyy-MM-dd"),
    expiryDate: format(addDays(new Date(), 15), "yyyy-MM-dd"),
    clientId: "",
    clientName: "",
    clientCuit: "",
    items: [],
    subtotal: 0,
    taxTotal: 0,
    totalAmount: 0,
    status: 'draft',
    notes: ""
  });

  const [selectedProductId, setSelectedProductId] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [currentPrice, setCurrentPrice] = useState(0);

  const clientsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "clients"), orderBy("name")) : null, [db, tenantId]);
  const productsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "products"), orderBy("name")) : null, [db, tenantId]);

  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const selectedProduct = useMemo(() => products?.find(p => p.id === selectedProductId), [products, selectedProductId]);

  useEffect(() => {
    if (selectedProduct) {
      setCurrentPrice(selectedProduct.listPrice || 0);
    }
  }, [selectedProduct]);

  useEffect(() => {
    async function fetchNextNumber() {
      if (!db || !tenantId) return;
      const q = query(collection(db, "tenants", tenantId, "quotations"), orderBy("number", "desc"), limit(1));
      const snap = await getDocs(q);
      let next = 1;
      if (!snap.empty) {
        const lastNum = snap.docs[0].data().number;
        const lastSeqString = lastNum.split("-").pop();
        const lastSeq = parseInt(lastSeqString);
        if (!isNaN(lastSeq)) next = lastSeq + 1;
      }
      const num = `PRE-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
      setQuoteNumber(num);
      setFormData(prev => ({ ...prev, number: num }));
    }
    fetchNextNumber();
  }, [db, tenantId]);

  const calculateTotals = (items: QuotationItem[]) => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const taxTotal = items.reduce((acc, item) => acc + ((item.quantity * item.unitPrice) * (item.ivaRate / 100)), 0);
    return { subtotal, taxTotal, totalAmount: subtotal + taxTotal };
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    
    const newItem: QuotationItem = {
      productId: selectedProduct.id,
      sku: selectedProduct.sku,
      name: selectedProduct.name,
      quantity: currentQty,
      unitPrice: currentPrice,
      ivaRate: selectedProduct.ivaRate || 21,
      subtotal: currentQty * currentPrice,
      total: (currentQty * currentPrice) * (1 + (selectedProduct.ivaRate || 21) / 100)
    };

    const newItems = [...(formData.items || []), newItem];
    const totals = calculateTotals(newItems);

    setFormData(prev => ({ ...prev, items: newItems, ...totals }));
    setSelectedProductId("");
    setCurrentQty(1);
    setCurrentPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = (formData.items || []).filter((_, i) => i !== index);
    const totals = calculateTotals(newItems);
    setFormData(prev => ({ ...prev, items: newItems, ...totals }));
  };

  const handleClientSelect = (id: string) => {
    const client = clients?.find(c => c.id === id);
    if (client) {
      setFormData(prev => ({ ...prev, clientId: id, clientName: client.name, clientCuit: client.cuit }));
    }
  };

  const handleSave = async () => {
    if (!db || !tenantId || !formData.clientId || (formData.items || []).length === 0) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Seleccione un cliente y al menos un producto." });
      return;
    }

    setIsSubmitting(true);
    try {
      const newRef = doc(collection(db, "tenants", tenantId, "quotations"));
      await setDoc(newRef, {
        ...formData,
        id: newRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (user) await logSystemEvent(db, tenantId, user, 'create', 'quotation', newRef.id, { number: formData.number });
      
      toast({ title: "Presupuesto Generado", description: `La cotización ${formData.number} ha sido guardada.` });
      router.push('/presupuestos');
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18}/></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic">Nuevo Presupuesto</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Emisión de cotización comercial para clientes.</p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono h-10 px-6 text-blue-600 bg-blue-50 border-blue-100 font-black text-base">{quoteNumber || 'GENERANDO...'}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           {/* 1. DATOS DEL CLIENTE */}
           <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 text-white p-8">
                 <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-widest"><User size={18} className="text-blue-400" /> Identificación del Cliente</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Seleccionar Cliente</Label>
                    <Select value={formData.clientId} onValueChange={handleClientSelect}>
                       <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                          <SelectValue placeholder="Buscar cliente en cartera..." />
                       </SelectTrigger>
                       <SelectContent>
                          {clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.cuit})</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Emisión</Label>
                       <Input type="date" className="bg-slate-50 border-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Validez Hasta</Label>
                       <Input type="date" className="bg-slate-50 border-none" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* 2. ITEMS DEL PRESUPUESTO */}
           <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="border-b p-8 flex flex-row items-center justify-between">
                 <CardTitle className="text-sm font-black uppercase italic">Productos y Servicios</CardTitle>
                 <Badge className="bg-emerald-50 text-emerald-700 border-none font-black uppercase">{formData.items?.length || 0} CONCEPTOS</Badge>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="p-8 bg-blue-50/50 border-b space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                       <div className="md:col-span-6">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Agregar Producto</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                             <SelectTrigger className="bg-white border-blue-100"><SelectValue placeholder="Buscar en catálogo..." /></SelectTrigger>
                             <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       <div className="md:col-span-2">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Cantidad</Label>
                          <Input type="number" min="1" className="bg-white border-blue-100" value={currentQty} onChange={e => setCurrentQty(parseInt(e.target.value) || 1)} />
                       </div>
                       <div className="md:col-span-3">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Precio Unitario</Label>
                          <div className="relative">
                             <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-slate-300" />
                             <Input type="number" className="pl-7 bg-white border-blue-100" value={currentPrice} onChange={e => setCurrentPrice(parseFloat(e.target.value) || 0)} />
                          </div>
                       </div>
                       <div className="md:col-span-1 flex items-end">
                          <Button onClick={handleAddProduct} disabled={!selectedProductId} className="w-full bg-blue-600 h-10 rounded-xl"><Plus /></Button>
                       </div>
                    </div>
                 </div>

                 <Table>
                    <TableHeader className="bg-slate-50">
                       <TableRow>
                          <TableHead className="px-8 text-[10px] font-black uppercase">Concepto</TableHead>
                          <TableHead className="text-center text-[10px] font-black uppercase">Qty</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">P. Unit</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Subtotal</TableHead>
                          <TableHead className="w-10"></TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {formData.items?.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-300 italic uppercase text-[10px] font-bold">Inicie la carga de ítems arriba</TableCell></TableRow>
                       ) : (
                         formData.items?.map((item, i) => (
                           <TableRow key={i}>
                              <TableCell className="px-8"><p className="font-bold text-slate-700 uppercase text-xs">{item.name}</p><p className="text-[9px] text-slate-400 font-mono">{item.sku}</p></TableCell>
                              <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                              <TableCell className="text-right font-medium text-slate-500">${item.unitPrice.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-black text-slate-900">${(item.quantity * item.unitPrice).toLocaleString()}</TableCell>
                              <TableCell className="pr-8"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => handleRemoveItem(i)}><Trash2 size={14}/></Button></TableCell>
                           </TableRow>
                         ))
                       )}
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>

           <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-slate-100/50 p-6"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notas y Observaciones del Presupuesto</CardTitle></CardHeader>
              <CardContent className="p-6">
                 <Textarea placeholder="Ej: Precios sujetos a cambio sin previo aviso, Tiempo de entrega 72hs, etc." className="min-h-[100px] bg-slate-50 border-none rounded-2xl" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden sticky top-24">
              <CardHeader className="p-8 pb-6 border-b border-white/5">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                    <Calculator size={18} /> Liquidación Final
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-widest">
                       <span>Subtotal Neto</span>
                       <span className="text-base text-white font-black italic">${(formData.subtotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-widest">
                       <span>Impuestos (IVA Tot.)</span>
                       <span className="text-base text-white font-black italic">${(formData.taxTotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                       <span className="text-xs font-black text-emerald-400 uppercase italic">TOTAL GENERAL</span>
                       <span className="text-4xl font-black italic tracking-tighter text-emerald-400">${(formData.totalAmount || 0).toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="pt-8 space-y-4">
                    <Button onClick={handleSave} disabled={isSubmitting || (formData.items?.length || 0) === 0} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-3xl shadow-2xl transition-all active:scale-95">
                       {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                       GUARDAR COTIZACIÓN
                    </Button>
                    <p className="text-[9px] text-center text-white/30 font-bold uppercase tracking-widest italic">
                       Al guardar, el documento quedará disponible para envío inmediato por email.
                    </p>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex items-start gap-4">
              <Info size={24} className="text-blue-600 shrink-0 mt-1" />
              <div className="space-y-1">
                 <p className="text-xs font-black text-blue-800 uppercase italic">Validez Comercial</p>
                 <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                   Las cotizaciones tienen un periodo de validez por defecto de 15 días. Puede ajustar esta fecha según la volatilidad de los precios.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
