'use client';

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, Truck, Package, Activity, 
  History, Calendar, ShieldCheck, Phone, 
  MapPin, Loader2, TrendingUp, Gauge, 
  Star, BarChart3, ChevronRight, Award
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { Load, Driver, Truck as TruckType } from "@/app/lib/types";
import Link from "next/link";
import { format, parseISO, startOfMonth, subMonths, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";

export default function DriverSelfProfilePage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();

  // En un entorno real, buscaríamos el documento del chofer que coincida con el email o uid del usuario logueado.
  // Para el prototipo, consultamos todos los choferes y tomamos el primero (o el asignado a los viajes demo).
  const driversQuery = useMemo(() => db ? query(collection(db, "drivers"), where("status", "==", "active")) : null, [db]);
  const { data: drivers, loading: driversLoading } = useCollection<Driver>(driversQuery);

  const driver = drivers?.[0]; // Mock de "Mi Perfil"

  const tripsQuery = useMemo(() => {
    if (!db || !driver) return null;
    return query(
      collection(db, "loads"),
      where("assignedDriverId", "==", driver.id)
    );
  }, [db, driver]);

  const { data: trips, loading: tripsLoading } = useCollection<Load>(tripsQuery);

  const trucksQuery = useMemo(() => {
    if (!db || !driver) return null;
    return query(collection(db, "trucks"), where("assignedDriverId", "==", driver.id));
  }, [db, driver]);

  const { data: trucks } = useCollection<TruckType>(trucksQuery);
  const assignedTruck = trucks?.[0];

  const stats = useMemo(() => {
    if (!trips) return { totalKm: 0, totalTrips: 0, chartData: [] };

    const totalKm = trips.reduce((acc, t) => acc + (t.tracking?.distanceTraveledKm || 0), 0);
    const totalTrips = trips.length;

    // Generar datos para el gráfico de los últimos 6 meses
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push({
        name: format(d, "MMM", { locale: es }).toUpperCase(),
        date: d,
        km: 0
      });
    }

    trips.forEach(trip => {
      const tripDate = trip.createdAt?.toDate ? trip.createdAt.toDate() : parseISO(trip.createdAt);
      const monthIndex = months.findIndex(m => isSameMonth(m.date, tripDate));
      if (monthIndex !== -1) {
        months[monthIndex].km += (trip.tracking?.distanceTraveledKm || 0);
      }
    });

    return { totalKm, totalTrips, chartData: months };
  }, [trips]);

  if (driversLoading || tripsLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  if (!driver) {
    return <div className="p-20 text-center">Perfil de chofer no vinculado.</div>;
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4 pt-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <h1 className="text-xl font-bold">Mi Desempeño</h1>
      </div>

      <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-3xl relative">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Award size={80}/></div>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-blue-500 shadow-md">
              <AvatarImage src={driver.avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-blue-900 text-blue-400 font-bold">{driver.firstName[0]}{driver.lastName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-black italic tracking-tighter leading-none">{driver.lastName}, {driver.firstName}</p>
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest mt-1">Chofer Profesional</p>
              <Badge className="bg-blue-600 mt-2 text-[8px] h-4 uppercase">Nivel Experto</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-bold text-white/30">KM Recorridos</p>
              <p className="text-2xl font-black italic text-blue-400">{Math.round(stats.totalKm).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-bold text-white/30">Misiones OK</p>
              <p className="text-2xl font-black italic">{stats.totalTrips}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" /> Historial Mensual (KM)
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold text-slate-400">Comparativa de actividad últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent className="h-48 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
              <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-2 rounded-lg text-[10px] font-bold shadow-xl">
                        {payload[0].value.toLocaleString()} KM
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                {stats.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 5 ? '#2563eb' : '#cbd5e1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm rounded-3xl border-l-4 border-l-blue-600">
        <CardHeader className="py-4">
          <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
            <Truck size={14} className="text-blue-600" /> Mi Unidad Habitual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignedTruck ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-mono font-bold text-blue-700 leading-none">{assignedTruck.plate}</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">{assignedTruck.brand} {assignedTruck.model}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-400 uppercase font-bold">Odómetro</p>
                <p className="text-sm font-black italic">{assignedTruck.odometerKm.toLocaleString()} KM</p>
              </div>
            </div>
          ) : (
            <p className="text-xs italic text-slate-400">Sin unidad fija asignada.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Últimos Viajes</p>
        <div className="space-y-2">
          {trips?.slice(0, 5).map(trip => (
            <Card key={trip.id} className="border-none shadow-sm rounded-2xl active:scale-[0.98] transition-transform">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border">
                    <History size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{trip.orderNumber}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-medium">{trip.clientName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-blue-600">{Math.round(trip.tracking?.distanceTraveledKm || 0)} KM</p>
                  <p className="text-[8px] text-slate-400 uppercase">{trip.pickupDate}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
         <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="text-red-500" size={18} />
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ficha Médica de Emergencia</h4>
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
               <p className="text-[8px] uppercase font-bold text-slate-400">Grupo Sanguíneo</p>
               <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 font-bold">{driver.bloodType || 'S/D'}</Badge>
            </div>
            <div className="space-y-1">
               <p className="text-[8px] uppercase font-bold text-slate-400">Contacto</p>
               <p className="text-[11px] font-bold text-slate-700">{driver.emergencyContact || 'S/D'}</p>
               <p className="text-[10px] text-blue-600 font-mono">{driver.emergencyPhone || '-'}</p>
            </div>
         </div>
      </div>
    </div>
  );
}
