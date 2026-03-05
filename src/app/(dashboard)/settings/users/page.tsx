
'use client';

import { useMemo } from "react";
import { useFirestore, useCollection } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { collection, query, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, MoreHorizontal, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppUser } from "@/app/lib/types";

export default function UsersSettingsPage() {
  const db = useFirestore();
  const { tenantId } = useTenant();

  const usersQuery = useMemo(() => {
    if (!db || !tenantId) return null;
    return query(collection(db, "tenants", tenantId, "users"), orderBy("role"));
  }, [db, tenantId]);

  const { data: users, loading } = useCollection<AppUser>(usersQuery);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Gestão de Equipe</h1>
          <p className="text-muted-foreground">Adicione e gerencie permissões dos membros da sua organização.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90">
          <UserPlus className="w-4 h-4 mr-2" /> Convidar Membro
        </Button>
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
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          Ativo
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
