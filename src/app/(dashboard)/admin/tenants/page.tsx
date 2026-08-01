
'use client';

import { useMemo, useState, useEffect } from "react";
import { useFirestore, useCollection, useUser } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc, setDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  MoreVertical,
  UserPlus,
  CreditCard,
  AlertTriangle,
  Save,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Info,
  ExternalLink,
  UserCheck,
  Key,
  Edit2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tenant, AppUser } from "@/app/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SUPER_ADMIN_EMAIL = "leozman15@gmail.com";

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
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isSubsDialogOpen, setIsSubsDialogOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("LogisticaAr2026");

  const [subStatus, setSubStatus] = useState<'active' | 'suspended'>('active');
  const [actDate, setActDate] = useState("");
  const [expDate, setExpDate] = useState("");

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
    if (!db) return;
    
    const ok = window.confirm(`¿ELIMINAR DEFINITIVAMENTE la empresa ${name}? Esta acción borrará la configuración de la instancia y es irreversible.`);
    if (!ok) return;

    setIsSubmitting(true);
    try {
      const tenantRef = doc(db, "tenants", id);
      await deleteDoc(tenantRef);
      
      toast({ 
        title: "Empresa Eliminada", 
        description: `La organización ${name} ha sido removida del ecosistema.` 
      });
    } catch (e: any) {
      console.error("Delete error:", e);
      toast({ 
        variant: "destructive", 
        title: "Error al eliminar", 
        description: e.message || "Verifique los permisos de SuperAdmin." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!db || !selectedTenant) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "tenants", selectedTenant.id), {
        subscriptionStatus: subStatus,
        activationDate: actDate,
        expirationDate: expDate,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Suscripción Actualizada" });
      setIsSubsDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTenantAdmin = async () => {
    if (!db || !selectedTenant || !adminEmail || !adminPass) return;
    setIsSubmitting(true);
    
    const secondaryApp = initializeApp(firebaseConfig, "secondary-auth");
    const secondaryAuth = getAuth(secondaryApp);
    const cleanEmail = adminEmail.toLowerCase().trim();

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, adminPass);
      const uid = userCredential.user.uid;

      const batch = writeBatch(db);
      
      const globalUserRef = doc(db, "users", cleanEmail);
      batch.set(globalUserRef, {
        uid,
        email: cleanEmail,
        tenantId: selectedTenant.id,
        role: "manager",
        status: "active",
        createdAt: serverTimestamp()
      });

      const tenantUserRef = doc(db, "tenants", selectedTenant.id, "users", uid);
      batch.set(tenantUserRef, {
        uid,
        email: cleanEmail,
        tenantId: selectedTenant.id,
        displayName: "Gerente Inicial",
        role: "manager",
        status: "active",
        createdAt: serverTimestamp()
      });

      await batch.commit();

      toast({ 
        title: "Gerente Creado Exitosamente", 
        description: `El acceso para ${cleanEmail} ya está activo con rol de GERENTE.` 
      });
      setIsAdminDialogOpen(false);
      setAdminEmail("");
      setAdminPass("LogisticaAr2026");
    } catch (e: any) {
      let msg = "Error al crear usuario.";
      if (e.code === 'auth/email-already-in-use') msg = "El correo ya está registrado en Firebase.";
      toast({ variant: "destructive", title: "Error Auth", description: msg });
    } finally {
      await deleteApp(secondaryApp);
      setIsSubmitting(false);
    }
  };

  const openSubsModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setSubStatus(tenant.subscriptionStatus || 'active');
    setActDate(tenant.activationDate || "");
    setExpDate(tenant.expirationDate || "");
    setIsSubsDialogOpen(true);
  };

  const openAdminModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setAdminEmail(tenant.settings?.adminEmail || "");
    setIsAdminDialogOpen(true);
  };

  if (userLoading || user?.email !== SUPER_ADMIN_EMAIL) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
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

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
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
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Plan</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Mensualidad</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Vencimiento</TableHead>
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
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-all",
                          tenant.subscriptionStatus === 'suspended' ? "bg-red-50 text-red-400 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white"
                        )}>
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
                    <TableCell className="text-center">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-4 py-1.5 border-none shadow-sm italic",
                        tenant.plan === 'pro' ? "bg-slate-900 text-blue-400" : "bg-slate-200 text-slate-600"
                      )}>
                        {tenant.plan === 'pro' ? 'Industrial PRO' : 'Free Tier'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <span className="font-black text-slate-900 text-sm italic">
                         ${(tenant.monthlyFee || 0).toLocaleString()}
                       </span>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex flex-col items-center">
                          <span className={cn(
                            "font-black text-xs",
                            tenant.subscriptionStatus === 'suspended' ? "text-red-600" : "text-slate-700"
                          )}>
                            {tenant.expirationDate || 'Ilimitado'}
                          </span>
                          <Badge variant="outline" className={cn(
                            "text-[7px] font-black uppercase px-1 h-3 mt-1",
                            tenant.subscriptionStatus === 'suspended' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                          )}>
                             {tenant.subscriptionStatus === 'suspended' ? 'SUSPENDIDO' : 'ACTIVO'}
                          </Badge>
                       </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100">
                            <MoreVertical size={20} className="text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-none">
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest p-2">Acciones de Tenant</DropdownMenuLabel>
                          
                          <DropdownMenuItem asChild className="font-bold h-11 rounded-xl cursor-pointer">
                            <Link href={`/admin/tenants/${tenant.id}/editar`}>
                              <Edit2 size={16} className="mr-3 text-blue-600" /> Editar Información
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openAdminModal(tenant); }} className="font-bold h-11 rounded-xl cursor-pointer">
                            <UserCheck size={16} className="mr-3 text-blue-600" /> Crear Primer Usuario (Auth)
                          </DropdownMenuItem>

                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openSubsModal(tenant); }} className="font-bold h-11 rounded-xl cursor-pointer">
                            <CreditCard size={16} className="mr-3 text-blue-600" /> Gestionar Suscripción
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator className="my-2" />
                          
                          <DropdownMenuLabel className="text-[10px] font-black uppercase text-red-400 tracking-widest p-2">Zona de Peligro</DropdownMenuLabel>
                          <DropdownMenuItem 
                            className="text-red-600 focus:bg-red-50 focus:text-red-600 font-bold h-11 rounded-xl cursor-pointer"
                            onSelect={(e) => { 
                              e.preventDefault(); 
                              handleDeleteTenant(tenant.id, tenant.name); 
                            }}
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

      {/* DIALOG: GESTIÓN DE SUSCRIPCIÓN */}
      <Dialog open={isSubsDialogOpen} onOpenChange={setIsSubsDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] outline-none">
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Control de Servicio</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">{selectedTenant?.name}</DialogDescription>
           </DialogHeader>
           <div className="space-y-6 py-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                 <div className="space-y-0.5">
                    <Label className="text-xs font-black uppercase">Estado del Servicio</Label>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{subStatus === 'active' ? 'ACCESO HABILITADO' : 'ACCESO BLOQUEADO'}</p>
                 </div>
                 <Switch 
                  checked={subStatus === 'active'} 
                  onCheckedChange={(v) => setSubStatus(v ? 'active' : 'suspended')} 
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Activación</Label>
                    <Input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="bg-slate-50 border-none rounded-xl h-10" />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Vencimiento</Label>
                    <Input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="bg-slate-50 border-none rounded-xl h-10" />
                 </div>
              </div>

              {subStatus === 'suspended' && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                   <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                   <p className="text-[10px] text-red-700 leading-relaxed font-medium">
                     Al suspender, todos los usuarios de la organización perderán acceso inmediato al panel hasta que el servicio sea rehabilitado.
                   </p>
                </div>
              )}
           </div>
           <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsSubsDialogOpen(false)} className="font-bold text-slate-400 uppercase text-xs">Cerrar</Button>
              <Button onClick={handleUpdateSubscription} disabled={isSubmitting} className="bg-blue-600 h-12 px-8 rounded-xl font-black uppercase shadow-lg shadow-blue-100">
                 {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                 GUARDAR CAMBIOS
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: BOOTSTRAP GERENTE (CREACIÓN REAL EN AUTH) */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] outline-none">
           <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Habilitar Gerente de Empresa</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase">Creación automática en Firebase Auth para {selectedTenant?.name}</DialogDescription>
           </DialogHeader>
           <div className="space-y-6 py-6">
              <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-start gap-4">
                 <UserCheck className="text-blue-600 shrink-0 mt-1" size={24} />
                 <div className="space-y-1">
                    <p className="text-xs font-black text-blue-800 uppercase italic">Aprovisionamiento Full-Stack</p>
                    <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                      Esta acción creará la cuenta de acceso real en Firebase. El usuario podrá iniciar sesión inmediatamente con el rol de <strong>Gerente</strong>.
                    </p>
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Institucional del Gerente</Label>
                 <Input 
                   type="email" 
                   className="h-12 bg-slate-50 border-none rounded-xl font-bold" 
                   placeholder="gerente@empresa.com"
                   value={adminEmail}
                   onChange={e => setAdminEmail(e.target.value)}
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Definir Contraseña</Label>
                 <div className="relative">
                    <Key className="absolute left-3 top-3.5 h-5 w-5 text-slate-300" />
                    <Input 
                      className="h-12 bg-slate-50 border-none rounded-xl font-mono font-bold pl-12" 
                      value={adminPass}
                      onChange={e => setAdminPass(e.target.value)}
                    />
                 </div>
              </div>
           </div>
           <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsAdminDialogOpen(false)} className="font-bold text-slate-400 uppercase text-xs">Cancelar</Button>
              <Button onClick={handleCreateTenantAdmin} disabled={isSubmitting || !adminEmail} className="bg-green-600 h-12 px-8 rounded-xl font-black uppercase shadow-lg shadow-green-100">
                 {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={16} />}
                 CREAR Y VINCULAR USUARIO
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
