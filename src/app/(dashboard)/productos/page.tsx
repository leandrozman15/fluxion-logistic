
'use client';

import { useState, useMemo, useEffect } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Box, Plus, Search, MoreVertical, Trash2, Edit2, 
  Loader2, Scale, Layers, AlertTriangle, ThermometerSnowflake, 
  Save, X, Info, Tag
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Product } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";

export default function ProductosPage() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const [mounted, setMounted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState<Partial<Product>>({
    sku: "",
    name: "",
    description: "",
    category: "Carga General",
    unitWeightKg: 0,
    unitVolumeM3: 0,
    dangerLevel: 'none',
    requiresReefer: false
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const productsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "products"), orderBy("name"));
  }, [db]);

  const { data: products, loading } = useCollection<Product>(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      sku: "",
      name: "",
      description: "",
      category: "Carga General",
      unitWeightKg: 0,
      unitVolumeM3: 0,
      dangerLevel: 'none',
      requiresReefer: false
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData(product);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!db || !formData.name || !formData.sku) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Nombre y SKU son obligatorios." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Producto Actualizado" });
      } else {
        await addDoc(collection(db, "products"), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: "Producto Registrado" });
      }
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este producto del catálogo?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      toast({ title: "Producto eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Box className="text-blue-600" /> Catálogo de Productos
          </h1>
          <p className="text-slate-500 text-sm">Gestión de artículos y especificaciones logísticas para el despacho.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por SKU, nombre o categoría..." 
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Producto / SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Especificaciones</TableHead>
                  <TableHead>Requisitos Especiales</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay productos registrados en el catálogo.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border">
                            <Box size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{product.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{product.sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">
                          <Tag size={10} className="mr-1" /> {product.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                            <Scale size={12} className="text-slate-400" /> {product.unitWeightKg} KG/unidad
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                            <Layers size={12} className="text-slate-400" /> {product.unitVolumeM3} M³
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {product.requiresReefer && (
                            <Badge className="bg-blue-100 text-blue-700 border-none text-[8px] h-4 uppercase font-black">
                              <ThermometerSnowflake size={10} className="mr-1" /> Reefer
                            </Badge>
                          )}
                          {product.dangerLevel !== 'none' && (
                            <Badge className={cn(
                              "text-[8px] h-4 uppercase font-black border-none",
                              product.dangerLevel === 'high' ? "bg-red-100 text-red-700" :
                              product.dangerLevel === 'medium' ? "bg-orange-100 text-orange-700" :
                              "bg-yellow-100 text-yellow-700"
                            )}>
                              <AlertTriangle size={10} className="mr-1" /> Peligro: {product.dangerLevel}
                            </Badge>
                          )}
                          {!product.requiresReefer && product.dangerLevel === 'none' && (
                            <span className="text-[10px] text-slate-300 italic">Sin requisitos</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Gestión de Producto</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenEdit(product)}>
                              <Edit2 className="w-4 h-4 mr-2" /> Editar Ficha Técnica
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar del Catálogo
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Producto' : 'Nuevo Producto en Catálogo'}</DialogTitle>
            <DialogDescription>
              Defina las especificaciones técnicas para el cálculo automático de carga.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Código Interno</Label>
                <Input id="sku" placeholder="Ej: PRD-001" className="bg-white" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carga General">Carga General</SelectItem>
                    <SelectItem value="Alimentos">Alimentos</SelectItem>
                    <SelectItem value="Químicos">Químicos</SelectItem>
                    <SelectItem value="Maquinaria">Maquinaria</SelectItem>
                    <SelectItem value="Electrónica">Electrónica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto</Label>
              <Input id="name" placeholder="Ej: Bobina de Acero 500mm" className="bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Scale size={14} className="text-slate-400" /> Peso Unitario (KG)
                </Label>
                <Input type="number" step="0.01" className="bg-white" value={formData.unitWeightKg} onChange={e => setFormData({...formData, unitWeightKg: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers size={14} className="text-slate-400" /> Volumen Unitario (M³)
                </Label>
                <Input type="number" step="0.001" className="bg-white" value={formData.unitVolumeM3} onChange={e => setFormData({...formData, unitVolumeM3: parseFloat(e.target.value) || 0})} />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border rounded-xl space-y-4">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Info size={14} /> Requisitos de Transporte
              </p>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <ThermometerSnowflake size={14} className="text-blue-500" /> Cadena de Frío (Reefer)
                  </Label>
                  <p className="text-[10px] text-slate-500">Requiere temperatura controlada.</p>
                </div>
                <Switch checked={formData.requiresReefer} onCheckedChange={v => setFormData({...formData, requiresReefer: v})} />
              </div>
              <div className="space-y-2 pt-2 border-t">
                <Label className="flex items-center gap-2 text-orange-600 font-bold">
                  <AlertTriangle size={14} /> Nivel de Peligrosidad (IMO/Dangerous)
                </Label>
                <Select value={formData.dangerLevel} onValueChange={(v: any) => setFormData({...formData, dangerLevel: v})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin Peligro</SelectItem>
                    <SelectItem value="low">Bajo (Inflamable)</SelectItem>
                    <SelectItem value="medium">Medio (Tóxico/Corrosivo)</SelectItem>
                    <SelectItem value="high">Alto (Explosivo/Radiactivo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-slate-500 font-bold">CANCELAR</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 font-bold min-w-[120px]">
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : editingId ? <Save className="mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
              {editingId ? 'GUARDAR CAMBIOS' : 'REGISTRAR PRODUCTO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
