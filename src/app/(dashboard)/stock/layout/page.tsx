
'use client';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { 
  Box, 
  Warehouse, 
  Layers, 
  LayoutGrid, 
  Plus, 
  Save, 
  Loader2, 
  Info, 
  Container,
  CheckCircle2,
  MapPin,
  ArrowLeft,
  Search,
  Camera,
  XCircle,
  ScanBarcode,
  Package,
  Settings2,
  Trash2
} from "lucide-react";
import { Hub, Product, WarehouseSlot, WarehouseSlotMaterial } from "@/app/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { listHubs, updateHub } from "@/lib/hubs-api";
import { listProducts, updateProduct } from "@/lib/products-api";

/**
 * Componente de Slot de Rack (Ubicación física individual)
 */
function RackSlot({ coordinate, status, product, onClick }: { coordinate: string, status: string, product?: any, onClick: () => void }) {
  const isOccupied = status === 'occupied';
  const isBlocked = status === 'blocked';
  const isReserved = status === 'reserved';

  return (
    <div 
      className={cn(
        "relative h-32 w-full border-x-4 border-orange-500 flex flex-col justify-end p-1 transition-all group",
        isBlocked ? "bg-red-50/50" : "bg-slate-50/30 hover:bg-blue-50/50 cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="absolute bottom-0 left-[-4px] right-[-4px] h-2 bg-blue-600 shadow-sm z-10"></div>
      
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden text-center">
        {isOccupied ? (
          <div className="animate-in fade-in zoom-in-95 duration-300 w-full h-full flex flex-col items-center justify-end pb-2">
            <div className="w-[85%] h-16 bg-[#C19A6B] rounded-sm shadow-md border-b-4 border-[#8B4513] flex flex-col items-center justify-center p-1 relative">
               <div className="absolute -top-10 w-full h-12 bg-white border border-slate-200 rounded-sm shadow-sm flex items-center justify-center overflow-hidden">
                  {product?.photoUrl ? (
                    <img src={product.photoUrl} className="w-full h-full object-cover" alt="Item" />
                  ) : (
                    <Package size={24} className="text-slate-300" />
                  )}
               </div>
               <p className="text-[7px] font-black text-[#5C4033] uppercase leading-none mt-2 truncate w-full">
                 {product?.sku || 'CARGADO'}
               </p>
            </div>
          </div>
        ) : isBlocked ? (
          <div className="flex flex-col items-center gap-1 opacity-40">
             <XCircle size={20} className="text-red-500" />
             <span className="text-[8px] font-black text-red-700 uppercase text-center">BLOQUEADO</span>
          </div>
        ) : isReserved ? (
          <div className="w-[85%] h-8 border-2 border-dashed border-amber-400 rounded-lg flex items-center justify-center bg-amber-50">
             <span className="text-[8px] font-black text-amber-600 uppercase">RESERVADO</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono font-black text-slate-200 group-hover:text-blue-400 transition-colors">
            {coordinate.split('-').pop()}
          </span>
        )}
      </div>

      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
         <Badge className="bg-slate-900 text-white text-[7px] font-black uppercase border-none px-2 h-4">
           {coordinate}
         </Badge>
      </div>
    </div>
  );
}

function LayoutContent() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const hubIdFromUrl = searchParams.get('hubId');
  const [selectedHubId, setSelectedHubId] = useState<string>(hubIdFromUrl || "");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [slotOverrides, setSlotOverrides] = useState<Record<string, WarehouseSlot>>({});

  const [selectedSlotCoord, setSelectedSlotCoord] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<Partial<WarehouseSlot>>({
    status: 'empty',
    productId: "",
    productSku: "",
    productName: "",
    capacityKg: 1000,
    currentWeightKg: 0,
    quantityUnits: 0,
    lotNumber: "",
    entryDate: "",
    expirationDate: "",
    optionalExitDate: "",
    notes: "",
  });
  const [slotMaterials, setSlotMaterials] = useState<WarehouseSlotMaterial[]>([]);
  const [materialDraft, setMaterialDraft] = useState<Partial<WarehouseSlotMaterial>>({
    productId: "",
    quantityUnits: 0,
    lotNumber: "",
    entryDate: "",
    expirationDate: "",
    optionalExitDate: "",
    notes: "",
  });

  const [configForm, setConfigForm] = useState({
    corridors: "A,B,C",
    positions: 4,
    levels: 2,
    prefix: ""
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId) {
        if (active) {
          setHubs([]);
          setProducts([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const [hubRows, productRows] = await Promise.all([listHubs(), listProducts()]);
        if (!active) return;
        setHubs(hubRows);
        setProducts(productRows);
      } catch (error) {
        if (!active) return;
        setHubs([]);
        setProducts([]);
        toast({ variant: "destructive", title: "Error al cargar layout", description: (error as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const activeHub = useMemo(() => hubs?.find(h => h.id === selectedHubId), [hubs, selectedHubId]);

  // Si el hubId de la URL quedó desactualizado (ej. el link se generó antes de que la sede
  // cambiara de id, o la sede fue recreada) el hub activo nunca resuelve y todos los guardados
  // quedan silenciosamente bloqueados. Ante esto, autoseleccionamos la primera sede disponible.
  useEffect(() => {
    if (loading || hubs.length === 0) return;
    const matches = hubs.some((h) => h.id === selectedHubId);
    if (!matches) {
      setSelectedHubId(hubs[0].id);
      toast({ title: "Sede reasignada", description: "El enlace hacía referencia a una sede que ya no existe. Se seleccionó la primera sede disponible." });
    }
  }, [loading, hubs, selectedHubId, toast]);

  const selectedProduct = useMemo(() => {
    if (!slotForm.productId) return null;
    return products.find((product) => product.id === slotForm.productId) || null;
  }, [products, slotForm.productId]);

  const selectedDraftProduct = useMemo(() => {
    if (!materialDraft.productId) return null;
    return products.find((product) => product.id === materialDraft.productId) || null;
  }, [products, materialDraft.productId]);

  const assignedSlots = useMemo(() => {
    const map: Record<string, WarehouseSlot> = { ...slotOverrides };
    products.forEach((product) => {
      (product.warehouses || []).forEach((warehouse) => {
        if (warehouse.hubId !== selectedHubId || !warehouse.location) return;
        const persisted = map[warehouse.location];
        // Si el slot ya tiene datos persistidos (multi-material, lote, fechas), no los pisamos:
        // esto solo actúa como reconciliación para ubicaciones legacy sin slotOverride propio.
        if (persisted && persisted.status === 'occupied') return;
        map[warehouse.location] = {
          ...(persisted || {}),
          id: warehouse.location,
          coordinate: warehouse.location,
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          status: 'occupied',
          currentWeightKg: product.unitWeightKg,
          lotNumber: warehouse.lotNumber,
          entryDate: warehouse.entryDate,
        };
      });
    });
    return map;
  }, [products, selectedHubId, slotOverrides]);

  useEffect(() => {
    if (activeHub?.settings?.layoutConfig) {
      const cfg = activeHub.settings.layoutConfig;
      setConfigForm({
        corridors: Array.isArray(cfg.corridors) ? cfg.corridors.join(',') : (cfg.corridors || "A,B,C"),
        positions: cfg.positions || 4,
        levels: cfg.levels || 2,
        prefix: cfg.prefix || activeHub.name.substring(0, 5).toUpperCase()
      });
    } else if (activeHub) {
      setConfigForm(prev => ({ ...prev, prefix: activeHub.name.substring(0, 5).toUpperCase() }));
    }

    const rawOverrides = (activeHub as any)?.settings?.slotOverrides || {};
    setSlotOverrides(rawOverrides);
  }, [activeHub]);

  const persistSlotOverrides = async (nextOverrides: Record<string, WarehouseSlot>) => {
    if (!selectedHubId || !activeHub) {
      throw new Error("No se pudo identificar la sede activa. Recargá la página e intentá de nuevo.");
    }
    await updateHub(selectedHubId, {
      settings: {
        ...(activeHub.settings || {}),
        slotOverrides: nextOverrides as any,
      } as any,
    });
    setHubs((prev) => prev.map((hub) => (hub.id === selectedHubId ? {
      ...hub,
      settings: {
        ...(hub.settings || {}),
        slotOverrides: nextOverrides as any,
      } as any,
    } : hub)));
  };

  const displayRacks = useMemo(() => {
    const corridorsArray = configForm.corridors.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "");
    return corridorsArray.map(c => ({
      corridor: c,
      positions: Array.from({ length: configForm.positions }, (_, i) => String(i + 1).padStart(2, '0')),
      levels: Array.from({ length: configForm.levels }, (_, i) => String(configForm.levels - i).padStart(2, '0'))
    }));
  }, [configForm]);

  const totalPositions = useMemo(() => {
    const corridorsCount = configForm.corridors.split(',').filter(s => s.trim() !== "").length;
    return corridorsCount * configForm.positions * configForm.levels;
  }, [configForm]);

  const stats = useMemo(() => {
    const total = totalPositions;
    const occupied = Object.values(assignedSlots).filter(s => s.status === 'occupied').length;
    const blocked = Object.values(assignedSlots).filter(s => s.status === 'blocked').length;
    const reserved = Object.values(assignedSlots).filter(s => s.status === 'reserved').length;
    
    return {
      total,
      occupied,
      blocked,
      reserved,
      available: total - occupied - blocked - reserved
    };
  }, [totalPositions, assignedSlots]);

  const handleSaveConfig = async () => {
    if (!tenantId || !selectedHubId || !activeHub) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo identificar la sede activa. Recargá la página e intentá de nuevo." });
      return;
    }
    setIsSaving(true);
    try {
      const corridorsArray = configForm.corridors.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== "");
      const updated = await updateHub(selectedHubId, {
        settings: {
          ...(activeHub.settings || {}),
          layoutConfig: {
            corridors: corridorsArray,
            positions: configForm.positions,
            levels: configForm.levels,
            prefix: configForm.prefix,
          },
          slotOverrides: slotOverrides as any,
        } as any,
      });
      setHubs((prev) => prev.map((hub) => (hub.id === selectedHubId ? updated : hub)));
      toast({ title: "Configuración Guardada" });
      setIsConfigOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar", description: (e as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSlot = (coord: string) => {
    setSelectedSlotCoord(coord);
    const existingData = assignedSlots[coord] || { status: 'empty' };
    const currentProduct = existingData.productId ? products?.find((p) => p.id === existingData.productId) : null;

    const existingMaterials = Array.isArray(existingData.materials) && existingData.materials.length > 0
      ? existingData.materials
      : currentProduct
        ? [{
            productId: currentProduct.id,
            productSku: currentProduct.sku,
            productName: currentProduct.name,
            // Si la ubicación vino "reconciliada" desde el campo libre de ubicación del producto
            // (sin slotOverride real todavía), puede no haber cantidad registrada. Usamos al menos 1
            // para no bloquear el guardado con la validación de "cantidad > 0".
            quantityUnits: Math.max(Number(existingData.quantityUnits ?? currentProduct.stockQuantity ?? 0), 1),
            lotNumber: existingData.lotNumber,
            entryDate: existingData.entryDate,
            expirationDate: existingData.expirationDate,
            optionalExitDate: existingData.optionalExitDate,
            notes: existingData.notes,
          }]
        : [];

    setSlotMaterials(existingMaterials);
    setMaterialDraft({
      productId: "",
      quantityUnits: 0,
      lotNumber: "",
      entryDate: existingData.entryDate || "",
      expirationDate: "",
      optionalExitDate: "",
      notes: "",
    });

    setSlotForm({
      ...existingData,
      coordinate: coord,
      currentWeightKg: currentProduct?.unitWeightKg || 0,
      capacityKg: existingData.capacityKg || 1000,
      quantityUnits: Math.max(Number(existingData.quantityUnits ?? currentProduct?.stockQuantity ?? 0), currentProduct ? 1 : 0),
      lotNumber: existingData.lotNumber || "",
      entryDate: existingData.entryDate || "",
      expirationDate: existingData.expirationDate || "",
      optionalExitDate: existingData.optionalExitDate || "",
      notes: existingData.notes || "",
    });
  };

  const handleAddMaterial = () => {
    if (!materialDraft.productId) return;
    const product = products.find((row) => row.id === materialDraft.productId);
    if (!product) return;

    const quantity = Number(materialDraft.quantityUnits || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ variant: "destructive", title: "Cantidad inválida", description: "Ingresá una cantidad mayor a cero." });
      return;
    }

    const nextMaterial: WarehouseSlotMaterial = {
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      quantityUnits: quantity,
      lotNumber: (materialDraft.lotNumber || "").trim() || undefined,
      entryDate: materialDraft.entryDate || undefined,
      expirationDate: materialDraft.expirationDate || undefined,
      optionalExitDate: materialDraft.optionalExitDate || undefined,
      notes: (materialDraft.notes || "").trim() || undefined,
    };

    setSlotMaterials((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === nextMaterial.productId && (item.lotNumber || "") === (nextMaterial.lotNumber || ""));
      if (existingIndex === -1) return [...prev, nextMaterial];

      const clone = [...prev];
      clone[existingIndex] = {
        ...clone[existingIndex],
        quantityUnits: clone[existingIndex].quantityUnits + nextMaterial.quantityUnits,
        entryDate: nextMaterial.entryDate || clone[existingIndex].entryDate,
        expirationDate: nextMaterial.expirationDate || clone[existingIndex].expirationDate,
        optionalExitDate: nextMaterial.optionalExitDate || clone[existingIndex].optionalExitDate,
        notes: nextMaterial.notes || clone[existingIndex].notes,
      };
      return clone;
    });

    setMaterialDraft({
      productId: "",
      quantityUnits: 0,
      lotNumber: "",
      entryDate: materialDraft.entryDate || "",
      expirationDate: "",
      optionalExitDate: "",
      notes: "",
    });
  };

  const handleRemoveMaterial = (index: number) => {
    setSlotMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  // Recalcula la cantidad de un producto en el hub activo SUMANDO todos los slots que lo
  // contienen (no solo el que se acaba de editar). Antes, un producto guardado en 2+ slots
  // del mismo hub pisaba su única entrada en warehouses[] con la cantidad del último slot
  // editado, perdiendo la suma real en el total de inventario.
  const reconcileHubProductStock = async (
    productIds: string[],
    overridesForHub: Record<string, WarehouseSlot>
  ) => {
    if (!selectedHubId || !activeHub) {
      throw new Error("No se pudo identificar la sede activa. Recargá la página e intentá de nuevo.");
    }

    for (const productId of productIds) {
      const product = products.find((row) => row.id === productId);
      if (!product) continue;

      const matchingSlots = Object.values(overridesForHub).filter((slot) =>
        slot.status === 'occupied' && (
          (slot.materials || []).some((m) => m.productId === productId) ||
          (!slot.materials?.length && slot.productId === productId)
        )
      );

      const totalInHub = matchingSlots.reduce((sum, slot) => {
        const material = (slot.materials || []).find((m) => m.productId === productId);
        return sum + Number(material?.quantityUnits ?? slot.quantityUnits ?? 0);
      }, 0);

      const firstSlot = matchingSlots[0];
      const firstMaterial = firstSlot ? (firstSlot.materials || []).find((m) => m.productId === productId) : undefined;
      const location = matchingSlots.length > 1
        ? matchingSlots.map((s) => s.coordinate).join(', ')
        : firstSlot?.coordinate;

      const existingIdx = (product.warehouses || []).findIndex((entry) => entry.hubId === selectedHubId);
      const nextWarehouses = [...(product.warehouses || [])];

      if (totalInHub <= 0) {
        if (existingIdx >= 0) nextWarehouses.splice(existingIdx, 1);
      } else if (existingIdx >= 0) {
        nextWarehouses[existingIdx] = {
          ...nextWarehouses[existingIdx],
          hubName: activeHub.name,
          location,
          stockQuantity: totalInHub,
          lotNumber: firstMaterial?.lotNumber ?? firstSlot?.lotNumber,
          entryDate: firstMaterial?.entryDate ?? firstSlot?.entryDate,
        };
      } else {
        nextWarehouses.push({
          hubId: selectedHubId,
          hubName: activeHub.name,
          location,
          stockQuantity: totalInHub,
          minStock: product.minStockAlert || 0,
          maxStock: product.maxStockAlert || 0,
          lotNumber: firstMaterial?.lotNumber ?? firstSlot?.lotNumber,
          entryDate: firstMaterial?.entryDate ?? firstSlot?.entryDate,
        });
      }

      // La cantidad total del producto es la suma del stock en todas sus sedes/ubicaciones.
      const totalStock = nextWarehouses.reduce((sum, w) => sum + Number(w.stockQuantity || 0), 0);

      const updated = await updateProduct(product.id, { warehouses: nextWarehouses, stockQuantity: totalStock });
      setProducts((prev) => prev.map((row) => (row.id === product.id ? updated : row)));
    }
  };

  const handleSaveSlot = async () => {
    if (!tenantId || !selectedHubId || !selectedSlotCoord || !activeHub) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo identificar la sede activa. Recargá la página e intentá de nuevo." });
      return;
    }
    setIsSaving(true);
    try {
      const nextOverrides = { ...slotOverrides };
      const currentOccupant = assignedSlots[selectedSlotCoord];

      if (slotForm.status === 'occupied') {
        let materialsToSave = [...slotMaterials];

        if (materialsToSave.length === 0 && slotForm.productId) {
          const fallbackProduct = products.find((p) => p.id === slotForm.productId);
          if (fallbackProduct) {
            materialsToSave = [{
              productId: fallbackProduct.id,
              productSku: fallbackProduct.sku,
              productName: fallbackProduct.name,
              quantityUnits: Number(slotForm.quantityUnits || 0),
              lotNumber: (slotForm.lotNumber || "").trim() || undefined,
              entryDate: slotForm.entryDate || undefined,
              expirationDate: slotForm.expirationDate || undefined,
              optionalExitDate: slotForm.optionalExitDate || undefined,
              notes: (slotForm.notes || "").trim() || undefined,
            }];
          }
        }

        materialsToSave = materialsToSave.filter((material) => material.productId && Number(material.quantityUnits || 0) > 0);
        if (materialsToSave.length === 0) {
          throw new Error('Agregá al menos un material con cantidad para ocupar el slot.');
        }

        const previousProductIds = Array.from(new Set([
          ...(currentOccupant?.materials || []).map((item) => item.productId),
          currentOccupant?.productId,
        ].filter(Boolean) as string[]));
        const nextProductIds = Array.from(new Set(materialsToSave.map((item) => item.productId)));

        const totalUnits = materialsToSave.reduce((sum, item) => sum + Number(item.quantityUnits || 0), 0);
        const primaryMaterial = materialsToSave[0];

        nextOverrides[selectedSlotCoord] = {
          id: selectedSlotCoord,
          coordinate: selectedSlotCoord,
          status: 'occupied',
          productId: primaryMaterial.productId,
          productSku: primaryMaterial.productSku,
          productName: materialsToSave.length > 1
            ? `${primaryMaterial.productName} +${materialsToSave.length - 1} más`
            : primaryMaterial.productName,
          capacityKg: slotForm.capacityKg || 1000,
          currentWeightKg: materialsToSave.reduce((sum, item) => {
            const product = products.find((row) => row.id === item.productId);
            return sum + Number(product?.unitWeightKg || 0) * Number(item.quantityUnits || 0);
          }, 0),
          quantityUnits: totalUnits,
          lotNumber: primaryMaterial.lotNumber,
          entryDate: primaryMaterial.entryDate,
          expirationDate: primaryMaterial.expirationDate,
          optionalExitDate: primaryMaterial.optionalExitDate,
          notes: (slotForm.notes || "").trim() || primaryMaterial.notes,
          materials: materialsToSave,
          lastAuditAt: new Date().toISOString(),
        } as WarehouseSlot;

        // Reconcilia con el estado FINAL de los slots del hub (ya incluye este slot recién
        // editado), así un producto presente en 2+ slots suma correctamente su stock total.
        await reconcileHubProductStock(Array.from(new Set([...previousProductIds, ...nextProductIds])), nextOverrides);
      } else {
        const previousProductIds = Array.from(new Set([
          ...(currentOccupant?.materials || []).map((item) => item.productId),
          currentOccupant?.productId,
        ].filter(Boolean) as string[]));

        if (slotForm.status === 'blocked' || slotForm.status === 'reserved') {
          nextOverrides[selectedSlotCoord] = {
            id: selectedSlotCoord,
            coordinate: selectedSlotCoord,
            status: slotForm.status,
            lotNumber: (slotForm.lotNumber || "").trim() || undefined,
            entryDate: slotForm.entryDate || undefined,
            expirationDate: slotForm.expirationDate || undefined,
            optionalExitDate: slotForm.optionalExitDate || undefined,
            notes: (slotForm.notes || "").trim() || undefined,
            materials: [],
            lastAuditAt: new Date().toISOString(),
          } as WarehouseSlot;
        } else {
          delete nextOverrides[selectedSlotCoord];
        }

        // El slot dejó de estar ocupado por sus productos anteriores: reconciliar para que
        // esos productos pierdan la cantidad de ESTE slot pero mantengan la de otros slots.
        await reconcileHubProductStock(previousProductIds, nextOverrides);
      }

      await persistSlotOverrides(nextOverrides);
      toast({ title: "Ubicación Actualizada" });
      setSlotMaterials([]);
      setSelectedSlotCoord(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar", description: (e as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearSlot = async () => {
    if (!tenantId || !selectedHubId || !selectedSlotCoord) {
      toast({ variant: "destructive", title: "Error al borrar", description: "No se pudo identificar la sede o el slot seleccionado. Recargá la página e intentá de nuevo." });
      return;
    }
    setIsSaving(true);
    try {
      const currentOccupant = assignedSlots[selectedSlotCoord];

      const productIds = Array.from(new Set([
        ...(currentOccupant?.materials || []).map((item) => item.productId),
        currentOccupant?.productId,
      ].filter(Boolean) as string[]));

      const nextOverrides = { ...slotOverrides };
      delete nextOverrides[selectedSlotCoord];

      // Reconcilia con el estado final (sin este slot) para que los productos que lo
      // ocupaban mantengan la suma correcta de sus OTROS slots en el mismo hub.
      await reconcileHubProductStock(productIds, nextOverrides);

      await persistSlotOverrides(nextOverrides);
      toast({ title: "Ubicación Liberada" });
      setSlotMaterials([]);
      setSelectedSlotCoord(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al borrar", description: (e as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const prefix = configForm.prefix || activeHub?.name.substring(0, 5).toUpperCase() || "DEPO";

  if (!tenantId || loading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sedes')} className="rounded-full bg-white shadow-sm border">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Mapa de Racks Virtual</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control Visual de Estanterías • {activeHub?.name || 'Cargando...'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="h-10 rounded-xl font-bold text-[10px] uppercase border-slate-200" onClick={() => setIsConfigOpen(true)}>
             <Settings2 size={14} className="mr-2 text-blue-600" /> Configurar Estructura
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Capacidad Técnica</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.total}</p>
               </div>
               <LayoutGrid size={24} className="text-slate-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-green-600 uppercase">Disponibles</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.available}</p>
               </div>
               <CheckCircle2 size={24} className="text-green-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-blue-600">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-blue-600 uppercase">Ocupados</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.occupied}</p>
               </div>
               <Container size={24} className="text-blue-100" />
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm bg-white border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-bold text-red-600 uppercase">Bloqueados</p>
                 <p className="text-2xl font-black italic text-slate-900">{stats.blocked}</p>
               </div>
               <XCircle size={24} className="text-red-100" />
            </CardContent>
         </Card>
      </div>

      <div className="space-y-12">
        {displayRacks.map(rackGroup => (
          <div key={rackGroup.corridor} className="space-y-6">
             <div className="flex items-center gap-4 px-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xl italic tracking-tighter">
                   {rackGroup.corridor}
                </div>
                <div>
                   <h3 className="text-lg font-black text-slate-800 uppercase italic leading-none tracking-tight">Corredor {rackGroup.corridor}</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cuerpos de estantería pesada</p>
                </div>
             </div>

             <div className="overflow-x-auto pb-6">
                <div className="inline-flex flex-col min-w-full bg-slate-200/20 p-8 rounded-[3rem] border border-slate-100">
                   {rackGroup.levels.map(level => (
                     <div key={level} className="flex items-end">
                        <div className="w-16 h-32 flex items-center justify-center border-r-4 border-slate-300 pr-4">
                           <p className="text-[10px] font-black text-slate-400 uppercase -rotate-90 whitespace-nowrap">NIVEL {level}</p>
                        </div>
                        {rackGroup.positions.map(pos => {
                           const coord = `${prefix}-${rackGroup.corridor}-${pos}-${level}`;
                           const slot = assignedSlots[coord];
                           const product = slot?.productId ? products?.find(p => p.id === slot.productId) : null;
                           return (
                             <div key={pos} className="w-48">
                                <RackSlot 
                                  coordinate={coord}
                                  status={slot?.status || 'empty'}
                                  product={product}
                                  onClick={() => handleOpenSlot(coord)}
                                />
                             </div>
                           );
                        })}
                        <div className="w-1 h-32 bg-orange-500"></div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedSlotCoord} onOpenChange={(o) => !o && setSelectedSlotCoord(null)}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col">
           <div className="bg-slate-900 text-white p-8 pb-6 shrink-0">
              <DialogHeader>
                 <div className="flex justify-between items-start">
                   <div>
                      <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Ubicación {selectedSlotCoord}</DialogTitle>
                      <DialogDescription className="text-white/40 text-[10px] font-bold uppercase mt-1">Gestión de status y trazabilidad del slot.</DialogDescription>
                   </div>
                 </div>
              </DialogHeader>
           </div>
           
           <div className="p-8 space-y-6 bg-slate-50 overflow-y-auto min-h-0 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Estado</Label>
                  <Select value={slotForm.status} onValueChange={(v: any) => {
                    setSlotForm({...slotForm, status: v, ...(v !== 'occupied' ? { productId: "", productSku: "", productName: "" } : {})});
                    if (v !== 'occupied') {
                      setSlotMaterials([]);
                      setMaterialDraft((prev) => ({ ...prev, productId: "", quantityUnits: 0 }));
                    }
                  }}>
                       <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="empty">🟢 Disponible</SelectItem>
                          <SelectItem value="occupied">🔵 Ocupado</SelectItem>
                          <SelectItem value="reserved">🟡 Reservado</SelectItem>
                          <SelectItem value="blocked">🔴 Bloqueado</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Capacidad del slot (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="bg-white"
                      value={slotForm.capacityKg ?? 1000}
                      onChange={(e) => setSlotForm({ ...slotForm, capacityKg: Number(e.target.value || 0) })}
                    />
                 </div>
              </div>

              <Card className="border border-blue-100 shadow-none bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-700">Agregar material al contenedor</CardTitle>
                  <CardDescription>Cada slot puede contener múltiples materiales con lote y fechas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Material</Label>
                      <Select value={materialDraft.productId || ""} onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        setMaterialDraft({
                          ...materialDraft,
                          productId: v,
                          productSku: p?.sku || "",
                          productName: p?.name || "",
                          quantityUnits: materialDraft.quantityUnits || p?.stockQuantity || 0,
                        });
                        setSlotForm({ ...slotForm, status: 'occupied' });
                      }}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                        <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cantidad (u.)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="bg-white"
                        value={materialDraft.quantityUnits ?? 0}
                        onChange={(e) => setMaterialDraft({ ...materialDraft, quantityUnits: Number(e.target.value || 0) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Lote</Label>
                      <Input
                        className="bg-white"
                        placeholder="Ej: LT-2408-A"
                        value={materialDraft.lotNumber || ""}
                        onChange={(e) => setMaterialDraft({ ...materialDraft, lotNumber: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vencimiento</Label>
                      <Input
                        type="date"
                        className="bg-white"
                        value={materialDraft.expirationDate || ""}
                        onChange={(e) => setMaterialDraft({ ...materialDraft, expirationDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha de entrada</Label>
                      <Input
                        type="date"
                        className="bg-white"
                        value={materialDraft.entryDate || ""}
                        onChange={(e) => setMaterialDraft({ ...materialDraft, entryDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha de salida (opcional)</Label>
                      <Input
                        type="date"
                        className="bg-white"
                        value={materialDraft.optionalExitDate || ""}
                        onChange={(e) => setMaterialDraft({ ...materialDraft, optionalExitDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button type="button" variant="outline" className="w-full border-blue-200 text-blue-700" onClick={handleAddMaterial} disabled={slotForm.status !== 'occupied'}>
                    <Plus size={14} className="mr-2" /> Agregar material al slot
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observaciones generales del slot</Label>
                <Textarea
                  className="bg-white min-h-[80px]"
                  placeholder="Ej: prioridad de picking, manipulación especial, control FEFO"
                  value={slotForm.notes || ""}
                  onChange={(e) => setSlotForm({ ...slotForm, notes: e.target.value })}
                />
              </div>

              <Card className="border border-slate-300 shadow-none bg-white overflow-hidden">
                <CardHeader className="pb-2 bg-slate-900 text-white">
                  <CardTitle className="text-sm font-black uppercase tracking-widest">Etiqueta simulada de caja contenedora</CardTitle>
                  <CardDescription className="text-slate-300">Vista rápida para operación y trazabilidad.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border p-2"><p className="font-black text-slate-500 uppercase">Ubicación</p><p className="font-mono font-bold text-slate-900">{selectedSlotCoord || '-'}</p></div>
                    <div className="rounded-lg border p-2"><p className="font-black text-slate-500 uppercase">Estado</p><p className="font-bold text-slate-900 uppercase">{slotForm.status || 'empty'}</p></div>
                    <div className="rounded-lg border p-2"><p className="font-black text-slate-500 uppercase">Materiales</p><p className="font-bold text-slate-900">{slotMaterials.length}</p></div>
                    <div className="rounded-lg border p-2"><p className="font-black text-slate-500 uppercase">Cantidad total</p><p className="font-bold text-slate-900">{slotMaterials.reduce((sum, item) => sum + Number(item.quantityUnits || 0), 0).toLocaleString()} u.</p></div>
                  </div>

                  <div className="space-y-2">
                    {slotMaterials.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">Sin materiales cargados</div>
                    ) : (
                      slotMaterials.map((item, idx) => (
                        <div key={`${item.productId}-${item.lotNumber || 'NL'}-${idx}`} className="rounded-xl border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-slate-900 text-sm">{item.productName}</p>
                              <p className="text-[10px] font-mono text-slate-500">SKU: {item.productSku}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveMaterial(idx)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
                            <div><p className="font-black text-slate-500 uppercase">Cantidad</p><p className="font-bold">{item.quantityUnits} u.</p></div>
                            <div><p className="font-black text-slate-500 uppercase">Lote</p><p className="font-bold">{item.lotNumber || 'N/I'}</p></div>
                            <div><p className="font-black text-slate-500 uppercase">Entrada</p><p className="font-bold">{item.entryDate ? format(new Date(item.entryDate), 'dd/MM/yyyy') : 'N/I'}</p></div>
                            <div><p className="font-black text-slate-500 uppercase">Vencimiento</p><p className="font-bold">{item.expirationDate ? format(new Date(item.expirationDate), 'dd/MM/yyyy') : 'N/I'}</p></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
           </div>

           <div className="p-6 bg-white border-t flex justify-between shrink-0">
              <Button variant="outline" className="text-red-600" onClick={handleClearSlot}><Trash2 size={16} className="mr-2" /> LIBERAR</Button>
              <div className="flex gap-2">
                 <Button variant="ghost" onClick={() => setSelectedSlotCoord(null)}>CANCELAR</Button>
                 <Button onClick={handleSaveSlot} disabled={isSaving} className="bg-blue-600">
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />} GUARDAR
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="rounded-[2.5rem]">
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic">Configuración de Racks</DialogTitle>
           </DialogHeader>
           <div className="space-y-6 py-6">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase">Pasillos (Ej: A,B,C)</Label>
                 <Input value={configForm.corridors} onChange={e => setConfigForm({...configForm, corridors: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Cuerpos</Label><Input type="number" value={configForm.positions} onChange={e => setConfigForm({...configForm, positions: parseInt(e.target.value) || 0})} /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Niveles</Label><Input type="number" value={configForm.levels} onChange={e => setConfigForm({...configForm, levels: parseInt(e.target.value) || 0})} /></div>
              </div>
           </div>
           <DialogFooter>
              <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveConfig} className="bg-blue-600">GUARDAR ESTRUCTURA</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WarehouseLayoutPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}>
      <LayoutContent />
    </Suspense>
  );
}
