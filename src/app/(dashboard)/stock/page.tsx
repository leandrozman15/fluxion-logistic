
'use client';

import { useState, useMemo } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Box, 
  Search, 
  Loader2, 
  TrendingUp, 
  AlertTriangle, 
  Plus, 
  ArrowRightLeft,
  Package,
  CheckCircle2,
  Clock
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Product, StockMovementType } from "@/app/lib/types";
import { cn } from "@/lib/utils";

export default function StockPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: "",
    type: 'in' as StockMovementType,
    quantity: 1,
    reason: ""
  });

  const productsQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "products"), orderBy("name"));
  }, [db, tenantId]);

  const { data: products, loading: loadingProducts } = useCollection<Product>(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const criticalStock = useMemo(() => {
    return products?.filter(p => p.stockQuantity <= (p.minStockAlert || 5)) || [];
  }, [products]);

  const handleStockAdjustment = async () => {
    if (!db || !tenantId || !adjustmentForm.productId || !user) return;
    setIsSubmitting(true);

    try {
      const product = products?.find(p => p.id === adjustmentForm.productId);
      if (!product) throw new Error("Producto no encontrado");

      const delta = adjustmentForm.type === 'in' ? adjustmentForm.quantity : -adjustmentForm.quantity;
      const newStock = (product.stockQuantity || 0) + delta;

      if (newStock < 0) throw new Error("El stock no puede ser negativo.");

      const batch = writeBatch(db);

      // 1. Actualizar Stock en Producto
      const productRef = doc(db, "tenants", tenantId, "products", product.id);
      batch.update(productRef, {
        stockQuantity: newStock,
        updatedAt: serverTimestamp()
      });

      // 2. Registrar Movimiento en la BD (para auditoría interna aunque no se muestre)
      const movementRef = doc(collection(db, "tenants", tenantId, "stock_movements"));
      batch.set(movementRef, {
        id: movementRef.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: adjustmentForm.type,
        quantity: adjustmentForm.quantity,
        previousStock: product.stockQuantity || 0,
        newStock: newStock,
        reason: adjustmentForm.reason || "Ajuste manual",
        actorEmail: user.email,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      
      toast({ title: "Stock Actualizado", description: `${product.sku}: ${newStock} unidades en total.` });
      setIsAdjusting(false);
      setAdjustmentForm({ productId: "", type: 'in', quantity: 1, reason: "" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en ajuste", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Stock y Almacén</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control de inventario y trazabilidad de movimientos.</p>
        </div>
        
        <Dialog open={isAdjusting} onOpenChange={setIsAdjusting}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 font-black italic uppercase text-[11px] h-12 px-6 rounded-2xl">
              <ArrowRightLeft className="w-5 h-5 mr-2" /> Movimiento Manual
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Ajuste de Inventario</DialogTitle>
              <DialogDescription className="text-[10px] uppercase font-bold text-slate-400">Registre entradas o salidas manuales de mercadería.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">1. Seleccionar Producto</Label>
                  <Select value={adjustmentForm.productId} onValueChange={v => setAdjustmentForm({...adjustmentForm, productId: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                       <SelectValue placeholder="Elegir del catálogo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">2. Tipo Movimiento</Label>
                    <Select value={adjustmentForm.type} onValueChange={(v: any) => setAdjustmentForm({...adjustmentForm, type: v})}>
                      <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">🟢 Entrada (Ingreso)</SelectItem>
                        <SelectItem value="out">🔴 Salida (Baja)</SelectItem>
                        <SelectItem value="adjustment">⚙️ Ajuste Técnico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">3. Cantidad (u.)</Label>
                    <Input type="number" min="1" className="h-12 bg-slate-50 border-none rounded-xl font-black text-lg" value={adjustmentForm.quantity} onChange={e => setAdjustmentForm({...adjustmentForm, quantity: parseInt(e.target.value) || 1})} />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">4. Motivo / Observación</Label>
                  <Input placeholder="Ej: Compra a proveedor, rotura, etc." className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} />
               </div>
            </div>
            <DialogFooter>
               <Button variant="ghost" onClick={() => setIsAdjusting(false)} className="font-bold text-slate-400 uppercase text-xs">Cancelar</Button>
               <Button onClick={handleStockAdjustment} disabled={isSubmitting || !adjustmentForm.productId} className="bg-blue-600 h-12 px-8 rounded-xl font-black uppercase shadow-lg shadow-blue-100">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={16} />}
                  CONFIRMAR CAMBIO
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Productos Totales</p>
              <p className="text-4xl font-black italic text-slate-900">{products?.length || 0}</p>
            </div>
            <Package size={40} className="text-blue-100" />
          </CardContent>
        </Card>
        <Card className={cn("border-none shadow-md", criticalStock.length > 0 ? "bg-red-50 text-red-700" : "bg-white")}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase opacity-50 tracking-widest">Bajo Stock (Alertas)</p>
              <p className="text-4xl font-black italic">{criticalStock.length}</p>
            </div>
            <AlertTriangle size={40} className={cn(criticalStock.length > 0 ? "text-red-200" : "text-slate-100")} />
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-slate-900 text-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Estado Operativo</p>
              <p className="text-lg font-black italic text-blue-400 uppercase tracking-tighter">Inventario en Línea</p>
            </div>
            <TrendingUp size={40} className="text-white/10" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b p-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="text-base font-black uppercase italic tracking-tighter flex items-center gap-2">
                    <Box className="text-blue-600" size={20} /> Inventario Disponible
                  </CardTitle>
                  <div className="relative w-full md:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Buscar SKU o nombre..." 
                      className="pl-9 h-9 text-xs rounded-xl bg-white border-slate-200" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
               </div>
          </CardHeader>
          <CardContent className="p-0">
               {loadingProducts ? (
                 <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
               ) : (
                 <Table>
                   <TableHeader className="bg-slate-50/30">
                     <TableRow>
                       <TableHead className="px-8 text-[10px] font-black uppercase">SKU / Producto</TableHead>
                       <TableHead className="text-[10px] font-black uppercase text-center">Unidad</TableHead>
                       <TableHead className="text-[10px] font-black uppercase text-center">Existencia</TableHead>
                       <TableHead className="text-[10px] font-black uppercase">Estado Alerta</TableHead>
                       <TableHead className="pr-8 text-right text-[10px] font-black uppercase">Ficha</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredProducts.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">No hay productos en inventario.</TableCell></TableRow>
                     ) : (
                       filteredProducts.map(product => (
                         <TableRow key={product.id} className="hover:bg-slate-50/50 group">
                           <TableCell className="px-8 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-blue-600 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <Box size={20} />
                                 </div>
                                 <div>
                                    <p className="font-black text-slate-900 text-sm tracking-tight">{product.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono font-bold">{product.sku}</p>
                                 </div>
                              </div>
                           </TableCell>
                           <TableCell className="text-center font-bold text-slate-500 uppercase text-[10px]">{product.unitType}</TableCell>
                           <TableCell className="text-center">
                              <span className={cn(
                                "text-lg font-black italic",
                                product.stockQuantity <= (product.minStockAlert || 5) ? "text-red-600" : "text-slate-900"
                              )}>
                                {product.stockQuantity || 0}
                              </span>
                           </TableCell>
                           <TableCell>
                              {product.stockQuantity <= (product.minStockAlert || 5) ? (
                                <Badge variant="destructive" className="animate-pulse text-[8px] h-4">STOCK CRÍTICO</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[8px] h-4">NIVEL OK</Badge>
                              )}
                           </TableCell>
                           <TableCell className="pr-8 text-right">
                              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => window.location.href = `/productos/${product.id}/ficha`}>
                                <Plus size={16} className="text-slate-400" />
                              </Button>
                           </TableCell>
                         </TableRow>
                       ))
                     )}
                   </TableBody>
                 </Table>
               )}
          </CardContent>
        </Card>

        <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex items-start gap-4">
             <Clock size={24} className="text-blue-600 shrink-0 mt-1" />
             <div className="space-y-1">
                <p className="text-xs font-black text-blue-800 uppercase italic">Auditoría de Almacén</p>
                <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                  El sistema mantiene un registro persistente de cada ajuste manual para auditoría contable. Utilice el botón superior para ingresar mercadería nueva o dar de baja bultos dañados.
                </p>
             </div>
        </div>
      </div>
    </div>
  );
}
