
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, MoreHorizontal, ShieldCheck, Loader2, UserCircle2, Briefcase, Truck, HardHat, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppUser, UserRole } from "@/app/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function UsersSettingsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("sales_admin");

  const usersQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "users"), orderBy("role"));
  }, [db, tenantId]);

  const { data: users, loading } = useCollection<AppUser>(usersQuery);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !tenantId || !newEmail) return;

    setIsSubmitting(true);
    try {
      const userId = newEmail.replace(/[^a-zA-Z0-9]/g, "_");
      const userRef = doc(db, "tenants", tenantId, "users", userId);
      
      await setDoc(userRef, {
        uid: userId,
        tenantId,
        email: newEmail,
        displayName: newEmail.split('@')[0],
        role: newRole,
        createdAt: serverTimestamp(),
        status: "invited"
      });

      toast({ title: "Invitación enviada", description: `El usuario ha sido registrado como ${newRole}.` });
      setIsInviteOpen(false);
      setNewEmail("");
    } catch (error) {
      toast({ variant: "destructive", title: "Error al invitar", description: "Verifique sus permisos." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <ShieldCheck className="w-4 h-4 text-red-500" />;
      case 'manager': return <BadgeCheck className="w-4 h-4 text-blue-600" />;
      case 'coordinator': return <Briefcase className="w-4 h-4 text-orange-500" />;
      case 'warehouse': return <HardHat className="w-4 h-4 text-slate-500" />;
      case 'driver': return <Truck className="w-4 h-4 text-indigo-500" />;
      default: return <UserCircle2 className="w-4 h-4 text-slate-400" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return "Super Admin";
      case 'sales_admin': return "Administración Ventas";
      case 'purchasing_admin': return "Administración Compras";
      case 'coordinator': return "Coordinador";
      case 'manager': return "Gerente";
      case 'warehouse': return "Depósito";
      case 'driver': return "Chofer";
      case 'viewer': return "Solo Lectura";
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Gestión de Equipo</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Control de acceso y perfiles de la red operativa LogísticaAr.</p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 font-black text-xs uppercase h-12 rounded-2xl">
              <UserPlus className="w-4 h-4 mr-2" /> Alta de Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem]">
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Habilitar Colaborador</DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold tracking-widest">Defina el nivel de acceso y el correo institucional.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400">Correo Electrónico</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="usuario@logistica-ar.com" 
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-[10px] font-black uppercase text-slate-400">Rol / Perfil Operativo</Label>
                  <Select value={newRole} onValueChange={(v: UserRole) => setNewRole(v)}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder="Seleccione un papel" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="manager">📊 Gerente</SelectItem>
                      <SelectItem value="sales_admin">💼 Administración Ventas</SelectItem>
                      <SelectItem value="purchasing_admin">💳 Administración Compras</SelectItem>
                      <SelectItem value="coordinator">🛰️ Coordinador / Tráfico</SelectItem>
                      <SelectItem value="warehouse">📦 Depósito</SelectItem>
                      <SelectItem value="driver">🚚 Chofer (Acceso Web)</SelectItem>
                      <SelectItem value="viewer">👁️ Solo Lectura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" type="button" onClick={() => setIsInviteOpen(false)} className="font-bold text-slate-400 uppercase text-xs">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 h-12 px-8 rounded-xl font-black uppercase shadow-lg shadow-blue-100">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar Alta
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-sm font-black uppercase italic tracking-tighter">Miembros de la Organización</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Lista auditada de personal con acceso al panel central.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-32 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-8 text-[10px] font-black uppercase tracking-widest">Colaborador</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Rol / Función</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                  <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic font-bold">
                      No hay usuarios registrados aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  users?.map((u) => (
                    <TableRow key={u.uid} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center font-black text-blue-600 border border-blue-100">
                            {u.email[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-slate-900 uppercase italic tracking-tight">{u.displayName || "Usuario"}</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">{u.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getRoleIcon(u.role)}
                          <span className="text-xs font-black uppercase text-slate-700 tracking-tighter">{getRoleLabel(u.role)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[8px] font-black uppercase h-5",
                          u.status === 'active' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {u.status === 'active' ? 'Activo' : 'Invitado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 px-2">
         <div className="p-4 bg-slate-50 rounded-2xl border space-y-1">
            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Admin / Gerencia</h4>
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">Visión total de costos, auditoría de telemetría y reportes de rentabilidad.</p>
         </div>
         <div className="p-4 bg-slate-50 rounded-2xl border space-y-1">
            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Ventas / Compras</h4>
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">Ingreso de remitos, gestión de productos y rendición de gastos por viaje.</p>
         </div>
         <div className="p-4 bg-slate-50 rounded-2xl border space-y-1">
            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Tráfico / Depósito</h4>
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">Planificación de rutas, asignación de unidades y control de bocas de carga.</p>
         </div>
         <div className="p-4 bg-slate-50 rounded-2xl border space-y-1">
            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Chofer</h4>
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">Acceso simplificado al dashboard web para consulta de agenda y perfil.</p>
         </div>
      </div>
    </div>
  );
}
