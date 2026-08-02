
'use client';

import { useState, useEffect, useMemo } from "react";
import { useFirestore, useDoc, useUser } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Building2, 
  ArrowLeft, 
  Save, 
  Loader2, 
  ShieldCheck, 
  Zap,
  MapPin,
  Phone,
  User,
  CreditCard,
  LayoutGrid,
  Box,
  Truck,
  Users,
  Wrench,
  Files,
  BarChart3,
  ShoppingBag,
  Info,
  Layers,
  Map as MapIcon,
  DollarSign,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tenant } from "@/app/lib/types";

const SUPER_ADMIN_EMAIL = "leozman15@gmail.com";

const AVAILABLE_MODULES = [
  { id: 'dashboard', label: 'Monitor Operativo', icon: LayoutGrid, group: 'Core' },
  { id: 'cargas', label: 'Cargas y fletes', icon: Box, group: 'Core' },
  { id: 'clientes', label: 'Cartera Clientes', icon: Building2, group: 'Core' },
  { id: 'flota', label: 'Flota Camiones', icon: Truck, group: 'Activos' },
  { id: 'choferes', label: 'Gestión Choferes', icon: Users, group: 'Activos' },
  { id: 'mantenimiento', label: 'Taller y Mantenimiento', icon: Wrench, group: 'Activos' },
  { id: 'mercadolibre', label: 'Mercado Libre (Last Mile)', icon: ShoppingBag, group: 'E-commerce' },
  { id: 'remitos', label: 'Buzón de Remitos', icon: Files, group: 'Administración' },
  { id: 'presupuestos', label: 'Presupuestos Venta', icon: FileText, group: 'Administración' },
  { id: 'productos', label: 'Catálogo Productos', icon: Box, group: 'Almacén' },
  { id: 'stock', label: 'Gestión de Stock', icon: Layers, group: 'Almacén' },
  { id: 'stock-layout', label: 'Mapa de Racks', icon: MapIcon, group: 'Almacén' },
  { id: 'despacho', label: 'Despacho Inteligente (IA)', icon: Zap, group: 'Inteligencia' },
  { id: 'analytics', label: 'Análisis de Datos', icon: BarChart3, group: 'Inteligencia' },
  { id: 'sedes', label: 'Sedes y Depósitos', icon: MapPin, group: 'Infraestructura' },
];

