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
  BarChart3,
  ArrowUpRight,
  Truck as TruckIcon,
  Scale,
  TrendingDown,
  User,
  Users,
  Briefcase,
  Navigation
} from "lucide-react";
import { Load, Expense, Maintenance, Truck, Driver, Client } from "@/app/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Componente para renderizar la foto y datos del camión en el eje X
const CustomXAxisTick = (props: any) => {
  const { x, y, payload, data } = props;
  const truck = data.find((d: any) => d.name === payload.value);

  if (!truck) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      {truck.avatar && (
        <>
          <defs>
            <clipPath id={`clip-${truck.id}`}>
              <rect x="-12" y="5" width="24" height="24" rx="4" />
            </clipPath>
          </defs>
          <image
            x="-12"
            y="5"
            width="24"
            height="24"
            href={truck.avatar}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#clip-${truck.id})`}
          />
        </>
      )}
      <text
        x="0"
        y={truck.avatar ? 42 : 15}
        textAnchor="middle"
        fill="#1e293b"
        fontSize={10}
        fontWeight="800"
        className="font-mono"
      >
        {truck.name}
      </text>
      <text
        x="0"
        y={truck.avatar ? 52 : 25}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={8}
        fontWeight="bold"
        className="uppercase"
      >
        {truck.brand} {truck.model}
      </text>
    </g>
  );
};

