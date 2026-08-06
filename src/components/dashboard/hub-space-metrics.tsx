'use client';

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Hub, Product, WarehouseSlot } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, LayoutGrid, Container } from "lucide-react";

/**
 * Componente para cargar métricas de ocupación real de una sede.
 * Aislado en su propio archivo para que recharts se cargue en un chunk separado (lazy).
 */
export function HubSpaceMetrics({ hub, products }: { hub: Hub, products: Product[] | undefined }) {
  const config = hub.settings?.layoutConfig;
  const totalSlots = config ? (config.corridors?.length || 1) * (config.positions || 1) * (config.levels || 1) : 32;

  // Reconciliamos el estado real de los slots: primero los overrides guardados desde el Mapa de Racks
  // (incluye bloqueados/reservados) y como fallback la ubicación cargada directamente en la ficha del producto.
  const assignedSlots = useMemo(() => {
    const map: Record<string, WarehouseSlot> = { ...(((hub.settings as any)?.slotOverrides as Record<string, WarehouseSlot>) || {}) };
    (products || []).forEach((product) => {
      (product.warehouses || []).forEach((warehouse) => {
        if (warehouse.hubId !== hub.id || !warehouse.location) return;
        const persisted = map[warehouse.location];
        if (persisted && persisted.status === 'occupied') return;
        map[warehouse.location] = {
          ...(persisted || {}),
          id: warehouse.location,
          coordinate: warehouse.location,
          productId: product.id,
          status: 'occupied',
        } as WarehouseSlot;
      });
    });
    return map;
  }, [(hub.settings as any)?.slotOverrides, products, hub.id]);

  const occupiedSlots = useMemo(
    () => Object.values(assignedSlots).filter((s) => s.status === 'occupied').length,
    [assignedSlots]
  );

  const blockedSlots = useMemo(
    () => Object.values(assignedSlots).filter((s) => s.status === 'blocked' || s.status === 'reserved').length,
    [assignedSlots]
  );

  const currentStockUnits = useMemo(() => {
    return products?.reduce((acc, p) => {
       const wh = p.warehouses?.find(w => w.hubId === hub.id);
       return acc + (wh?.stockQuantity || 0);
    }, 0) || 0;
  }, [products, hub.id]);

  const occupiedPercent = Math.min(100, Math.round((occupiedSlots / totalSlots) * 100));
  const pieData = [{ value: occupiedPercent }, { value: 100 - occupiedPercent }];

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between gap-6">
          <div className="flex-1 space-y-4">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ocupación Física</p>
                <div className="flex items-end gap-2">
                   <p className="text-4xl font-black text-slate-900 italic leading-none">{occupiedPercent}%</p>
                   <Badge className="bg-blue-50 text-blue-700 border-none text-[9px] mb-1">CAPACIDAD</Badge>
                </div>
             </div>
             <div className="space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Estado Almacén</p>
                <p className={cn(
                  "text-xs font-black uppercase flex items-center gap-1",
                  occupiedPercent > 90 ? "text-red-600" : "text-green-600"
                )}>
                  {occupiedPercent > 90 ? <AlertTriangle size={12}/> : <CheckCircle2 size={12}/>}
                  {occupiedPercent > 90 ? 'Saturación Crítica' : 'Operación Normal'}
                </p>
             </div>
          </div>
          <div className="h-28 w-28 shrink-0">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                   <Pie data={pieData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                      <Cell fill={occupiedPercent > 90 ? "#ef4444" : "#2563eb"} />
                      <Cell fill="#f1f5f9" />
                   </Pie>
                </PieChart>
             </ResponsiveContainer>
          </div>
       </div>

       <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
          <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">
             <span>Métricas de Espacio (Racks)</span>
             <LayoutGrid size={12} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
             <div>
                <p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">Slots Totales</p>
                <p className="text-base font-black text-slate-900 italic leading-none">{totalSlots}</p>
             </div>
             <div className="border-x border-slate-200">
                <p className="text-[7px] font-bold text-blue-500 uppercase mb-0.5">Uso (Físico)</p>
                <p className="text-base font-black text-blue-600 italic leading-none">{occupiedSlots}</p>
             </div>
             <div>
                <p className="text-[7px] font-bold text-green-500 uppercase mb-0.5">Libre</p>
                <p className="text-base font-black text-green-600 italic leading-none">{Math.max(0, totalSlots - occupiedSlots - blockedSlots)}</p>
             </div>
          </div>
       </div>

       <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex justify-between items-center">
          <div className="flex items-center gap-2">
             <Container size={16} className="text-blue-600" />
             <span className="text-[9px] font-black text-blue-800 uppercase">Stock Consolidado:</span>
          </div>
          <span className="text-sm font-black text-blue-900">{currentStockUnits.toLocaleString()} UNIDADES</span>
       </div>
    </div>
  );
}