export default function EditTenantPage() {
  const { id } = useParams();
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const tenantRef = useMemo(() => (db && id) ? doc(db, "tenants", id as string) : null, [db, id]);
  const { data: tenant, loading: tenantLoading } = useDoc<Tenant>(tenantRef);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    cuit: "",
    country: "Argentina",
    plan: "free" as "free" | "pro",
    monthlyFee: 0,
    adminEmail: "",
    legalAddress: "",
    legalCityState: "",
    centralPhone: "",
    responsibleName: ""
  });

  // Seguridad: Solo SuperAdmin
  useEffect(() => {
    if (!userLoading && user?.email !== SUPER_ADMIN_EMAIL) {
      router.replace("/dashboard");
    }
  }, [user, userLoading, router]);

  // Cargar datos existentes
  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        cuit: tenant.settings?.cuit || "",
        country: tenant.settings?.country || "Argentina",
        plan: tenant.plan || "free",
        monthlyFee: tenant.monthlyFee || 0,
        adminEmail: tenant.settings?.adminEmail || "",
        legalAddress: tenant.settings?.legalAddress || "",
        legalCityState: tenant.settings?.legalCityState || "",
        centralPhone: tenant.settings?.centralPhone || "",
        responsibleName: tenant.settings?.responsibleName || ""
      });
      setEnabledModules(tenant.settings?.enabledModules || AVAILABLE_MODULES.map(m => m.id));
    }
  }, [tenant]);

  const toggleModule = (moduleId: string) => {
    setEnabledModules(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSubmit = async () => {
    if (!tenantRef || !formData.name) return;
    setIsSubmitting(true);
    try {
      await updateDoc(tenantRef, {
        name: formData.name,
        plan: formData.plan,
        monthlyFee: formData.monthlyFee,
        updatedAt: serverTimestamp(),
        "settings.cuit": formData.cuit,
        "settings.country": formData.country,
        "settings.adminEmail": formData.adminEmail,
        "settings.legalAddress": formData.legalAddress,
        "settings.legalCityState": formData.legalCityState,
        "settings.centralPhone": formData.centralPhone,
        "settings.responsibleName": formData.responsibleName,
        "settings.enabledModules": enabledModules
      });
      
      toast({ 
        title: "Configuración Actualizada", 
        description: `Los cambios en ${formData.name} se han aplicado correctamente.` 
      });
      router.push("/admin/tenants");
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar empresa" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading || tenantLoading || user?.email !== SUPER_ADMIN_EMAIL) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full bg-white shadow-sm border">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Editar Organización</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión de parámetros y habilitaciones modulares</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* 1. IDENTIDAD FISCAL */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Building2 size={18} className="text-blue-400" /> 1. Identidad Fiscal y Operativa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Razón Social / Identificador</Label>
                  <Input 
                    placeholder="Ej: Transportes Interandina S.A." 
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold text-base"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">CUIT / Identificación Tributaria</Label>
                  <Input 
                    placeholder="30-XXXXXXXX-X" 
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold text-base"
                    value={formData.cuit}
                    onChange={e => setFormData({...formData, cuit: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">País Sede</Label>
                  <Select value={formData.country} onValueChange={v => setFormData({...formData, country: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Argentina">🇦🇷 Argentina</SelectItem>
                      <SelectItem value="Chile">🇨L Chile</SelectItem>
                      <SelectItem value="Paraguay">🇵🇾 Paraguay</SelectItem>
                      <SelectItem value="Brasil">🇧🇷 Brasil</SelectItem>
                      <SelectItem value="Ushort">🇺🇾 Uruguay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Principal</Label>
                  <Input 
                    type="email"
                    placeholder="admin@empresa.com" 
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                    value={formData.adminEmail}
                    onChange={e => setFormData({...formData, adminEmail: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Plan de Servicio</Label>
                  <Select value={formData.plan} onValueChange={(v: any) => setFormData({...formData, plan: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free Tier</SelectItem>
                      <SelectItem value="pro">Industrial PRO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Mensualidad (ARS)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-slate-300" />
                    <Input 
                      type="number"
                      placeholder="0" 
                      className="h-12 bg-slate-50 border-none rounded-xl font-black text-lg pl-10"
                      value={formData.monthlyFee}
                      onChange={e => setFormData({...formData, monthlyFee: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. MODULOS HABILITADOS */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-blue-600 text-white p-8">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <LayoutGrid size={18} /> 2. Configuración de Módulos y Accesos
              </CardTitle>
              <CardDescription className="text-white/60 text-[10px] uppercase font-bold">Modifique las pantallas disponibles para el cliente</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {AVAILABLE_MODULES.map(module => (
                  <div 
                    key={module.id} 
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer group",
                      enabledModules.includes(module.id) ? "border-blue-600 bg-blue-50" : "border-slate-100 hover:border-slate-200"
                    )}
                    onClick={() => toggleModule(module.id)}
                  >
                    <div className="flex items-center gap-3">
                       <div className={cn(
                         "w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm",
                         enabledModules.includes(module.id) ? "bg-blue-600 text-white border-blue-500" : "bg-white text-slate-400"
                       )}>
                          <module.icon size={20} />
                       </div>
                       <div>
                          <p className={cn("text-xs font-black uppercase leading-none", enabledModules.includes(module.id) ? "text-blue-900" : "text-slate-500")}>
                            {module.label}
                          </p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{module.group}</p>
                       </div>
                    </div>
                    <Checkbox 
                      checked={enabledModules.includes(module.id)} 
                      onCheckedChange={() => toggleModule(module.id)}
                      className="rounded-full h-5 w-5"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 3. CONTACTO Y FACTURACIÓN */}
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-100/50 border-b p-8">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-slate-600">
                <CreditCard size={18} className="text-blue-600" /> 3. Contacto y Facturación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dirección Fiscal / Oficina Central</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                    <Input 
                      placeholder="Calle, Número, Piso/Depto" 
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12"
                      value={formData.legalAddress}
                      onChange={e => setFormData({...formData, legalAddress: e.target.value})}
                    />
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ciudad / Provincia</Label>
                    <Input 
                      placeholder="Ej: Buenos Aires, CABA" 
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                      value={formData.legalCityState}
                      onChange={e => setFormData({...formData, legalCityState: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Teléfono de la Empresa</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                      <Input 
                        placeholder="Ej: +54 11 4444-4444" 
                        className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12"
                        value={formData.centralPhone}
                        onChange={e => setFormData({...formData, centralPhone: e.target.value})}
                      />
                    </div>
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre del Responsable Legal</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-slate-300" />
                    <Input 
                      placeholder="Nombre Completo del Directivo" 
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12"
                      value={formData.responsibleName}
                      onChange={e => setFormData({...formData, responsibleName: e.target.value})}
                    />
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-xl rounded-[2.5rem] bg-slate-900 text-white overflow-hidden sticky top-24">
              <CardHeader className="p-8 pb-6 border-b border-white/5">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <ShieldCheck size={18} /> Resumen de Cambios
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="space-y-4">
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Organización</p>
                       <p className="text-lg font-black italic tracking-tighter truncate">{formData.name || 'Sin definir'}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Módulos Habilitados</p>
                       <p className="text-base font-bold text-blue-400 uppercase italic">{enabledModules.length} activos</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Plan Actual</p>
                       <p className="text-xl font-black italic text-green-400 uppercase">{formData.plan}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Mensualidad</p>
                       <p className="text-xl font-black italic text-blue-400">${formData.monthlyFee.toLocaleString()}</p>
                    </div>
                 </div>

                 <div className="pt-8 border-t border-white/5 space-y-4">
                    <Button 
                      className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-3xl shadow-2xl shadow-blue-900/40 border-none transition-all active:scale-95"
                      disabled={isSubmitting || !formData.name}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={24} />}
                      GUARDAR CAMBIOS
                    </Button>
                    <p className="text-[10px] text-center text-white/40 font-bold uppercase tracking-widest">
                       Control Maestro SaaS
                    </p>
                 </div>
              </CardContent>
           </Card>

           <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-[2.5rem] flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-md border border-blue-100 shrink-0">
                 <Info size={20} />
              </div>
              <div className="space-y-1">
                 <p className="text-xs font-black text-blue-800 uppercase italic">Ajuste de Permisos</p>
                 <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                   Al guardar, los usuarios verán reflejados los cambios en su menú lateral tras la próxima sincronización o recarga.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
