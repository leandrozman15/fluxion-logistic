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
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Building2, 
  Briefcase, 
  BarChart3, 
  Moon,
  Sun,
  Smartphone,
  Wrench,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useAuth, useFirestore, useDoc } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { doc } from "firebase/firestore";
import { Tenant } from "@/app/lib/types";

/**
 * Componente interno que maneja la lógica de cierre automático en móviles.
 */
function DashboardSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const tenantRef = useMemo(() => {
    if (!db) return null;
    return doc(db, "tenants", "default_tenant");
  }, [db]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const adminMenu = [
    { title: "Monitor Operativo", icon: LayoutDashboard, href: "/dashboard" },
    { title: "Despacho Inteligente", icon: Zap, href: "/despacho" },
    { title: "Flota de Camiones", icon: Truck, href: "/flota" },
    { title: "Gestión Choferes", icon: Users, href: "/choferes" },
    { title: "Cartera Clientes", icon: Briefcase, href: "/clientes" },
    { title: "Cargas y Fletes", icon: Package, href: "/cargas" },
    { title: "Mantenimiento", icon: Wrench, href: "/mantenimiento" },
    { title: "Sedes Logísticas", icon: Building2, href: "/sedes" },
    { title: "Análisis de Datos", icon: BarChart3, href: "/analytics" },
  ];

  const driverMenu = [
    { title: "App Chofer (Mis Viajes)", icon: Smartphone, href: "/rutas" },
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

  const logoUrl = tenant?.settings?.logoUrl || "/icono.png";
  const orgName = tenant?.name || "LogísticaAr";

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="transition-all duration-200">
      <SidebarHeader className="h-16 flex items-center px-4 border-b overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-blue-600" onClick={handleLinkClick}>
          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 overflow-hidden relative">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="group-data-[collapsible=icon]:hidden tracking-tight text-xl truncate uppercase">{orgName}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenu.map((item) => (
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
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-blue-600 dark:text-blue-400 font-black">Área Conductores</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {driverMenu.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title} 
                    isActive={pathname.startsWith(item.href)}
                    onClick={handleLinkClick}
                    className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <Link href={item.href}>
                      <item.icon className="text-blue-600" />
                      <span className="font-bold">{item.title}</span>
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
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const tenantRef = useMemo(() => {
    if (!db) return null;
    return doc(db, "tenants", "default_tenant");
  }, [db]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);
  const logoUrl = tenant?.settings?.logoUrl || "/icono.png";

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
                 {mounted ? (
                   theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />
                 ) : (
                   <div className="w-5 h-5" />
                 )}
               </Button>
               <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 border shadow-sm relative">
                 <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
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