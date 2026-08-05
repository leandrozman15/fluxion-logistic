
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
  Zap,
  Box,
  Files,
  ShoppingBag,
  ShieldCheck,
  Layers,
  Map as MapIcon,
  User as UserIcon,
  Loader2,
  FileText
} from "lucide-react";
import Link from "next/link";
import { useAuth, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { getTenantProfile } from "@/lib/settings-api";
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DriverGpsPermission } from "@/components/DriverGpsPermission";

const SUPER_ADMIN_EMAIL = "leozman15@gmail.com";

const ADMIN_MENU_ITEMS = [
  { id: 'dashboard', title: "Monitor Operativo", icon: LayoutDashboard, href: "/dashboard" },
  { id: 'presupuestos', title: "Presupuestos Venta", icon: FileText, href: "/presupuestos" },
  { id: 'mercadolibre', title: "Mercado Libre", icon: ShoppingBag, href: "/mercadolibre" },
  { id: 'despacho', title: "Despacho Inteligente", icon: Zap, href: "/despacho" },
  { id: 'flota', title: "Flota de Camiones", icon: Truck, href: "/flota" },
  { id: 'choferes', title: "Gestión Choferes", icon: Users, href: "/choferes" },
  { id: 'clientes', title: "Cartera Clientes", icon: Briefcase, href: "/clientes" },
  { id: 'productos', title: "Catálogo Productos", icon: Box, href: "/productos" },
  { id: 'stock', title: "Stock Almacén", icon: Layers, href: "/stock" },
  { id: 'stock-layout', title: "Layout de Racks", icon: MapIcon, href: "/stock/layout" },
  { id: 'cargas', title: "Cargas y Fletes", icon: Package, href: "/cargas" },
  { id: 'remitos', title: "Buzón de Remitos", icon: Files, href: "/remitos" },
  { id: 'mantenimiento', title: "Mantenimiento", icon: Wrench, href: "/mantenimiento" },
  { id: 'sedes', title: "Depósitos y Sedes", icon: Building2, href: "/sedes" },
  { id: 'analytics', title: "Análisis de Datos", icon: BarChart3, href: "/analytics" },
];

function DashboardSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();
  const auth = useAuth();
  const { user } = useUser();
  const { tenantId, role } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const isDriver = role === 'driver';

  useEffect(() => {
    let active = true;

    async function loadTenant() {
      if (!tenantId) {
        if (active) setTenant(null);
        return;
      }

      try {
        const tenantData = await getTenantProfile();
        if (!active) return;
        setTenant(tenantData);
      } catch {
        if (!active) return;
        setTenant(null);
      }
    }

    loadTenant();
    return () => {
      active = false;
    };
  }, [tenantId]);

  const filteredMenu = useMemo(() => {
    if (isDriver) return [];
    if (!tenant) return ADMIN_MENU_ITEMS;
    const enabled = tenant.settings?.enabledModules;
    
    return ADMIN_MENU_ITEMS.filter(item => {
        if (!enabled || enabled.length === 0) return true;
        return enabled.includes(item.id);
    });
  }, [tenant, isDriver]);

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = async () => {
    if (isMobile) setOpenMobile(false);
    if (!auth) return;
    try {
      await signOut(auth);
      router.push("/login");
      toast({ title: "Sesión cerrada" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al salir" });
    }
  };

  const logoUrl = tenant?.settings?.logoUrl || "/icono.png";
  const orgName = tenant?.name || "LogísticaAr";

  if (!mounted) return null;

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="h-16 flex items-center px-4 border-b overflow-hidden">
        <Link href="/" className="flex items-center gap-2 font-bold text-blue-600" onClick={handleLinkClick}>
          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0 overflow-hidden relative">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="group-data-[collapsible=icon]:hidden tracking-tight text-xl truncate uppercase">{orgName}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-red-600 font-black uppercase text-[10px]">SuperAdmin</SidebarGroupLabel>
            <SidebarGroupContent>
               <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/admin/tenants"} onClick={handleLinkClick} className="bg-slate-900 text-blue-400">
                      <Link href="/admin/tenants"><ShieldCheck className="animate-pulse" /><span className="font-black italic">Empresas</span></Link>
                    </SidebarMenuButton>
                 </SidebarMenuItem>
               </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isDriver && (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMenu.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.href} onClick={handleLinkClick}>
                      <Link href={item.href}>
                        <item.icon className={cn(
                          item.title.includes("Remitos") && "text-indigo-600",
                          item.title === "Mercado Libre" && "text-yellow-500",
                          item.id === 'presupuestos' && "text-emerald-600"
                        )} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-blue-600 font-black">Área Conductores</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="App Chofer" isActive={pathname.startsWith("/rutas")} onClick={handleLinkClick} className="hover:bg-blue-50">
                  <Link href="/rutas">
                    <Smartphone className="text-blue-600" />
                    <span className="font-bold">Mis Viajes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Mi Perfil" isActive={pathname === "/rutas/perfil"} onClick={handleLinkClick}>
                  <Link href="/rutas/perfil">
                    <UserIcon className="text-slate-400" />
                    <span>Mi Perfil</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isDriver && (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Ajustes</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/settings/tenant"} onClick={handleLinkClick}>
                    <Link href="/settings/tenant"><Settings /><span>Sistema</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <div className="mt-auto p-2 border-t">
        <SidebarMenuButton className="w-full text-destructive" onClick={handleLogout}>
          <LogOut />
          <span className="group-data-[collapsible=icon]:hidden">Salir</span>
        </SidebarMenuButton>
      </div>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { user } = useUser();
  const { role, loading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && role === 'driver') {
      const isDriverPath = pathname === '/rutas' || pathname.startsWith('/rutas/');
      const isAdminPath = pathname !== '/' && !isDriverPath;
      if (isAdminPath) {
        router.replace('/rutas');
      }
    }
  }, [role, loading, pathname, router]);
  
  if (loading || !mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar />
        <SidebarInset className="bg-slate-50/50 dark:bg-slate-950/50">
          <header className="h-16 flex items-center justify-between px-4 border-b bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-blue-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest truncate">
                {role === 'driver' ? 'Terminal Móvil Conductor' : 'Panel de Control Central'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
               <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                 {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
               </Button>
               <div className="flex items-center gap-3 pl-2 border-l">
                 <Avatar className="h-8 w-8 border shadow-sm">
                   <AvatarImage src={user?.photoURL || undefined} />
                   <AvatarFallback className="bg-blue-50 text-blue-600 text-[10px] font-bold">
                     {user?.email?.[0]?.toUpperCase()}
                   </AvatarFallback>
                 </Avatar>
                 <div className="hidden lg:flex flex-col items-start leading-none">
                   <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase">{user?.email?.split('@')[0]}</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{role?.replace('_', ' ') || 'Usuario'}</span>
                 </div>
               </div>
            </div>
          </header>
          <main className="p-4 sm:p-6">
            {role === 'driver' && <DriverGpsPermission />}
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
