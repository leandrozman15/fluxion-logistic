'use client';

import { SidebarProvider, SidebarInset, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Mail, FileSpreadsheet, Settings, Target, FileText, Inbox, LogOut, Building2, BarChart3, Loader2, CheckSquare, Search, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useAuth, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { tenantId } = useTenant();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const menuItems = [
    { title: "Radar do Dia", icon: LayoutDashboard, href: "/dashboard" },
    { title: "Discovery", icon: Search, href: "/discovery" },
    { title: "Prospects", icon: Users, href: "/prospects" },
    { title: "Sequências", icon: Layers, href: "/sequences" },
    { title: "Tarefas", icon: CheckSquare, href: "/tasks" },
    { title: "Insights", icon: BarChart3, href: "/analytics" },
    { title: "Outbox", icon: Inbox, href: "/outbox" },
    { title: "Campanhas", icon: Target, href: "/campaigns" },
    { title: "Templates", icon: FileText, href: "/templates" },
    { title: "Importações", icon: FileSpreadsheet, href: "/imports" },
  ];

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push("/login");
      toast({ title: "Sessão encerrada" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao sair" });
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="h-16 flex items-center px-4 border-b">
            <Link href="/dashboard" className="flex items-center gap-2 font-headline font-bold text-primary">
              <div className="w-8 h-8 bg-accent rounded flex items-center justify-center text-white">FR</div>
              <span className="group-data-[collapsible=icon]:hidden">Fluxion Radar</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Configurações</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Ajustes">
                      <Link href="/settings/tenant">
                        <Settings />
                        <span>Ajustes do Motor</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4 border-t">
            <SidebarMenuButton 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut />
              <span className="group-data-[collapsible=icon]:hidden">Sair</span>
            </SidebarMenuButton>
          </div>
        </Sidebar>
        <SidebarInset className="bg-background">
          <header className="h-16 flex items-center justify-between px-6 border-b bg-card sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-primary">Operação Industrial</h2>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] uppercase font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Produção Unlocked
              </Badge>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-xs text-muted-foreground hidden sm:block">Org: {tenantId}</div>
               <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs uppercase">
                 AD
               </div>
            </div>
          </header>
          <main className="p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
