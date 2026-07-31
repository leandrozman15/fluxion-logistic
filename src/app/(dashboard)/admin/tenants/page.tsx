'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, Plus, Building2, Loader2, Trash2, Globe, Lock, Save, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant } from "@/app/lib/types";
import { cn } from "@/lib/utils";

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
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", plan: "free" as "free" | "pro" });

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

  const handleAddTenant = async () => {
    if (!db || !newTenant.name) return;
    setIsSubmitting(true);
    try {
      const newRef = doc(collection(db, "tenants"));
      await setDoc(newRef, {
        id: newRef.id,
        name: newTenant.name,
        plan: newTenant.plan,
        createdAt: serverTimestamp(),
        settings: {
          onboardingCompleted: false,
          mapProvider: 'google',
          gpsIntervalSeconds: 60
        }
      });
      toast({ title: "Empresa Habilitada", description: `${newTenant.name} ya puede operar.` });
      setIsAddOpen(false);
      setNewTenant({ name: "", plan: "free" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al crear empresa" });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-blue-400 shadow-xl border border-blue-500/20">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Control Maestro</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Gestión de Clientes Corporativos / SaaS Logístico</p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-blue-400 font-black italic uppercase text-xs h-12 px-6 rounded-2xl border border-blue-500/20 shadow-xl">
              <Plus className="w-4 h-4 mr-2" /> Nueva Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
             <div className="bg-slate-900 text-white p-8 pb-6">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                    <Building2 className="text-blue-400" /> Habilitar Nueva Organización
                  </DialogTitle>
                  <DialogDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Iniciando instancia multi-tenant</DialogDescription>
                </DialogHeader>
             </div>
             <div className="p-8 space-y-6 bg-white">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Razón Social / Identificador</Label>
                  <Input 
                    placeholder="Ej: Transportes Interandina" 
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                    value={newTenant.name}
                    onChange={e => setNewTenant({...newTenant, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-400">Plan de Servicio</Label>
                   <Select value={newTenant.plan} onValueChange={(v: any) => setNewTenant({...newTenant, plan: v})}>
                      <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="free">📦 Plan Free (Básico)</SelectItem>
                         <SelectItem value="pro">🚀 Plan Industrial PRO</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
             </div>
             <DialogFooter className="p-8 bg-slate-50 border-t">
                <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="font-bold uppercase text-xs">Cancelar</Button>
                <Button onClick={handleAddTenant} disabled={isSubmitting || !newTenant.name} className="bg-blue-600 h-12 px-10 rounded-xl font-black uppercase shadow-xl shadow-blue-100">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                  DAR DE ALTA
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b p-6">
           <CardTitle className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2">
              <Globe className="text-blue-600" size={18} /> Directorio de Organizaciones Activas
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">Organización</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Usuarios</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">ID Instancia</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Alta</TableHead>
                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
              ) : tenants?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No hay organizaciones registradas.</TableCell></TableRow>
              ) : (
                tenants?.map((tenant) => (
                  <TableRow key={tenant.id} className="hover:bg-slate-50/50 transition-all">
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                          <Building2 size={20} />
                        </div>
                        <div className="font-black text-slate-900 uppercase italic tracking-tight">{tenant.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <TenantUserCount tenantId={tenant.id} />
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-slate-400">{tenant.id}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-3 py-1 border-none",
                        tenant.plan === 'pro' ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                      )}>
                        {tenant.plan === 'pro' ? 'Industrial PRO' : 'Free'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-500 text-xs">
                      {tenant.createdAt?.toDate ? tenant.createdAt.toDate().toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDeleteTenant(tenant.id, tenant.name)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="p-8 bg-blue-50 rounded-[2.5rem] border-2 border-blue-100 flex items-start gap-6 mx-2">
         <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-xl border border-blue-100 shrink-0">
            <Lock size={28} />
         </div>
         <div className="space-y-2">
            <p className="text-xs font-black text-blue-800 uppercase italic tracking-widest">Protocolo de Seguridad del Creador</p>
            <p className="text-[11px] text-blue-600 leading-relaxed font-medium">
               Este panel es la única vía para crear la estructura de base de datos de cada cliente. Una vez creada la empresa, el administrador de la misma podrá realizar el proceso de Onboarding para configurar su propia marca, logo y flota. <strong>Solo leozman15@gmail.com tiene acceso a este control maestro.</strong>
            </p>
         </div>
      </div>
    </div>
  );
}
