'use client';

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, Truck, Package, Activity, 
  History, ShieldCheck, Phone, 
  MapPin, Loader2, Award,
  FileText, Upload, Camera, CheckCircle2,
  Save, Smartphone, BarChart3, Star, RefreshCw
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
import { format, parseISO, subMonths, isSameMonth, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/utils/image-compression";
import { cn } from "@/lib/utils";
import { listDrivers, updateDriver } from "@/lib/drivers-api";
import { listLoads } from "@/lib/loads-api";

export default function DriverSelfProfilePage() {
  const router = useRouter();
  const { tenantId, uid } = useTenant();
  const { user } = useUser();
  const { toast } = useToast();

  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [trips, setTrips] = useState<Load[]>([]);
  const [driverLoading, setDriverLoading] = useState(true);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [myDriverId, setMyDriverId] = useState<string | null>(null);

  const licFRef = useRef<HTMLInputElement>(null);
  const licBRef = useRef<HTMLInputElement>(null);
  const lintiRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!tenantId || !uid) {
        if (active) {
          setDriver(null);
          setTrips([]);
          setDriverLoading(false);
          setTripsLoading(false);
        }
        return;
      }

      try {
        if (active) {
          setDriverLoading(true);
          setTripsLoading(true);
        }

        const [driversData, allLoads] = await Promise.all([listDrivers(), listLoads()]);
        if (!active) return;

        // Resolvemos el Driver real por email: el uid de Firebase no coincide con el id del Driver en Prisma.
        const myEmail = user?.email?.toLowerCase().trim();
        const myDriver = myEmail ? driversData.find((d) => d.email?.toLowerCase().trim() === myEmail) : null;

        setMyDriverId(myDriver?.id || null);
        setDriver(myDriver || null);
        setTrips(myDriver ? allLoads.filter((load) => load.assignedDriverId === myDriver.id) : []);
      } catch {
        if (!active) return;
        setDriver(null);
        setTrips([]);
      } finally {
        if (active) {
          setDriverLoading(false);
          setTripsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [tenantId, uid, user?.email]);

  const stats = useMemo(() => {
    if (!trips) return { totalKm: 0, totalTrips: 0, chartData: [] };
    const totalKm = trips.reduce((acc, t) => acc + (t.tracking?.distanceTraveledKm || 0), 0);
    
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push({ name: format(d, "MMM", { locale: es }).toUpperCase(), date: d, km: 0 });
    }

    trips.forEach(trip => {
      const tripDate = trip.createdAt?.toDate ? trip.createdAt.toDate() : parseISO(trip.createdAt);
      const monthIndex = months.findIndex(m => isSameMonth(m.date, tripDate));
      if (monthIndex !== -1) months[monthIndex].km += (trip.tracking?.distanceTraveledKm || 0);
    });

    return { totalKm, totalTrips: trips.length, chartData: months };
  }, [trips]);

  const handleUpdateField = async (field: keyof Driver, value: any) => {
    if (!driver || !myDriverId) return;
    try {
      const updated = await updateDriver(myDriverId, { [field]: value, updatedAt: new Date().toISOString() } as any);
      setDriver(updated);
      toast({ title: "Datos actualizados" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myDriverId || !driver) return;

    setIsUploading(key);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const compressed = await compressImage(base64);
        const updated = await updateDriver(myDriverId, { [key]: compressed, updatedAt: new Date().toISOString() } as any);
        setDriver(updated);
        toast({ title: "Documento actualizado" });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al procesar" });
      } finally {
        setIsUploading(null);
      }
    };
    reader.readAsDataURL(file);
  };

  if (driverLoading || tripsLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!driver) return <div className="p-20 text-center text-slate-400">Su perfil de conductor no se encuentra en esta organización.</div>;

  const getExpiryBadge = (dateStr?: string) => {
    if (!dateStr) return <Badge variant="outline" className="text-[8px] h-4 uppercase">Sin fecha</Badge>;
    const days = differenceInDays(parseISO(dateStr), new Date());
    if (days < 0) return <Badge className="bg-red-600 text-white text-[8px] h-4 uppercase">Vencido</Badge>;
    if (days < 30) return <Badge className="bg-orange-500 text-white text-[8px] h-4 uppercase">Vence en {days}d</Badge>;
    return <Badge className="bg-green-600 text-white text-[8px] h-4 uppercase">Vigente</Badge>;
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32 px-2">
      <div className="flex items-center gap-4 pt-6 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border"><ArrowLeft size={18}/></Button>
        <div>
          <h1 className="text-xl font-black italic uppercase text-slate-900 leading-none">Mi Perfil</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Legajo Digital Personal</p>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-[2.5rem] relative mx-1">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Award size={80}/></div>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-blue-500">
              <AvatarImage src={driver.avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-blue-900 text-blue-400 font-bold">{driver.firstName[0]}{driver.lastName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-black italic tracking-tighter leading-none">{driver.lastName}, {driver.firstName}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-blue-600 text-[8px] h-4 font-black">CHOFER PRO</Badge>
                <div className="flex text-amber-400"><Star size={10} fill="currentColor" /><Star size={10} fill="currentColor" /><Star size={10} fill="currentColor" /></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div><p className="text-[9px] uppercase font-bold text-white/30">KM Totales</p><p className="text-2xl font-black italic text-blue-400">{Math.round(stats.totalKm).toLocaleString()}</p></div>
            <div><p className="text-[9px] uppercase font-bold text-white/30">Viajes OK</p><p className="text-2xl font-black italic">{stats.totalTrips}</p></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="docs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="docs" className="rounded-xl text-[10px] font-bold">DOCUMENTOS</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl text-[10px] font-bold">ACTIVIDAD</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-4 pt-4 px-1 animate-in fade-in">
            <Card className="border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                <CardTitle className="text-xs font-black uppercase flex items-center gap-2"><FileText size={14} className="text-blue-600"/> Licencia Nacional</CardTitle>
                {getExpiryBadge(driver.licenseExpiry)}
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label className="text-[9px] font-bold text-slate-400 uppercase">N° Licencia</Label><Input className="h-9 text-xs font-bold" value={driver.licenseNumber} onChange={e => handleUpdateField('licenseNumber', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-[9px] font-bold text-slate-400 uppercase">Vencimiento</Label><Input type="date" className="h-9 text-xs" value={driver.licenseExpiry} onChange={e => handleUpdateField('licenseExpiry', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="file" ref={licFRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('licenseFileUrl', e)} />
                  <Button variant="outline" size="sm" className="h-10 text-[9px] font-bold rounded-xl" onClick={() => licFRef.current?.click()}>
                    {isUploading === 'licenseFileUrl' ? <Loader2 className="animate-spin" /> : <Camera size={12} className="mr-2" />} FOTO FRENTE
                  </Button>
                  <input type="file" ref={licBRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('licenseBackFileUrl', e)} />
                  <Button variant="outline" size="sm" className="h-10 text-[9px] font-bold rounded-xl" onClick={() => licBRef.current?.click()}>
                    <Camera size={12} className="mr-2" /> FOTO DORSO
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
              <ShieldCheck size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 leading-relaxed italic">Su documentación es auditada por la central para habilitar la asignación de viajes internacionales.</p>
            </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 pt-4 animate-in fade-in">
           <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
             <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase flex items-center gap-2"><BarChart3 size={14} className="text-blue-600" /> KM Mensuales</CardTitle></CardHeader>
             <CardContent className="h-48 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f1f5f9'}} content={({ active, payload }) => active && payload ? <div className="bg-slate-900 text-white p-2 rounded-lg text-[10px] font-bold">{payload[0].value.toLocaleString()} KM</div> : null} />
                      <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                        {stats.chartData.map((_, i) => <Cell key={i} fill={i === 5 ? '#2563eb' : '#cbd5e1'} />)}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
             </CardContent>
           </Card>
           
           <div className="space-y-3 px-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos Viajes</p>
              {trips?.slice(0, 4).map(t => (
                <Card key={t.id} className="border-none shadow-sm rounded-2xl">
                   <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-400"><History size={18}/></div>
                        <div><p className="text-sm font-bold text-slate-800">{t.orderNumber}</p><p className="text-[9px] text-slate-400 uppercase">{t.clientName}</p></div>
                      </div>
                      <div className="text-right"><p className="text-xs font-black text-blue-600">{Math.round(t.tracking?.distanceTraveledKm || 0)} KM</p></div>
                   </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
