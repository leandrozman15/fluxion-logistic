
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
import { Switch } from "@/components/ui/switch";
import { 
  FileText, ArrowLeft, Save, Plus, Trash2, 
  Search, Package, Calculator, ShoppingCart,
  Loader2, CheckCircle2, ChevronRight, User, Receipt,
  DollarSign, Info, Building2, Briefcase, Globe, Landmark,
  Truck, ShieldCheck, MapPin, ScanBarcode, Percent, Boxes
} from "lucide-react";
import { Client, Product, Quotation, QuotationItem, Hub, AppUser } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { logSystemEvent } from "@/lib/audit-service";
import { cn } from "@/lib/utils";

const CURRENCIES = [
  { id: 'ARS', label: 'Pesos Argentinos ($)', symbol: '$' },
  { id: 'USD', label: 'Dólares (US$)', symbol: 'US$' },
  { id: 'BRL', label: 'Reales (R$)', symbol: 'R$' }
];

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
    ivaCondition: "IVA Responsable Inscripto",
    branchId: "",
    sellerId: user?.uid || "",
    currency: 'ARS',
    exchangeRate: 1,
    items: [],
    subtotal: 0,
    commercialDiscount: 0,
    logisticSurcharge: 0,
    taxTotal: 0,
    totalAmount: 0,
    status: 'draft',
    includeTransport: false,
    transportPaidBy: 'company',
    freightValue: 0,
    deliveryType: "Puerta a Puerta",
    deliveryAddress: "",
    paymentMethod: "Transferencia Bancaria",
    paymentTerm: "Contado",
    deliveryTimeDays: 7,
    warrantyInfo: "6 meses de garantía técnica",
    notes: "",
    internalNotes: ""
  });

  const [selectedProductId, setSelectedProductId] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentDiscount, setCurrentDiscount] = useState(0);
  const [barcodeSearch, setBarcodeSearch] = useState("");

  const clientsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "clients"), orderBy("name")) : null, [db, tenantId]);
  const productsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "products"), orderBy("name")) : null, [db, tenantId]);
  const hubsQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "hubs"), orderBy("name")) : null, [db, tenantId]);
  const sellersQuery = useMemo(() => (db && tenantId) ? query(collection(db, "tenants", tenantId, "users"), orderBy("role")) : null, [db, tenantId]);

  const { data: clients } = useCollection<Client>(clientsQuery);
  const { data: products } = useCollection<Product>(productsQuery);
  const { data: hubs } = useCollection<Hub>(hubsQuery);
  const { data: sellers } = useCollection<AppUser>(sellersQuery);

  const selectedProduct = useMemo(() => {
    if (barcodeSearch) {
       return products?.find(p => p.sku === barcodeSearch || p.gtin === barcodeSearch) || null;
    }
    return products?.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId, barcodeSearch]);

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
        const lastSeq = parseInt(lastSeqString!);
        if (!isNaN(lastSeq)) next = lastSeq + 1;
      }
      const num = `PRE-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
      setQuoteNumber(num);
      setFormData(prev => ({ ...prev, number: num }));
    }
    fetchNextNumber();
  }, [db, tenantId]);

  const calculateTotals = (items: QuotationItem[], freight: number = 0, gDiscount: number = 0) => {
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice * (1 - item.discountPercent/100)), 0);
    const logisticSurcharge = freight;
    const commercialDiscount = gDiscount;
    const taxableBase = subtotal + logisticSurcharge - commercialDiscount;
    
    // Simplificación de IVA para el MVP (promediado o por ítem)
    const taxTotal = items.reduce((acc, item) => {
        const itemNet = (item.quantity * item.unitPrice * (1 - item.discountPercent/100));
        return acc + (itemNet * (item.ivaRate / 100));
    }, 0);

    return { 
        subtotal, 
        logisticSurcharge, 
        commercialDiscount, 
        taxTotal, 
        totalAmount: taxableBase + taxTotal 
    };
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    
    const newItem: QuotationItem = {
      productId: selectedProduct.id,
      sku: selectedProduct.sku,
      name: selectedProduct.name,
      quantity: currentQty,
      unit: selectedProduct.unitType || "un",
      unitPrice: currentPrice,
      discountPercent: currentDiscount,
      ivaRate: selectedProduct.ivaRate || 21,
      subtotal: currentQty * currentPrice * (1 - currentDiscount/100),
      total: (currentQty * currentPrice * (1 - currentDiscount/100)) * (1 + (selectedProduct.ivaRate || 21) / 100),
      photoUrl: selectedProduct.photoUrl || ""
    };

    const newItems = [...(formData.items || []), newItem];
    const totals = calculateTotals(newItems, formData.freightValue, formData.commercialDiscount);

    setFormData(prev => ({ ...prev, items: newItems, ...totals }));
    setSelectedProductId("");
    setBarcodeSearch("");
    setCurrentQty(1);
    setCurrentPrice(0);
    setCurrentDiscount(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = (formData.items || []).filter((_, i) => i !== index);
    const totals = calculateTotals(newItems, formData.freightValue, formData.commercialDiscount);
    setFormData(prev => ({ ...prev, items: newItems, ...totals }));
  };

  const handleClientSelect = (id: string) => {
    const client = clients?.find(c => c.id === id);
    if (client) {
      setFormData(prev => ({ 
        ...prev, 
        clientId: id, 
        clientName: client.name, 
        clientCuit: client.cuit,
        deliveryAddress: `${client.address.street} ${client.address.number}, ${client.address.city}`
      }));
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
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18}/></Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Nueva Cotización ERP</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Módulo comercial integrado v3.0</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="font-mono h-12 px-6 text-blue-600 bg-white border-blue-100 font-black text-lg shadow-sm">{quoteNumber || 'GENERANDO...'}</Badge>
           <Button onClick={handleSave} disabled={isSubmitting || (formData.items?.length || 0) === 0} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 font-black rounded-2xl shadow-xl transition-all">
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR PRESUPUESTO
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
           {/* 1. ENCABEZADO Y CLIENTE */}
           <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 text-white p-8">
                 <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-widest"><Building2 size={18} className="text-blue-400" /> Identificación de Operación</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Seleccionar Cliente</Label>
                           <Select value={formData.clientId} onValueChange={handleClientSelect}>
                              <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold"><SelectValue placeholder="Buscar cliente..." /></SelectTrigger>
                              <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.cuit})</SelectItem>)}</SelectContent>
                           </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">CUIT (Lectura)</Label><Input readOnly className="bg-slate-100 border-none font-mono text-xs" value={formData.clientCuit} /></div>
                           <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cond. IVA</Label><Input readOnly className="bg-slate-100 border-none text-[9px] font-bold uppercase" value={formData.ivaCondition} /></div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Emisión</Label><Input type="date" className="h-11 bg-slate-50 border-none rounded-xl" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                           <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vencimiento</Label><Input type="date" className="h-11 bg-slate-50 border-none rounded-xl text-red-600 font-bold" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} /></div>
                        </div>
                        <div className="space-y-1.5">
                           <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sucursal / Depósito Emisor</Label>
                           <Select value={formData.branchId} onValueChange={v => setFormData({...formData, branchId: v})}>
                              <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl"><SelectValue placeholder="Sede Salida" /></SelectTrigger>
                              <SelectContent>{hubs?.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                           </Select>
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ejecutivo Comercial</Label>
                       <Select value={formData.sellerId} onValueChange={v => setFormData({...formData, sellerId: v, sellerName: sellers?.find(s => s.uid === v)?.displayName})}>
                          <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                          <SelectContent>{sellers?.map(s => <SelectItem key={s.uid} value={s.uid}>{s.displayName || s.email}</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Moneda</Label>
                       <Select value={formData.currency} onValueChange={(v: any) => setFormData({...formData, currency: v})}>
                          <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo de Cambio</Label>
                       <div className="relative">
                          <Landmark className="absolute left-3 top-3 h-4 w-4 text-slate-300" />
                          <Input type="number" className="h-11 bg-slate-50 border-none rounded-xl font-bold pl-10" value={formData.exchangeRate} onChange={e => setFormData({...formData, exchangeRate: parseFloat(e.target.value) || 1})} />
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>

           {/* 2. GRILLA DE PRODUCTOS */}
           <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="border-b p-8 flex flex-row items-center justify-between">
                 <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-black uppercase italic">Catálogo de Artículos</CardTitle>
                    <Badge className="bg-blue-600 text-white border-none font-black text-[10px]">{formData.items?.length || 0} LÍNEAS</Badge>
                 </div>
                 <div className="relative w-64">
                    <ScanBarcode className="absolute left-3 top-2.5 h-4 w-4 text-blue-500" />
                    <Input 
                      placeholder="Escanear Código..." 
                      className="pl-9 h-9 text-[10px] font-black border-blue-100 rounded-xl" 
                      value={barcodeSearch}
                      onChange={e => setBarcodeSearch(e.target.value)}
                    />
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="p-8 bg-blue-50/50 border-b space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                       <div className="md:col-span-4">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Producto / Art.</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                             <SelectTrigger className="bg-white border-blue-100 h-10"><SelectValue placeholder="Elegir ítem..." /></SelectTrigger>
                             <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       <div className="md:col-span-2">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Cantidad</Label>
                          <Input type="number" min="1" className="bg-white border-blue-100 h-10 font-bold" value={currentQty} onChange={e => setCurrentQty(parseInt(e.target.value) || 1)} />
                       </div>
                       <div className="md:col-span-2">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">P. Unit ({formData.currency})</Label>
                          <div className="relative">
                             <DollarSign className="absolute left-2 top-3 h-3 w-3 text-slate-300" />
                             <Input type="number" className="pl-6 bg-white border-blue-100 h-10 font-bold" value={currentPrice} onChange={e => setCurrentPrice(parseFloat(e.target.value) || 0)} />
                          </div>
                       </div>
                       <div className="md:col-span-2">
                          <Label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Desc. %</Label>
                          <div className="relative">
                             <Percent className="absolute left-2 top-3 h-3 w-3 text-slate-300" />
                             <Input type="number" max="100" className="pl-6 bg-white border-blue-100 h-10 font-bold text-red-600" value={currentDiscount} onChange={e => setCurrentDiscount(parseFloat(e.target.value) || 0)} />
                          </div>
                       </div>
                       <div className="md:col-span-2">
                          <Button onClick={handleAddProduct} disabled={!selectedProduct} className="w-full bg-blue-600 hover:bg-blue-700 h-10 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-100">
                             <Plus className="mr-2" size={16} /> AGREGAR
                          </Button>
                       </div>
                    </div>
                    {selectedProduct && (
                       <div className="flex items-center gap-4 px-1 py-1 animate-in fade-in">
                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400">
                             <Boxes size={12}/> Stock Disponible: <span className={cn(selectedProduct.stockQuantity <= 0 ? "text-red-500" : "text-green-600")}>{selectedProduct.stockQuantity} {selectedProduct.unitType}s</span>
                          </div>
                          <div className="h-3 w-[1px] bg-slate-200"></div>
                          <div className="text-[9px] font-black uppercase text-slate-400">Depósito: <span className="text-slate-600">{selectedProduct.warehouses?.[0]?.hubName || 'Base Central'}</span></div>
                       </div>
                    )}
                 </div>

                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 border-b">
                          <TableRow>
                              <TableHead className="px-8 text-[10px] font-black uppercase">Img</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">SKU / Producto</TableHead>
                              <TableHead className="text-center text-[10px] font-black uppercase">Cant.</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">Unitario</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">Desc.</TableHead>
                              <TableHead className="text-right text-[10px] font-black uppercase">IVA</TableHead>
                              <TableHead className="text-right pr-8 text-[10px] font-black uppercase">Total Línea</TableHead>
                              <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.items?.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-16 text-slate-300 italic uppercase text-[10px] font-black tracking-widest">Inicie la carga de ítems mediante búsqueda o escaneo</TableCell></TableRow>
                          ) : (
                            formData.items?.map((item, i) => (
                              <TableRow key={i} className="hover:bg-slate-50/50">
                                  <TableCell className="pl-8">
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 border overflow-hidden flex items-center justify-center">
                                        {item.photoUrl ? <img src={item.photoUrl} className="w-full h-full object-cover" /> : <Package size={16} className="text-slate-300" />}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                        <p className="font-black text-slate-800 text-xs uppercase leading-none">{item.name}</p>
                                        <p className="text-[9px] text-slate-400 font-mono font-bold mt-1 tracking-tighter">{item.sku}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-black text-slate-900">{item.quantity} <span className="text-[8px] text-slate-400 font-normal">{item.unit}</span></TableCell>
                                  <TableCell className="text-right font-medium text-slate-600">${item.unitPrice.toLocaleString()}</TableCell>
                                  <TableCell className="text-right text-red-500 font-bold">-{item.discountPercent}%</TableCell>
                                  <TableCell className="text-right text-[10px] font-bold text-slate-400">{item.ivaRate}%</TableCell>
                                  <TableCell className="text-right pr-8 font-black text-slate-900 text-sm italic">${item.total.toLocaleString()}</TableCell>
                                  <TableCell className="pr-4"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveItem(i)}><Trash2 size={14}/></Button></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                    </Table>
                 </div>
              </CardContent>
           </Card>

           {/* 3. TRANSPORTE Y CONDICIONES */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                 <CardHeader className="bg-slate-100 p-6 border-b"><CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Truck size={16}/> Logística y Despacho</CardTitle></CardHeader>
                 <CardContent className="p-8 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                       <div className="space-y-0.5"><Label className="text-xs font-black uppercase text-blue-900">Incluir Transporte</Label><p className="text-[9px] text-blue-600 font-bold uppercase">Cargar valor del flete al presupuesto</p></div>
                       <Switch checked={formData.includeTransport} onCheckedChange={v => setFormData({...formData, includeTransport: v})} />
                    </div>
                    {formData.includeTransport && (
                       <div className="space-y-4 animate-in slide-in-from-top-2">
                          <div className="space-y-1.5">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Valor Neto del Flete</Label>
                             <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input type="number" className="pl-9 font-black" value={formData.freightValue} onChange={e => {
                                   const f = parseFloat(e.target.value) || 0;
                                   const totals = calculateTotals(formData.items || [], f, formData.commercialDiscount);
                                   setFormData({...formData, freightValue: f, ...totals});
                                }} />
                             </div>
                          </div>
                          <div className="space-y-1.5">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Dirección de Entrega / Puerto</Label>
                             <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-300" />
                                <Input className="pl-9 text-xs font-bold" value={formData.deliveryAddress} onChange={e => setFormData({...formData, deliveryAddress: e.target.value})} />
                             </div>
                          </div>
                       </div>
                    )}
                 </CardContent>
              </Card>

              <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
                 <CardHeader className="bg-slate-100 p-6 border-b"><CardTitle className="text-xs font-black uppercase text-slate-500 flex items-center gap-2"><Briefcase size={16}/> Acuerdo Comercial</CardTitle></CardHeader>
                 <CardContent className="p-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Forma de Pago</Label><Input className="h-9 text-xs" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} /></div>
                       <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Plazo (Días)</Label><Input className="h-9 text-xs" value={formData.paymentTerm} onChange={e => setFormData({...formData, paymentTerm: e.target.value})} /></div>
                       <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Entrega (Días)</Label><Input type="number" className="h-9 text-xs font-bold" value={formData.deliveryTimeDays} onChange={e => setFormData({...formData, deliveryTimeDays: parseInt(e.target.value) || 0})} /></div>
                       <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Garantía</Label><Input className="h-9 text-xs" value={formData.warrantyInfo} onChange={e => setFormData({...formData, warrantyInfo: e.target.value})} /></div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           {/* 4. OBSERVACIONES */}
           <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 p-6 border-b"><CardTitle className="text-xs font-black uppercase text-slate-400">Notas y Clausulado</CardTitle></CardHeader>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2"><Globe size={12}/> Observaciones Visibles (Cliente)</Label>
                    <Textarea placeholder="Cláusulas de validez, condiciones de descarga..." className="min-h-[120px] bg-slate-50 border-none rounded-2xl p-4 text-xs italic" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2"><ShieldCheck size={12}/> Notas Internas (Solo Empresa)</Label>
                    <Textarea placeholder="Comentarios sobre el margen, negociaciones previas..." className="min-h-[120px] bg-red-50/20 border-none rounded-2xl p-4 text-xs" value={formData.internalNotes} onChange={e => setFormData({...formData, internalNotes: e.target.value})} />
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* COLUMNA LATERAL: LIQUIDACIÓN */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-2xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden sticky top-24">
              <CardHeader className="p-8 pb-6 border-b border-white/5">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                    <Calculator size={18} /> Liquidación Final
                 </CardTitle>
                 <CardDescription className="text-white/40 text-[9px] uppercase font-bold">Valores expresados en {formData.currency}</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-widest">
                       <span>Subtotal Neto Bruto</span>
                       <span className="text-base text-white font-black italic">${(formData.subtotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-widest">
                       <span className="text-red-400">(-) Desc. Comercial General</span>
                       <div className="w-32">
                          <Input type="number" className="h-8 bg-white/5 border-none text-right font-black text-red-400" value={formData.commercialDiscount} onChange={e => {
                             const d = parseFloat(e.target.value) || 0;
                             const totals = calculateTotals(formData.items || [], formData.freightValue, d);
                             setFormData({...formData, commercialDiscount: d, ...totals});
                          }} />
                       </div>
                    </div>
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-widest">
                       <span className="text-blue-400">(+) Recargo Logístico</span>
                       <span className="text-base text-white font-black italic">${(formData.freightValue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-widest">
                       <span>Impuestos (IVA Total)</span>
                       <span className="text-base text-white font-black italic">${(formData.taxTotal || 0).toLocaleString()}</span>
                    </div>
                    
                    <div className="pt-8 border-t border-white/10 flex flex-col items-end gap-1">
                       <span className="text-[10px] font-black text-emerald-400 uppercase italic tracking-[0.2em]">VALOR FINAL FACTURABLE</span>
                       <span className="text-5xl font-black italic tracking-tighter text-emerald-400">${(formData.totalAmount || 0).toLocaleString()}</span>
                       {formData.currency !== 'ARS' && (
                         <p className="text-[9px] font-bold text-white/30 uppercase mt-1">Cotización Ref: ARS ${(formData.totalAmount! * (formData.exchangeRate || 1)).toLocaleString()}</p>
                       )}
                    </div>
                 </div>

                 <div className="pt-8 space-y-4">
                    <Button onClick={handleSave} disabled={isSubmitting || (formData.items?.length || 0) === 0} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-3xl shadow-2xl transition-all active:scale-95 group">
                       {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2 group-hover:scale-110 transition-transform" />}
                       CONFIRMAR Y EMITIR
                    </Button>
                    <div className="p-4 bg-white/5 rounded-2xl flex items-start gap-3">
                       <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                       <p className="text-[9px] text-white/40 leading-relaxed font-bold uppercase">
                          Al emitir, el presupuesto quedará en estado "Borrador" hasta que sea enviado formalmente al cliente por e-mail o WhatsApp.
                       </p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
