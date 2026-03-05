import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus, MoreHorizontal, ShieldCheck, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UsersSettingsPage() {
  const users = [
    { id: "1", name: "João Silva", email: "joao@empresa.com.br", role: "admin", status: "active", lastLogin: "Hoje, 08:30" },
    { id: "2", name: "Maria Oliveira", email: "maria@empresa.com.br", role: "sales", status: "active", lastLogin: "Ontem, 17:45" },
    { id: "3", name: "Pedro Santos", email: "pedro@empresa.com.br", role: "sales", status: "active", lastLogin: "20/05, 14:20" },
    { id: "4", name: "Ana Costa", email: "ana@empresa.com.br", role: "viewer", status: "inactive", lastLogin: "05/05, 09:00" },
  ];

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
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.name}</span>
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
                    <Badge variant={user.status === 'active' ? 'outline' : 'secondary'} className={user.status === 'active' ? 'text-green-600 border-green-200' : ''}>
                      {user.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.lastLogin}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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