
'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Box, Plus, Search, MoreVertical, Trash2, Edit2, 
  Loader2, Scale, Layers, AlertTriangle, ThermometerSnowflake, 
  Tag, Ship, Info, Package, ChevronRight, Eye
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
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ProductosPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

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
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ncmCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm("¿Eliminar este producto del catálogo definitivamente?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      toast({ title: "Producto eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Box className="text-blue-600" /> Catálogo de Productos
          </h1>
          <p className="text-slate-500 text-sm">Gestión de artículos con especificaciones logísticas y regulatorias AR.</p>
        </div>
        
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100" asChild>
          <Link href="/productos/nuevo">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
          </Link>
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por SKU, nombre, categoría o NCM..." 
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
                  <TableHead>Identificación AR</TableHead>
                  <TableHead>Especificaciones</TableHead>
                  <TableHead>Requisitos / Peligro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">
                      No hay productos registrados. <Link href="/productos/nuevo" className="text-blue-600 font-bold underline">Cargar primero</Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm overflow-hidden">
                            {product.photoUrl ? (
                               <img src={product.photoUrl} className="w-full h-full object-cover" />
                            ) : (
                               <Package size={24} className="text-slate-300" />
                            )}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 uppercase tracking-tight">{product.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase">{product.sku}</div>
                            <Badge variant="outline" className="text-[7px] h-3 uppercase font-black px-1 mt-1 border-slate-200">{product.category}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {product.ncmCode ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700">
                               <Ship size={10} /> NCM: {product.ncmCode}
                            </div>
                          ) : (
                            <div className="text-[8px] text-slate-300 italic">Sin Posición Arancelaria</div>
                          )}
                          <div className="text-[9px] font-medium text-slate-500 uppercase">Origen: {product.origin}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700">
                            <Scale size={12} className="text-slate-400" /> {product.unitWeightKg.toLocaleString()} KG
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <Box size={12} className="text-slate-400" /> {product.unitsPerPallet} u. x Pallet
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {product.requiresReefer && (
                            <Badge className="bg-blue-600 text-white border-none text-[8px] h-4 uppercase font-black">
                              <ThermometerSnowflake size={10} className="mr-1" /> {product.tempRange?.min}/{product.tempRange?.max}°C
                            </Badge>
                          )}
                          {product.dangerLevel !== 'none' ? (
                            <Badge className={cn(
                              "text-[8px] h-4 uppercase font-black border-none",
                              product.dangerLevel === 'high' ? "bg-red-600 text-white" :
                              product.dangerLevel === 'medium' ? "bg-orange-500 text-white" :
                              "bg-yellow-400 text-slate-900"
                            )}>
                              <AlertTriangle size={10} className="mr-1" /> {product.onuNumber || 'PELIGRO'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-4 border-slate-100 text-slate-400">CARGA GENERAL</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Gestión de Producto</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/productos/${product.id}/editar`}><Edit2 className="w-4 h-4 mr-2" /> Editar Ficha Completa</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Info className="w-4 h-4 mr-2" /> Ver Trazabilidad
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Quitar del Catálogo
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
    </div>
  );
}
