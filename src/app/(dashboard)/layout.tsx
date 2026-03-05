
'use client';

import { SidebarProvider, SidebarInset, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Mail, FileSpreadsheet, Settings, Target, FileText, Inbox, LogOut, Building2, BarChart3, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth, useDoc } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";
import { doc } from "firebase/firestore";
import { Tenant } from "@/app/lib/types";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const db = useAuth() ? null : null; // Para evitar erro de useFirestore não inicializado se auth sumir
  const { tenantId, loading: tenantLoading } = useTenant();
  const router = useRouter();
  const { toast } = useToast();

  const menuItems = [
    { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { title: "Prospects", icon: Users, href: "/prospects" },
    { title: "Insights", icon: BarChart3, href: "/analytics" },
    { title: "Outbox", icon: Inbox, href: "/outbox" },
    { title: "Campanhas", icon: Target, href: "/campaigns" },
    { title: "Templates", icon: FileText, href: "/templates" },
    { title: "Importações", icon: FileSpreadsheet, href: "/imports" },
  ];

  const settingItems = [
    { title: "Organização", icon: Building2, href: "/settings/tenant" },
    { title: "Usuários", icon: Users, href: "/settings/users" },
    { title: "Consumo", icon: Settings, href: "/settings/limits" },
  ];

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push("/login");
      toast({ title: "Sessão encerrada", description: "Você saiu do sistema com sucesso." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao sair", description: "Não foi possível encerrar a sessão." });
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
                  {settingItems.map((item) => (
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
              <h2 className="text-lg font-semibold text-primary">Painel de Controle</h2>
            </div>
            <div className="flex items-center gap-4">
               {tenantLoading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
                 <div className="text-sm text-muted-foreground hidden sm:block">ID Org: {tenantId || "N/A"}</div>
               )}
               <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs uppercase">
                 USR
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
