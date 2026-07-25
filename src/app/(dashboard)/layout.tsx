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
  SidebarTrigger
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
  Mail 
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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

  const handleLogout = async () => {
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="h-16 flex items-center px-4 border-b">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-blue-600">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
                <Truck size={18} />
              </div>
              <span className="group-data-[collapsible=icon]:hidden tracking-tight text-xl">Logística<span className="text-slate-900">Ar</span></span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Centro de Mando</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.href}>
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
              <SidebarGroupLabel>Configuración</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/settings/tenant"}>
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
          <div className="mt-auto p-4 border-t">
            <SidebarMenuButton 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut />
              <span className="group-data-[collapsible=icon]:hidden">Salir del Sistema</span>
            </SidebarMenuButton>
          </div>
        </Sidebar>
        <SidebarInset className="bg-slate-50/50">
          <header className="h-16 flex items-center justify-between px-4 border-b bg-white sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-blue-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest truncate">Panel de Control Nacional</h2>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                 AR
               </div>
               <span className="text-sm font-semibold text-slate-700 hidden lg:block">Operador Central</span>
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
