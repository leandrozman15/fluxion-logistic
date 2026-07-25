'use client';

import { 
  SidebarProvider, 
  SidebarInset, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { 
  Truck, 
  Users, 
  Package, 
  MapPin, 
  TrendingUp, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Route, 
  History, 
  Building2, 
  Briefcase, 
  BarChart3, 
  Mail,
  Moon,
  Sun
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Componente interno que maneja la lógica de cierre automático en móviles.
 */
function DashboardSidebar() {
  const { setOpenMobile, isMobile, state } = useSidebar();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const menuItems = [
    { title: "Monitor Operativo", icon: LayoutDashboard, href: "/dashboard" },
    { title: "Flota de Camiones", icon: Truck, href: "/flota" },
    { title: "Gestión Choferes", icon: Users, href: "/choferes" },
    { title: "Cartera Clientes", icon: Briefcase, href: "/clientes" },
    { title: "Cargas y Fletes", icon: Package, href: "/cargas" },
    { title: "Sedes Logísticas", icon: Building2, href: "/sedes" },
    { title: "Hoja de Ruta", icon: Route, href: "/rutas" },
    { title: "Análisis de Datos", icon: BarChart3, href: "/analytics" },
  ];

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = async () => {
    if (isMobile) setOpenMobile(false);
    if (!auth) return;
    try {
      await signOut(auth);
      router.push("/login");
      toast({ title: "Sesión cerrada correctamente" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al salir" });
    }
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="transition-all duration-200">
      <SidebarHeader className="h-16 flex items-center px-4 border-b overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-blue-600" onClick={handleLinkClick}>
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shrink-0">
            <Truck size={18} />
          </div>
          <span className="group-data-[collapsible=icon]:hidden tracking-tight text-xl truncate">Logística<span className="text-slate-900 dark:text-slate-100">Ar</span></span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Centro de Mando</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title} 
                    isActive={pathname === item.href}
                    onClick={handleLinkClick}
                  >
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
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Configuración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname === "/settings/tenant"}
                  tooltip="Ajustes del Sistema"
                  onClick={handleLinkClick}
                >
                  <Link href="/settings/tenant">
                    <Settings />
                    <span>Ajustes del Sistema</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-2 border-t">
        <SidebarMenuButton 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
          tooltip="Salir del Sistema"
        >
          <LogOut />
          <span className="group-data-[collapsible=icon]:hidden">Salir</span>
        </SidebarMenuButton>
      </div>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar />
        <SidebarInset className="bg-slate-50/50 dark:bg-slate-950/50">
          <header className="h-16 flex items-center justify-between px-4 border-b bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-blue-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">Panel de Control Nacional</h2>
            </div>
            <div className="flex items-center gap-4">
               <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="text-slate-500 hover:text-blue-600"
               >
                 {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
               </Button>
               <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                 AR
               </div>
               <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden lg:block">Operador Central</span>
            </div>
          </header>
          <main className="p-4 sm:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