// Componente para renderizar la foto del chofer en el eje X
const DriverXAxisTick = (props: any) => {
  const { x, y, payload, data } = props;
  const driver = data.find((d: any) => d.name === payload.value);

  if (!driver) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      {driver.avatar && (
        <>
          <defs>
            <clipPath id={`clip-dr-${driver.id}`}>
              <circle cx="0" cy="17" r="12" />
            </clipPath>
          </defs>
          <image
            x="-12"
            y="5"
            width="24"
            height="24"
            href={driver.avatar}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#clip-dr-${driver.id})`}
          />
        </>
      )}
      <text
        x="0"
        y={driver.avatar ? 42 : 15}
        textAnchor="middle"
        fill="#1e293b"
        fontSize={10}
        fontWeight="800"
      >
        {driver.name}
      </text>
    </g>
  );
};

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

  const driversQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "drivers");
  }, [db]);

  const clientsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, "clients");
  }, [db]);

  const { data: loads, loading: loadsLoading } = useCollection<Load>(loadsQuery);
  const { data: expenses } = useCollection<Expense>(expensesQuery);
  const { data: maintenance } = useCollection<Maintenance>(maintenanceQuery);
  const { data: trucks } = useCollection<Truck>(trucksQuery);
  const { data: drivers } = useCollection<Driver>(driversQuery);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const fleetData = useMemo(() => {
    if (!trucks) return [];

    return trucks.map(truck => {
      const truckLoads = loads?.filter(l => l.assignedTruckId === truck.id && l.status === 'delivered') || [];
      const revenue = truckLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      
      const truckExpenses = expenses?.filter(e => e.truckId === truck.id) || [];
      const fuelCost = truckExpenses.filter(e => e.category === 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
      const otherRouteCosts = truckExpenses.filter(e => e.category !== 'fuel').reduce((acc, e) => acc + (e.amount || 0), 0);
      
      const truckMaintenance = maintenance?.filter(m => m.truckId === truck.id && m.status === 'completed') || [];
      const maintenanceCost = truckMaintenance.reduce((acc, m) => acc + (m.actualCost || m.estimatedCost || 0), 0);
      
      const fixedCosts = truck.costs?.fixed ? Object.values(truck.costs.fixed).reduce((acc, val) => acc + (val as number), 0) : 0;
      
      const totalVariableCosts = fuelCost + otherRouteCosts + maintenanceCost;
      const totalCosts = totalVariableCosts + fixedCosts;
      
      const ie = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : (revenue > 0 ? 100 : 0);
      const kmEnPeriodo = truckLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0) || 1;
      
      return {
        id: truck.id,
        name: truck.plate,
        brand: truck.brand,
        model: truck.model,
        avatar: truck.avatarUrl,
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

  const driversPerformance = useMemo(() => {
    if (!drivers || !loads) return [];
    // Filtrar solo conductores profesionales para el ranking (excluir acompañantes)
    return drivers
      .filter(d => d.role === 'driver')
      .map(driver => {
        const driverLoads = loads.filter(l => l.assignedDriverId === driver.id && l.status === 'delivered');
        const totalKm = driverLoads.reduce((acc, l) => acc + (l.tracking?.distanceTraveledKm || 0), 0);
        return {
          id: driver.id,
          name: `${driver.lastName}, ${driver.firstName[0]}.`,
          avatar: driver.avatarUrl,
          km: Math.round(totalKm),
          trips: driverLoads.length
        };
      })
      .sort((a, b) => b.km - a.km)
      .slice(0, 10);
  }, [drivers, loads]);

  const clientsRevenue = useMemo(() => {
    if (!clients || !loads) return [];
    return clients.map(client => {
      const clientLoads = loads.filter(l => l.clientId === client.id && l.status === 'delivered');
      const revenue = clientLoads.reduce((acc, l) => acc + (l.totalAmount || 0), 0);
      return {
        id: client.id,
        name: client.name,
        revenue: revenue,
        trips: clientLoads.length
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [clients, loads]);

  const globalStats = useMemo(() => {
    const revenue = fleetData.reduce((acc, d) => acc + d.revenue, 0);
    const costs = fleetData.reduce((acc, d) => acc + d.totalCosts, 0);
    const margin = revenue - costs;
    const totalFixed = fleetData.reduce((acc, d) => acc + d.fixedCosts, 0);

    return {
      revenue,
      costs,
      margin,
      totalFixed,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0
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
              <ArrowUpRight size={12} /> {globalStats.margin.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })} ganancia real
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-none bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase font-bold opacity-70">Líderes de Ruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-400">{driversPerformance[0]?.name || 'S/D'}</div>
            <p className="text-[10px] mt-1 opacity-80 flex items-center gap-1">
              <Navigation size={12} /> {driversPerformance[0]?.km.toLocaleString()} KM recorridos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Facturación vs Costos */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" /> Facturación vs. Costos Totales
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Comparativa de ingresos y egresos por camión</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fleetData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" tick={<CustomXAxisTick data={fleetData} />} axisLine={false} tickLine={false} />
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
                              <span className="text-slate-400 font-bold">MARGEN:</span>
                              <span className="font-bold text-blue-600">${data.margin.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingBottom: '20px' }} />
                <Bar name="Facturación" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="Costos Totales" dataKey="totalCosts" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Rendimiento de Choferes */}
        <Card className="border-none shadow-sm overflow-hidden bg-slate-50/50">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> Ranking de Choferes por KM
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Kilometraje total acumulado por conductor profesional</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driversPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" tick={<DriverXAxisTick data={driversPerformance} />} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => `${value} KM`} />
                <Tooltip 
                   cursor={{fill: '#f1f5f9'}}
                   content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl space-y-1">
                          <p className="text-xs font-bold">{data.name}</p>
                          <p className="text-lg font-black text-blue-400">{data.km.toLocaleString()} KM</p>
                          <p className="text-[10px] opacity-50 uppercase">{data.trips} viajes finalizados</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar name="KM Recorridos" dataKey="km" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Facturación por Cliente */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-green-600" /> Facturación por Cliente / Destino
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Ingresos generados por cuenta de cliente</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientsRevenue} layout="vertical" margin={{ top: 5, right: 50, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} width={90} />
                <Tooltip 
                   formatter={(value: any) => [`$${value.toLocaleString()}`, "Facturación"]}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumen Global de Margen */}
        <Card className="border-none shadow-sm overflow-hidden bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-400" /> Balance Operativo Global
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="flex justify-between items-end border-b border-white/10 pb-4">
                <div>
                   <p className="text-[10px] uppercase font-bold text-white/40">Total Ingresos</p>
                   <p className="text-2xl font-black text-green-400">${globalStats.revenue.toLocaleString()}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] uppercase font-bold text-white/40">Total Egresos</p>
                   <p className="text-2xl font-black text-red-400">${globalStats.costs.toLocaleString()}</p>
                </div>
             </div>
             <div className="text-center pt-2">
                <p className="text-[10px] uppercase font-bold text-white/40 mb-1">Utilidad Neta Estimada</p>
                <p className="text-5xl font-black italic text-blue-400">${globalStats.margin.toLocaleString()}</p>
                <Badge className="mt-4 bg-blue-500/20 text-blue-400 border-blue-500/30 text-lg py-1 px-4">
                   {globalStats.marginPercent.toFixed(1)}% Margen Promedio
                </Badge>
             </div>
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
