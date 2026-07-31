
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  ShieldCheck, 
  Plus, 
  Building2, 
  Loader2, 
  Trash2, 
  Globe, 
  Lock, 
  Users,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  DollarSign,
  MoreVertical,
  Settings,
  UserPlus,
  BarChart3,
  CreditCard
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SUPER_ADMIN_EMAIL = "leozman15@gmail.com";

/**
 * Componente auxiliar para contar usuarios de un tenant específico.
 */
function TenantUserCount({ tenantId }: { tenantId: string }) {
  const db = useFirestore();
  const usersQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return collection(db, "tenants", tenantId, "users");
  }, [db, tenantId]);

  const { data: users, loading } = useCollection(usersQuery);

  if (loading) return <Loader2 className="animate-spin w-3 h-3 text-slate-300" />;
  
  return (
    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
      {users?.length || 0}
    </Badge>
  );
}

export default function SuperAdminTenantsPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  // Seguridad: Si no es el SuperAdmin, redirigir
  useEffect(() => {
    if (!userLoading && user?.email !== SUPER_ADMIN_EMAIL) {
      router.replace("/dashboard");
    }
  }, [user, userLoading, router]);

  const tenantsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, "tenants"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: tenants, loading } = useCollection<Tenant>(tenantsQuery);

  const handleDeleteTenant = async (id: string, name: string) => {
    if (!db || !confirm(`¿Eliminar la empresa ${name} y TODA su base de datos? Esta acción es irreversible.`)) return;
    try {
      await deleteDoc(doc(db, "tenants", id));
      toast({ title: "Empresa eliminada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  if (userLoading || user?.email !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-blue-400 shadow-2xl border border-blue-500/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Panel Maestro</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Ecosistema Multi-Tenant / SaaS Logístico v3.0</p>
          </div>
        </div>

        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white font-black italic uppercase text-xs h-14 px-8 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95"
          asChild
        >
          <Link href="/admin/tenants/nuevo">
            <Plus className="w-5 h-5 mr-2" /> Habilitar Nueva Empresa
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Empresas Activas</p>
              <p className="text-4xl font-black italic text-slate-900">{tenants?.length || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Building2 /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-slate-900 text-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Suscripciones PRO</p>
              <p className="text-4xl font-black italic text-blue-400">{tenants?.filter(t => t.plan === 'pro').length || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400"><TrendingUp /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Uptime Plataforma</p>
              <p className="text-lg font-black italic text-green-600">99.9% ONLINE</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 animate-pulse"><Globe size={20}/></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-8">
           <div className="flex justify-between items-center">
             <CardTitle className="text-base font-black uppercase italic tracking-tighter flex items-center gap-2">
                <Lock className="text-blue-600" size={20} /> Directorio de Organizaciones Habilitadas
             </CardTitle>
             <Badge variant="outline" className="font-mono text-[10px] h-7 px-3 bg-white">DATABASE: AR-PROD-01</Badge>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest h-14">Organización</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Usuarios</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Mensualidad</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Alta</TableHead>
                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Gestión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-32"><Loader2 className="animate-spin mx-auto text-blue-600 w-8 h-8" /></TableCell></TableRow>
              ) : tenants?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-300 italic font-black uppercase tracking-widest">No hay organizaciones registradas.</TableCell></TableRow>
              ) : (
                tenants?.map((tenant) => (
                  <TableRow key={tenant.id} className="hover:bg-slate-50/50 transition-all group">
                    <TableCell className="px-8 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <Building2 size={24} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase italic tracking-tight text-base leading-none">{tenant.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">ID: {tenant.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <TenantUserCount tenantId={tenant.id} />
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-4 py-1.5 border-none shadow-sm italic",
                        tenant.plan === 'pro' ? "bg-slate-900 text-blue-400" : "bg-slate-200 text-slate-600"
                      )}>
                        {tenant.plan === 'pro' ? 'Industrial PRO' : 'Free Tier'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1 font-black text-slate-700">
                          <DollarSign size={14} className="text-green-600" />
                          <span>{tenant.monthlyFee?.toLocaleString() || '0'}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-500 text-xs">
                      {tenant.createdAt?.toDate ? tenant.createdAt.toDate().toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100">
                            <MoreVertical size={20} className="text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-none">
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-2">Administración de Instancia</DropdownMenuLabel>
                          <DropdownMenuItem className="font-bold h-11 rounded-xl">
                            <ExternalLink size={16} className="mr-3 text-blue-600" /> Ver Detalles Fiscales
                          </DropdownMenuItem>
                          <DropdownMenuItem className="font-bold h-11 rounded-xl">
                            <CreditCard size={16} className="mr-3 text-blue-600" /> Gestionar Suscripción
                          </DropdownMenuItem>
                          <DropdownMenuItem className="font-bold h-11 rounded-xl">
                            <Users size={16} className="mr-3 text-blue-600" /> Auditar Usuarios
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-2" />
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-red-400 tracking-widest p-2">Zona de Peligro</DropdownMenuLabel>
                          <DropdownMenuItem 
                            className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-11 rounded-xl"
                            onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          >
                            <Trash2 size={16} className="mr-3" /> Eliminar Definitiva
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="p-10 bg-blue-50 rounded-[3rem] border-2 border-blue-100 flex flex-col md:flex-row items-center gap-8 mx-2 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12"><Lock size={120}/></div>
         <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-blue-600 shadow-2xl border border-blue-100 shrink-0">
            <Lock size={40} />
         </div>
         <div className="space-y-3 flex-1">
            <p className="text-sm font-black text-blue-800 uppercase italic tracking-widest">Protocolo de Seguridad del Fundador</p>
            <p className="text-[12px] text-blue-600 leading-relaxed font-medium">
               Como Super Administrador, usted controla la creación de instancias aisladas. Cada empresa que dé de alta aquí tendrá un entorno de datos completamente independiente. Una vez creada la empresa, el administrador designado podrá realizar el proceso de Onboarding para configurar su propia marca, logo y parámetros logísticos.
            </p>
            <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase">
              <ShieldCheck size={14}/> Acceso verificado para leozman15@gmail.com
            </div>
         </div>
      </div>
    </div>
  );
}
