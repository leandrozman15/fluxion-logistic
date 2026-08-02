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
  Archive,
  ShoppingBag,
  ShieldCheck,
  Layers,
  Map as MapIcon,
  User as UserIcon,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useAuth, useFirestore, useDoc, useUser } from "@/firebase";
import { useTenant } from "@/hooks/use-tenant";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useMemo, useState, useEffect } from "react";
import { doc } from "firebase/firestore";
import { Tenant } from "@/app/lib/types";
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const SUPER_ADMIN_EMAIL = "leozman15@gmail.com";

const ADMIN_MENU_ITEMS = [
  { id: 'dashboard', title: "Monitor Operativo", icon: LayoutDashboard, href: "/dashboard" },
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
  const db = useFirestore();
  const { user } = useUser();
  const { tenantId, role } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const isDriver = role === 'driver';

  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

  const filteredMenu = useMemo(() => {
    // Si es chofer, no mostramos ningún ítem administrativo
    if (isDriver) return [];
    
    if (!tenant) return ADMIN_MENU_ITEMS;
    const enabled = tenant.settings?.enabledModules;
    if (!enabled || enabled.length === 0) return ADMIN_MENU_ITEMS;
    return ADMIN_MENU_ITEMS.filter(item => enabled.includes(item.id));
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
      toast({ title: "Sesión cerrada correctamente" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al salir" });
    }
  };

  const logoUrl = tenant?.settings?.logoUrl || "/icono.png";
  const orgName = tenant?.name || "LogísticaAr";

  if (!mounted) return null;

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="transition-all duration-200">
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
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-red-600 dark:text-red-400 font-black tracking-widest uppercase text-[10px]">SuperAdmin</SidebarGroupLabel>
            <SidebarGroupContent>
               <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      isActive={pathname === "/admin/tenants"}
                      onClick={handleLinkClick}
                      className="bg-slate-900 text-blue-400 hover:bg-slate-800 hover:text-blue-300"
                    >
                      <Link href="/admin/tenants">
                        <ShieldCheck className="animate-pulse" />
                        <span className="font-black italic">Control de Empresas</span>
                      </Link>
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
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title} 
                      isActive={pathname === item.href}
                      onClick={handleLinkClick}
                    >
                      <Link href={item.href}>
                        <item.icon className={cn(
                          item.title.includes("Remitos") && "text-indigo-600",
                          item.title === "Mercado Libre" && "text-yellow-500",
                          item.id === 'stock' && "text-orange-500",
                          item.id === 'stock-layout' && "text-blue-600"
                        )} />
                        <span className={cn(
                          item.title.includes("Remitos") && "font-bold text-indigo-700",
                          item.title === "Mercado Libre" && "font-black text-slate-900"
                        )}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-blue-600 dark:text-blue-400 font-black">Área Conductores</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  tooltip="App Chofer (Mis Viajes)" 
                  isActive={pathname.startsWith("/rutas")}
                  onClick={handleLinkClick}
                  className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <Link href="/rutas">
                    <Smartphone className="text-blue-600" />
                    <span className="font-bold">App Chofer</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isDriver && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    tooltip="Mi Perfil" 
                    isActive={pathname === "/rutas/perfil"}
                    onClick={handleLinkClick}
                  >
                    <Link href="/rutas/perfil">
                      <UserIcon className="text-slate-400" />
                      <span>Mi Perfil Técnico</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isDriver && (
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
        )}
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
  const { user } = useUser();
  const { tenantId, role, loading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Proteger rutas administrativas si el usuario es Chofer
  useEffect(() => {
    if (!loading && role === 'driver') {
      const isTryingAdminPath = !pathname.startsWith('/rutas') && pathname !== '/';
      if (isTryingAdminPath) {
        router.replace('/rutas');
      }
    }
  }, [role, loading, pathname, router]);
  
  const tenantRef = useMemo(() => {
    if (!db || !tenantId) return null;
    return doc(db, "tenants", tenantId);
  }, [db, tenantId]);

  const { data: tenant } = useDoc<Tenant>(tenantRef);

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
              <h2 className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
                {role === 'driver' ? 'Terminal Móvil del Conductor' : 'Panel de Control Nacional'}
              </h2>
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
               
               <div className="flex items-center gap-3 pl-2 border-l">
                 <Avatar className="h-8 w-8 border shadow-sm">
                   <AvatarImage src={user?.photoURL || undefined} />
                   <AvatarFallback className="bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">
                     {user?.email?.[0] || <UserIcon size={14} />}
                   </AvatarFallback>
                 </Avatar>
                 <div className="hidden lg:flex flex-col items-start leading-none">
                   <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[150px]">
                     {user?.email?.split('@')[0] || 'Usuario'}
                   </span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                     {role === 'admin' ? 'Super Administrador' : (role === 'driver' ? 'Conductor Profesional' : (role?.replace('_', ' ') || 'Colaborador'))}
                   </span>
                 </div>
               </div>
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
