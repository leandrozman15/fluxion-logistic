
'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, MoreHorizontal, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppUser, UserRole } from "@/app/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function UsersSettingsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();
  const { toast } = useToast();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("sales");

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
      // Generar un ID basado en el email para evitar duplicados simples
      const userId = newEmail.replace(/[^a-zA-Z0-9]/g, "_");
      const userRef = doc(db, "tenants", tenantId, "users", userId);
      
      await setDoc(userRef, {
        uid: userId,
        tenantId,
        email: newEmail,
        displayName: newEmail.split('@')[0],
        role: newRole,
        createdAt: new Date().toISOString(),
        status: "invited"
      });

      toast({ title: "Convite enviado!", description: `O usuário ${newEmail} foi adicionado como ${newRole}.` });
      setIsInviteOpen(false);
      setNewEmail("");
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao convidar", description: "Verifique suas permissões." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Gestão de Equipe</h1>
          <p className="text-muted-foreground">Adicione e gerencie permissões dos membros da sua organização.</p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <UserPlus className="w-4 h-4 mr-2" /> Convidar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle>Convidar Novo Membro</DialogTitle>
                <DialogDescription>Insira o email corporativo e defina o nível de acesso.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Corporativo</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="nome@empresa.com.br" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Papel (Role)</Label>
                  <Select value={newRole} onValueChange={(v: UserRole) => setNewRole(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="sales">Vendas (Sales)</SelectItem>
                      <SelectItem value="viewer">Apenas Leitura (Viewer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsInviteOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar Convite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Usuários Ativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Nenhum usuário encontrado no sistema.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">
                            {user.displayName?.split(' ').map(n => n[0]).join('') || user.email[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{user.displayName || "Usuário"}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {user.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5 text-accent" />}
                          <span className="text-xs capitalize">{user.role}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${user.uid.includes('_') ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-green-600 border-green-200 bg-green-50'}`}>
                          {user.uid.includes('_') ? 'Convidado' : 'Ativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.lastLogin || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
        <div className="flex flex-col gap-1">
          <h4 className="font-bold text-sm">Admin</h4>
          <p className="text-xs text-muted-foreground">Controle total: usuários, limites, faturamento e dados.</p>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="font-bold text-sm">Sales</h4>
          <p className="text-xs text-muted-foreground">Gestão de prospects, campanhas e templates. Sem acesso a configurações.</p>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="font-bold text-sm">Viewer</h4>
          <p className="text-xs text-muted-foreground">Apenas leitura de dados e relatórios. Não pode alterar nada.</p>
        </div>
      </div>
    </div>
  );
}
