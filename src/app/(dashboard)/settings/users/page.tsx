
'use client';

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/use-tenant";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, MoreHorizontal, Loader2, Key } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AppUser, UserRole } from "@/app/lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createUser, listUsers } from "@/lib/users-api";

export default function UsersSettingsPage() {
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("LogisticaAr2026");
  const [newRole, setNewRole] = useState<UserRole>("sales_admin");

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      if (!tenantId) {
        if (active) {
          setUsers([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (active) setLoading(true);
        const rows = await listUsers();
        if (!active) return;
        setUsers(rows);
      } catch (error) {
        if (!active) return;
        setUsers([]);
        toast({ variant: "destructive", title: "Error al cargar usuarios", description: (error as Error).message });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();
    return () => {
      active = false;
    };
  }, [tenantId, toast]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newEmail || !newPass) return;

    setIsSubmitting(true);
    try {
      const created = await createUser({
        email: newEmail,
        password: newPass,
        role: newRole,
        tenantId,
      });

      setUsers((prev) => {
        const next = [created, ...prev.filter((u) => u.uid !== created.uid)];
        return next.sort((a, b) => a.role.localeCompare(b.role));
      });
      toast({ title: "Usuario Creado", description: `Acceso habilitado para ${newEmail}.` });
      setIsInviteOpen(false);
      setNewEmail("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al crear usuario", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-black text-slate-900 uppercase italic">Gestión de Equipo</h1><p className="text-xs text-slate-500 font-bold uppercase">Control de acceso multi-tenant.</p></div>
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild><Button className="bg-blue-600 rounded-2xl"><UserPlus className="mr-2" /> Alta de Usuario</Button></DialogTrigger>
          <DialogContent className="rounded-[2.5rem]">
            <form onSubmit={handleInvite} className="space-y-6 py-6">
              <DialogHeader><DialogTitle className="text-xl font-black uppercase italic">Habilitar Colaborador</DialogTitle></DialogHeader>
              <div className="space-y-4">
                 <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Email Corporativo</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required /></div>
                 <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Contraseña</Label><div className="relative"><Key size={14} className="absolute left-3 top-3 text-slate-300"/><Input className="pl-9 font-mono" value={newPass} onChange={e => setNewPass(e.target.value)} required /></div></div>
                 <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Rol Operativo</Label>
                    <Select value={newRole} onValueChange={(v: UserRole) => setNewRole(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">📊 Gerente</SelectItem>
                        <SelectItem value="sales_admin">💼 Administración Ventas</SelectItem>
                        <SelectItem value="coordinator">🛰️ Coordinador / Tráfico</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
              </div>
              <DialogFooter><Button type="submit" disabled={isSubmitting} className="bg-blue-600 h-12 w-full font-black uppercase">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmar Alta Real'}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          {loading ? <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div> : (
            <Table>
              <TableHeader className="bg-slate-50"><TableRow><TableHead className="px-8">Colaborador</TableHead><TableHead>Rol</TableHead><TableHead className="text-right pr-8">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {users?.map(u => (
                  <TableRow key={u.uid}>
                    <TableCell className="px-8 py-4"><p className="font-bold text-slate-900">{u.email}</p></TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[8px] font-black">{u.role}</Badge></TableCell>
                    <TableCell className="text-right pr-8"><Button variant="ghost" size="icon"><MoreHorizontal /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
