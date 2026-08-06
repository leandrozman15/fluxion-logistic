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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  Box,
  Download,
  Edit2,
  Eye,
  Loader2,
  MoreVertical,
  Package,
  Plus,
  Scale,
  Search,
  Ship,
  ThermometerSnowflake,
  Trash2,
} from "lucide-react";
import { Product } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateProductPDF } from "@/lib/pdf-service";
import { deleteProduct, listProducts } from "@/lib/products-api";
import { getTenantProfile } from "@/lib/settings-api";
import type { Tenant } from "@/app/lib/types";

export default function ProductosPage() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDownloadingId, setIsDownloadingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSku, setDeleteSku] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<Tenant | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const rows = await listProducts();
        if (active) setProducts(rows);
      } catch (error) {
        if (active) {
          setProducts([]);
          toast({ variant: "destructive", title: "Error al cargar productos", description: (error as Error).message });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    getTenantProfile().then((profile) => { if (active) setTenantProfile(profile as unknown as Tenant); }).catch(() => {});
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return products.filter((product) =>
      (product.name || "").toLowerCase().includes(search) ||
      (product.sku || "").toLowerCase().includes(search) ||
      (product.category || "").toLowerCase().includes(search) ||
      (product.ncmCode || "").toLowerCase().includes(search)
    );
  }, [products, searchTerm]);

  const handleDownloadDirect = async (product: Product) => {
    setIsDownloadingId(product.id);
    try {
      await generateProductPDF(product, tenantProfile || undefined);
      toast({ title: "PDF Descargado", description: `Se ha generado la ficha técnica de ${product.sku}.` });
    } catch {
      toast({ variant: "destructive", title: "Error al generar PDF" });
    } finally {
      setIsDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!tenantId || !deleteId) return;
    setIsDeleting(true);
    try {
      await deleteProduct(deleteId);
      setProducts((prev) => prev.filter((product) => product.id !== deleteId));
      toast({ title: "Producto eliminado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar", description: (error as Error).message });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
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
              placeholder="Buscar por SKU, nombre o NCM..."
              className="pl-8 bg-white"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
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
                            {product.photoUrl ? <img src={product.photoUrl} className="w-full h-full object-cover" alt="Producto" /> : <Package size={24} className="text-slate-300" />}
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
                            <Scale size={12} className="text-slate-400" /> {product.unitWeightKg?.toLocaleString()} KG
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                            <Box size={12} className="text-slate-400" /> {product.unitsPerBox || 0} u. x Caja
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
                            <Badge
                              className={cn(
                                "text-[8px] h-4 uppercase font-black border-none",
                                product.dangerLevel === 'high' ? "bg-red-600 text-white" :
                                product.dangerLevel === 'medium' ? "bg-orange-50 text-white" :
                                "bg-yellow-400 text-slate-900"
                              )}
                            >
                              <AlertTriangle size={10} className="mr-1" /> {product.onuNumber || 'PELIGRO'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] h-4 border-slate-100 text-slate-400">CARGA GENERAL</Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                              <MoreVertical size={20} />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-none shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">Documentación A4</DropdownMenuLabel>

                            <DropdownMenuItem
                              onClick={() => handleDownloadDirect(product)}
                              className="font-black text-blue-700 bg-blue-50 h-10 rounded-lg mb-1 cursor-pointer"
                              disabled={isDownloadingId === product.id}
                            >
                              {isDownloadingId === product.id ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                              Descargar Ficha Técnica
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">Acciones</DropdownMenuLabel>

                            <DropdownMenuItem asChild className="cursor-pointer font-bold h-10 rounded-lg">
                              <Link href={`/productos/${product.id}/editar`}><Edit2 className="w-4 h-4 mr-2" /> Editar Ficha</Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => router.push(`/productos/${product.id}/ficha`)} className="font-bold h-10 rounded-lg cursor-pointer">
                              <Eye className="w-4 h-4 mr-2" /> Vista Previa App
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1" />

                            <DropdownMenuItem
                              className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-10 rounded-lg cursor-pointer"
                              onSelect={(event) => {
                                event.preventDefault();
                                setDeleteId(product.id);
                                setDeleteSku(product.sku);
                              }}
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic tracking-tighter">¿Quitar del Catálogo?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500">
              Está por eliminar definitivamente el producto <span className="font-bold text-slate-900">{deleteSku}</span>. Esta acción no se puede deshacer y afectará a los reportes históricos.
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
              CONFIRMAR BAJA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
