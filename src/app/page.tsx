"use client";

import { Truck, Users, Package, MapPin, TrendingUp, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
  const stats = [
    { title: "Camiones Activos", value: "24", icon: Truck, color: "text-blue-600" },
    { title: "Cargas Pendientes", value: "12", icon: Package, color: "text-orange-600" },
    { title: "Choferes en Ruta", value: "18", icon: Users, color: "text-green-600" },
    { title: "Entregas Hoy", value: "45", icon: TrendingUp, color: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <div className="bg-blue-600 text-white p-1 rounded">
              <Truck size={24} />
            </div>
            <span>Logística<span className="text-blue-600">Ar</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/flota" className="hover:text-blue-600 transition-colors">Flota</Link>
            <Link href="/choferes" className="hover:text-blue-600 transition-colors">Choferes</Link>
            <Link href="/cargas" className="hover:text-blue-600 transition-colors">Cargas</Link>
            <Link href="/rutas" className="hover:text-blue-600 transition-colors">Rutas</Link>
          </nav>
          <Button className="bg-blue-600 hover:bg-blue-700">Acceso Sistema</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{s.title}</CardTitle>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-sm border-none">
            <CardHeader>
              <CardTitle>Estado de la Flota en Tiempo Real</CardTitle>
              <CardDescription>Monitoreo geográfico de unidades por provincia.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center bg-slate-100 rounded-lg m-6 border-2 border-dashed border-slate-200">
              <div className="text-center space-y-2">
                <MapPin className="mx-auto h-12 w-12 text-slate-300" />
                <p className="text-slate-500 font-medium">Mapa Interactivo (Argentina)</p>
                <p className="text-xs text-slate-400">Próximamente: Integración con GPS</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none">
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-between" variant="outline">
                Registrar Nuevo Viaje <ChevronRight size={16} />
              </Button>
              <Button className="w-full justify-between" variant="outline">
                Asignar Carga a Camión <ChevronRight size={16} />
              </Button>
              <Button className="w-full justify-between" variant="outline">
                Reporte de Consumo <ChevronRight size={16} />
              </Button>
              <div className="pt-6 border-t">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Alertas Críticas</h4>
                <div className="space-y-3">
                  <div className="flex gap-3 text-sm p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
                    <div className="font-bold">VTV:</div>
                    <p>Dominio AD-455-GH vence en 3 días.</p>
                  </div>
                  <div className="flex gap-3 text-sm p-3 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
                    <div className="font-bold">RUTA:</div>
                    <p>Corte en RN 9 altura Rosario.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}