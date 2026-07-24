"use client";

import { Truck, Users, Package, MapPin, TrendingUp, ChevronRight, LayoutDashboard, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function HomePage() {
  const stats = [
    { title: "Camiones Activos", value: "24", icon: Truck, color: "text-blue-600" },
    { title: "Cargas Pendientes", value: "12", icon: Package, color: "text-orange-600" },
    { title: "Choferes en Ruta", value: "18", icon: Users, color: "text-green-600" },
    { title: "Entregas Hoy", value: "45", icon: TrendingUp, color: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Logístico */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
              <Truck size={20} />
            </div>
            <span>Logística<span className="text-blue-600">Ar</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            <Link href="/flota" className="hover:text-blue-600 transition-colors">Flota</Link>
            <Link href="/choferes" className="hover:text-blue-600 transition-colors">Choferes</Link>
            <Link href="/cargas" className="hover:text-blue-600 transition-colors">Cargas</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Plus className="w-4 h-4 mr-2" /> Nueva Carga
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              Acceso Staff
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel de Control Operativo</h1>
            <p className="text-slate-500">Monitoreo en tiempo real de la logística nacional.</p>
          </div>
          <Button variant="secondary" size="sm">
            <LayoutDashboard className="w-4 h-4 mr-2" /> Modo Operador
          </Button>
        </div>

        {/* Quick KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{s.title}</CardTitle>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
                <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Actualizado ahora</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Placeholder */}
          <Card className="lg:col-span-2 shadow-sm border-none overflow-hidden flex flex-col">
            <CardHeader className="bg-white border-b">
              <CardTitle>Estado Geográfico de Unidades</CardTitle>
              <CardDescription>Ubicación reportada por provincia (Argentina).</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-[400px] flex items-center justify-center bg-slate-100 relative group">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              <div className="text-center space-y-3 z-10">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto shadow-inner group-hover:scale-110 transition-transform">
                  <MapPin className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-slate-600 font-semibold text-lg">Mapa de Tráfico y Rutas</p>
                <div className="flex gap-2 justify-center">
                  <Badge variant="outline" className="bg-white">BS AS: 10</Badge>
                  <Badge variant="outline" className="bg-white">Sante Fe: 4</Badge>
                  <Badge variant="outline" className="bg-white">Córdoba: 3</Badge>
                </div>
                <p className="text-xs text-slate-400 max-w-[250px] mx-auto">Próximamente: Integración con GPS satelital y alertas de desvío.</p>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <Card className="shadow-sm border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg">Gestión Rápida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-between h-12 text-sm" variant="outline">
                  Registrar Nuevo Viaje <ChevronRight size={16} />
                </Button>
                <Button className="w-full justify-between h-12 text-sm" variant="outline">
                  Asignar Chofer a Unidad <ChevronRight size={16} />
                </Button>
                <Button className="w-full justify-between h-12 text-sm" variant="outline">
                  Reporte de Hoja de Ruta <ChevronRight size={16} />
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-slate-900 text-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" /> Alertas Críticas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="text-xs font-bold text-red-400 uppercase mb-1">Vencimiento VTV</div>
                    <p className="text-sm">Dominio <b>AD-455-GH</b> vence en 48hs.</p>
                  </div>
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="text-xs font-bold text-orange-400 uppercase mb-1">Ruta Nacional 9</div>
                    <p className="text-sm">Demoras pesadas altura Rosario por obras.</p>
                  </div>
                </div>
                <Button variant="ghost" className="w-full text-xs text-slate-400 hover:text-white" size="sm">
                  Ver todas las notificaciones
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium">
          <p>© 2025 LogísticaAr - Gestión Inteligente de Carga.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-blue-600">Soporte Técnico</Link>
            <Link href="#" className="hover:text-blue-600">Documentación</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
