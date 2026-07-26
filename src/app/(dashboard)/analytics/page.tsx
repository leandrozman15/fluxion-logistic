
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Loader2,
  Activity,
  Package,
  CheckCircle2,
  Fuel,
  Wrench,
  AlertTriangle,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Truck as TruckIcon,
  Scale,
  Zap,
  TrendingDown
} from "lucide-react";
import { Load, Expense, Maintenance, Truck } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AnalyticsPage() {
  const db = useFirestore();
  const [range, setRange] = useState("30");

  const loadsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "loads"), orderBy("createdAt", "desc"), limit(500));
  }, [db]);

  const expensesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "global_expenses"), orderBy("createdAt", "desc"));
  }, [db]);

  const maintenanceQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "maintenance"), orderBy("scheduledDate", "desc"));
  }, [db]);

  const trucksQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "trucks");
  }, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: expenses } = useCollection<Expense>(expensesQuery);
  const { data: maintenance } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);

  const fleetData = useMemo(() => {
    if (!trucks) return [];

    return trucks.map(truck => {
      // 1. Facturación: Sumar totalAmount de fletes entregados para este camión
      const truckLoads = loads?.filter(l => l.assignedTruckId === truck.id && l.status === 'delivered') || [];
      const revenue = truckLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      
      // 2. Costos de Ruta (Combustible, Peajes, etc)
      const truckExpenses = expenses?.filter(e => e.truckId === truck.id) || [];
      const fuelCost = truckExpenses.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
      const otherRouteCosts = truckExpenses.filter(e => e.category !== 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
      
      // 3. Costos de Taller (Mantenimiento finalizado)
      const truckMaintenance = maintenance?.filter(m => m.truckId === truck.id && m.status === 'completed') || [];
      const maintenanceCost = truckMaintenance.reduce((acc, m) => acc + (m.actualCost || m.estimatedCost || 0), 0);
      
      // 4. Costos Fijos Mensuales (Cargados en la ficha técnica)
      const fixedCosts = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      
      // 5. Costos Totales Operativos (Ruta + Taller)
      const totalVariableCosts = fuelCost + otherRouteCosts + maintenanceCost;
      const totalCosts = totalVariableCosts + fixedCosts;
      
      // 6. Índice de Eficiencia (IE) = (Facturación - Costos) / Costos * 100
      const ie = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : (revenue > 0 ? 100 : 0);
      
      // 7. Kilómetros y Eficiencia KM
      const kmEnPeriodo = truckLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0) || 1;
      
      return {
        id: truck.id,
        name: truck.plate,
        revenue,
        fuelCost,
        maintenanceCost,
        fixedCosts,
        otherCosts: otherRouteCosts,
        totalCosts,
        totalVariableCosts,
        ie: parseFloat(ie.toFixed(1)),
        margin: revenue - totalCosts,
        trips: truckLoads.length,
        kmEnPeriodo
      };
    }).sort((a, b) => b.ie - a.ie);
  }, [trucks, loads, expenses, maintenance]);

  const cheapestTruck = useMemo(() => {
    if (fleetData.length === 0) return null;
    return [...fleetData].sort((a, b) => a.fixedCosts - b.fixedCosts)[0];
  }, [fleetData]);

  const globalStats = useMemo(() => {
    const revenue = fleetData.reduce((acc, d) => acc + d.revenue, 0);
    const costs = fleetData.reduce((acc, d) => acc + d.totalCosts, 0);
    const margin = revenue - costs;
    const avgIE = fleetData.length > 0 ? fleetData.reduce((acc, d) => acc + d.ie, 0) / fleetData.length : 0;
    const totalFixed = fleetData.reduce((acc, d) => acc + d.fixedCosts, 0);

    return {
      revenue,
      costs,
      margin,
      totalFixed,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
      avgIE
    };
  }, [fleetData]);

  if (loadsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  const getIEColor = (ie: number) => {
    if (ie > 30) return "text-green-600 bg-green-50 border-green-100";
    if (ie > 10) return "text-blue-600 bg-blue-50 border-blue-100";
    if (ie >= 0) return "text-orange-600 bg-orange-50 border-orange-100";
    return "text-red-600 bg-red-50 border-red-100";
  };

  const getIEIndicator = (ie: number) => {
    if (ie > 30) return "Excelente";
    if (ie > 10) return "Bueno";
    if (ie >= 0) return "Regular";
    return "Crítico";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inteligencia de Flota y Costos</h1>
          <p className="text-muted-foreground text-sm">Análisis de rentabilidad real cruzando facturación, gastos fijos y variables.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="Período de Análisis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Acumulado Anual 2025</SelectItem>
              <SelectItem value="90">Último Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard 
          title="Facturación Bruta" 
          value={globalStats.revenue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} 
          icon={TrendingUp} 
          description="Fletes entregados" 
        />
        <KPICard 
          title="Gastos Estructurales" 
          value={globalStats.totalFixed.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} 
          icon={Activity} 
          description="Sueldos, seguros, patentes" 
        />
        <Card className="shadow-none border-none bg-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-bold opacity-70">Margen Operativo (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{globalStats.marginPercent.toFixed(1)}%</div>
            <p className="text-[10px] mt-1 opacity-80 flex items-center gap-1">
              <ArrowUpRight size={12} /> {globalStats.margin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} de ganancia real
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-none bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-bold opacity-70">Líder en Bajos Costos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-400">{cheapestTruck?.name || 'S/D'}</div>
            <p className="text-[10px] mt-1 opacity-80 flex items-center gap-1">
              <TrendingDown size={12} /> ${cheapestTruck?.fixedCosts.toLocaleString()} fijos mensuales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" /> Facturación vs. Costos Totales
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Comparativa de ingresos y egresos (Fijos + Variables)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}K`} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 border rounded-xl shadow-2xl space-y-2">
                          <p className="font-black text-slate-900 border-b pb-1 uppercase">{data.name}</p>
                          <div className="space-y-1">
                            <p className="text-xs flex justify-between gap-4 font-bold text-green-600">Facturación: <span>${data.revenue.toLocaleString()}</span></p>
                            <p className="text-xs flex justify-between gap-4 font-bold text-red-600">Total Costos: <span>${data.totalCosts.toLocaleString()}</span></p>
                            <div className="pt-1 mt-1 border-t text-[10px] flex justify-between">
                              <span className="text-slate-400">EFICIENCIA:</span>
                              <span className="font-bold text-blue-600">{data.ie}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="Costos Totales" dataKey="totalCosts" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm overflow-hidden bg-slate-50/50">
          <CardHeader className="bg-white border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Scale className="w-4 h-4 text-orange-600" /> Comparativa de Gastos Fijos
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Estructura de mantenimiento fijo mensual por camión</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...fleetData].sort((a,b) => a.fixedCosts - b.fixedCosts)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar name="Costos Fijos Mensuales" dataKey="fixedCosts" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
             <TruckIcon className="text-blue-600" size={16} /> Auditoría Detallada de Rentabilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold">Camión</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-right">Fijos/Mes</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-right">Ruta (Variables)</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-right">Inversión Total</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-right">Facturación</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-center">Índice IE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleetData.map((data) => (
                <TableRow key={data.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{data.name}</span>
                      <span className="text-[9px] text-slate-400 uppercase">{data.trips} fletes finalizados</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-slate-600 font-medium">${data.fixedCosts.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-600 font-medium">${data.totalVariableCosts.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-red-600">${data.totalCosts.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">${data.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn("text-[10px] font-black min-w-[70px] justify-center", getIEColor(data.ie))}>
                      {data.ie}% {getIEIndicator(data.ie)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {fleetData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No hay datos suficientes para calcular eficiencia.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
