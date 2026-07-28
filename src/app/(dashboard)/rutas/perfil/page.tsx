'use client';

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFirestore, useCollection, useUser, useDoc } from "@/firebase";
import { collection, query, where, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, Truck, Package, Activity, 
  History, Calendar, ShieldCheck, Phone, 
  MapPin, Loader2, TrendingUp, Gauge, 
  Star, BarChart3, ChevronRight, Award,
  FileText, Upload, Camera, CheckCircle2,
  AlertTriangle, Save, RefreshCw, Smartphone
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
import { format, parseISO, startOfMonth, subMonths, isSameMonth, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/utils/image-compression";
import { cn } from "@/lib/utils";

export default function DriverSelfProfilePage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  // Refs para inputs de archivos
  const dniFRef = useRef<HTMLInputElement>(null);
  const dniBRef = useRef<HTMLInputElement>(null);
  const licFRef = useRef<HTMLInputElement>(null);
  const licBRef = useRef<HTMLInputElement>(null);
  const lintiRef = useRef<HTMLInputElement>(null);

  // Para el prototipo, tomamos el primer chofer activo que coincida con el demo
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

  const handleUpdateField = async (field: keyof Driver, value: any) => {
    if (!db || !driver) return;
    try {
      await updateDoc(doc(db, "drivers", driver.id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Dato actualizado", description: "La central ya recibió tus cambios." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const onFileChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !driver) return;

    setIsUploading(key);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const compressed = await compressImage(base64, 1024, 1024, 0.7);
        await updateDoc(doc(db, "drivers", driver.id), {
          [key]: compressed,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Foto cargada!", description: "Documento digitalizado correctamente." });
      } catch (err) {
        toast({ variant: "destructive", title: "Error al procesar foto" });
      } finally {
        setIsUploading(null);
      }
    };
    reader.readAsDataURL(file);
  };

  if (driversLoading || tripsLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  if (!driver) {
    return <div className="p-20 text-center">Perfil de chofer no vinculado.</div>;
  }

  const getExpiryBadge = (dateStr?: string) => {
    if (!dateStr) return <Badge variant="outline" className="text-[8px] h-3 uppercase">Sin fecha</Badge>;
    const days = differenceInDays(parseISO(dateStr), new Date());
    if (days < 0) return <Badge className="bg-red-600 text-[8px] h-4 uppercase">Vencido</Badge>;
    if (days < 30) return <Badge className="bg-orange-500 text-[8px] h-4 uppercase">Vence en {days}d</Badge>;
    return <Badge className="bg-green-600 text-[8px] h-4 uppercase">Vigente</Badge>;
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-32 px-2">
      <div className="flex items-center gap-4 pt-6 px-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border border-slate-100">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Mi Cuenta</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Legajo Digital Personal</p>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden rounded-[2.5rem] relative mx-1">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Award size={80}/></div>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-blue-500 shadow-md">
              <AvatarImage src={driver.avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-blue-900 text-blue-400 font-bold">{driver.firstName[0]}{driver.lastName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-black italic tracking-tighter leading-none">{driver.lastName}, {driver.firstName}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-blue-600 text-[8px] h-4 uppercase tracking-tighter">Nivel Experto</Badge>
                <div className="flex text-amber-400">
                  <Star size={10} fill="currentColor" />
                  <Star size={10} fill="currentColor" />
                  <Star size={10} fill="currentColor" />
                  <Star size={10} fill="currentColor" />
                  <Star size={10} fill="currentColor" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-bold text-white/30 tracking-widest">KM Conducidos</p>
              <p className="text-2xl font-black italic text-blue-400 leading-none">{Math.round(stats.totalKm).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-bold text-white/30 tracking-widest">Fletes OK</p>
              <p className="text-2xl font-black italic leading-none">{stats.totalTrips}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="docs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="docs" className="rounded-xl text-[10px] uppercase font-bold flex items-center gap-2">
            <FileText size={14} /> Documentos
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl text-[10px] uppercase font-bold flex items-center gap-2">
            <Activity size={14} /> Actividad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-1 space-y-4">
            
            {/* CARD LICENCIA */}
            <Card className="border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                  <FileText size={14} className="text-blue-600" /> Licencia Nacional
                </CardTitle>
                {getExpiryBadge(driver.licenseExpiry)}
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-slate-400">N° de Licencia</Label>
                    <Input 
                      className="h-9 text-xs font-bold bg-slate-50 rounded-lg border-none"
                      value={driver.licenseNumber} 
                      onChange={e => handleUpdateField('licenseNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-slate-400">Vencimiento</Label>
                    <Input 
                      type="date"
                      className="h-9 text-xs bg-slate-50 rounded-lg border-none"
                      value={driver.licenseExpiry} 
                      onChange={e => handleUpdateField('licenseExpiry', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <input type="file" ref={licFRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('licenseFileUrl', e)} />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn("h-10 text-[9px] font-bold rounded-xl", driver.licenseFileUrl ? "text-green-600 border-green-100 bg-green-50" : "")}
                    onClick={() => licFRef.current?.click()}
                  >
                    {isUploading === 'licenseFileUrl' ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} className="mr-2" />}
                    FOTO FRENTE
                  </Button>
                  
                  <input type="file" ref={licBRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('licenseBackFileUrl', e)} />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn("h-10 text-[9px] font-bold rounded-xl", driver.licenseBackFileUrl ? "text-green-600 border-green-100 bg-green-50" : "")}
                    onClick={() => licBRef.current?.click()}
                  >
                    {isUploading === 'licenseBackFileUrl' ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} className="mr-2" />}
                    FOTO DORSO
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CARD LINTI */}
            <Card className="border-2 border-orange-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-orange-50 py-3 flex flex-row items-center justify-between border-b border-orange-100">
                <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-orange-700">
                  <ShieldCheck size={14} className="text-orange-600" /> Habilitación LINTI
                </CardTitle>
                {getExpiryBadge(driver.lintiExpiry)}
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-orange-400">N° Tramite LINTI</Label>
                    <Input 
                      className="h-9 text-xs font-bold bg-orange-50/30 rounded-lg border-none"
                      value={driver.lintiNumber || ''} 
                      onChange={e => handleUpdateField('lintiNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold text-orange-400">Vencimiento</Label>
                    <Input 
                      type="date"
                      className="h-9 text-xs bg-orange-50/30 rounded-lg border-none"
                      value={driver.lintiExpiry || ''} 
                      onChange={e => handleUpdateField('lintiExpiry', e.target.value)}
                    />
                  </div>
                </div>
                
                <input type="file" ref={lintiRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('lintiFileUrl', e)} />
                <Button 
                  variant="outline" 
                  className={cn("w-full h-12 text-[10px] font-black uppercase rounded-xl border-orange-200 text-orange-600", driver.lintiFileUrl ? "bg-orange-100" : "bg-white")}
                  onClick={() => lintiRef.current?.click()}
                >
                  {isUploading === 'lintiFileUrl' ? <Loader2 size={14} className="animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
                  {driver.lintiFileUrl ? 'CAMBIAR FOTO LINTI' : 'SUBIR FOTO LINTI'}
                </Button>
              </CardContent>
            </Card>

            {/* CARD DNI */}
            <Card className="border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-slate-50 py-3 border-b">
                <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                  <Smartphone size={14} className="text-slate-400" /> Identidad (DNI)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase font-bold text-slate-400">Número de DNI</Label>
                  <Input 
                    className="h-9 text-xs font-bold bg-slate-50 rounded-lg border-none"
                    value={driver.dni} 
                    onChange={e => handleUpdateField('dni', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="file" ref={dniFRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('dniFileUrl', e)} />
                  <Button variant="outline" size="sm" className="h-10 text-[9px] font-bold rounded-xl" onClick={() => dniFRef.current?.click()}>
                    <Camera size={12} className="mr-2" /> FRENTE DNI
                  </Button>
                  <input type="file" ref={dniBRef} className="hidden" accept="image/*" onChange={(e) => onFileChange('dniBackFileUrl', e)} />
                  <Button variant="outline" size="sm" className="h-10 text-[9px] font-bold rounded-xl" onClick={() => dniBRef.current?.click()}>
                    <Camera size={12} className="mr-2" /> DORSO DNI
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <p className="text-[9px] text-blue-700 leading-relaxed font-medium italic">
                Asegúrate de que las fotos sean legibles y estén bien iluminadas. La central de monitoreo auditará estos documentos para habilitar tus próximos fletes.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 animate-in fade-in">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
