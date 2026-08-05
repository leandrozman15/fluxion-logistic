
'use client';

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ShoppingBag, 
  CheckCircle2, 
  Navigation, 
  Timer,
  Search,
  Loader2,
  Activity,
  User,
  XCircle,
  Route
} from "lucide-react";
import { Load, Driver } from "@/app/lib/types";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { listLoads } from "@/lib/loads-api";
import { listDrivers } from "@/lib/drivers-api";
import { format } from "date-fns";

export default function MercadoLibrePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        if (active) setLoading(true);
        const [loadRows, driverRows] = await Promise.all([
          listLoads(),
          listDrivers(),
        ]);
        if (!active) return;
        setLoads(loadRows);
        setDrivers(driverRows);
      } catch {
        if (!active) return;
        setLoads([]);
        setDrivers([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const meliLoads = useMemo(() => {
    return loads.filter(l => 
      l.serviceType === 'meli' && (
        l.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.clientName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [loads, searchTerm]);

  const stats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    // "Entregas Hoy" solo debe contar los repartos ML de la fecha actual, no todo el histórico.
    const todayLoads = meliLoads.filter(l => (l.pickupDate || "").slice(0, 10) === todayStr);

    let total = 0;
    let delivered = 0;
    let failed = 0;
    let pending = 0;
    let totalKm = 0;

    todayLoads.forEach(l => {
      totalKm += l.tracking?.distanceTraveledKm || 0;
      l.outboundStops?.forEach(s => {
        total++;
        if (s.deliveredAt) delivered++;
        else if (s.failedAt) failed++;
        else pending++;
      });
    });

    return { total, delivered, failed, pending, totalKm: Math.round(totalKm) };
  }, [meliLoads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center text-slate-900 shadow-lg shadow-yellow-100">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Central de Monitoreo ML</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control en tiempo real de repartos de última milla.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Entregas Hoy</p>
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            </div>
            <Activity className="text-blue-500 opacity-20" size={32} />
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50">
          <CardContent className="pt-4 flex items-center justify-between text-green-700">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest">Exitosas</p>
              <p className="text-2xl font-black">{stats.delivered}</p>
            </div>
            <CheckCircle2 size={32} className="opacity-20" />
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50">
          <CardContent className="pt-4 flex items-center justify-between text-red-700">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest">Fallidas</p>
              <p className="text-2xl font-black">{stats.failed}</p>
            </div>
            <XCircle size={32} className="opacity-20" />
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Pendientes</p>
              <p className="text-2xl font-black text-blue-400">{stats.pending}</p>
            </div>
            <Timer size={32} className="opacity-20" />
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-yellow-50">
          <CardContent className="pt-4 flex items-center justify-between text-yellow-800">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-60 tracking-widest">Km Recorridos Hoy</p>
              <p className="text-2xl font-black">{stats.totalKm}</p>
            </div>
            <Route size={32} className="opacity-20" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Flujos de Reparto Activos</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar flete..." 
                className="pl-9 h-10 rounded-xl text-xs" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-yellow-500" /></div>
          ) : meliLoads.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <ShoppingBag size={48} className="mx-auto text-slate-100" />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest italic">No hay actividad ML registrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase">Orden / Chofer</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Avance Reparto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Exitosas</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Fallas</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Km</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase pr-8">Monitor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meliLoads.map((load) => {
                  const driver = drivers?.find(d => d.id === load.assignedDriverId);
                  const delivered = load.outboundStops?.filter(s => !!s.deliveredAt).length || 0;
                  const total = load.outboundStops?.length || 1;
                  const failed = load.outboundStops?.filter(s => !!s.failedAt).length || 0;
                  const progress = Math.round(((delivered + failed) / total) * 100);

                  return (
                    <TableRow key={load.id} className="hover:bg-yellow-50/30 transition-all">
                      <TableCell className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-sm tracking-tighter">{load.orderNumber}</span>
                          <span className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                            <User size={10} /> {driver ? `${driver.lastName}, ${driver.firstName[0]}.` : 'S/D'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-32 space-y-1.5">
                           <div className="flex justify-between text-[8px] font-black uppercase">
                              <span>{progress}%</span>
                              <span>{delivered + failed}/{total} Puntos</span>
                           </div>
                           <Progress value={progress} className="h-1 bg-slate-100" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-black text-green-600">{delivered}</TableCell>
                      <TableCell className="text-center font-black text-red-600">{failed}</TableCell>
                      <TableCell className="text-center font-black text-slate-700">{Math.round(load.tracking?.distanceTraveledKm || 0)}</TableCell>
                      <TableCell className="pr-8 text-right">
                        <Button variant="ghost" size="icon" className="rounded-full text-blue-600" asChild>
                          <Link href={`/tracking/${load.id}`}>
                            <Navigation size={18} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
