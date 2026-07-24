
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Truck, ShieldCheck, Globe, TrendingUp, MapPin, CheckCircle2, ArrowRight, Package, Clock } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-blue-600 text-xl">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white">
              <Truck size={18} />
            </div>
            <span>Logística<span className="text-slate-900">Ar</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Características</a>
            <a href="#compliance" className="hover:text-blue-600 transition-colors">Cumplimiento</a>
            <a href="#comex" className="hover:text-blue-600 transition-colors">Comex</a>
          </div>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Link href="/login">Acceso Clientes</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              Lanzamiento Argentina 2024
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1]">
              El Sistema Operativo de la <span className="text-blue-600">Logística Argentina</span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
              Gestione su flota, controle su documentación legal y optimice sus operaciones de Comex en una sola plataforma diseñada para la realidad del transporte nacional.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-blue-600 h-14 px-8 text-lg font-bold shadow-xl shadow-blue-200" asChild>
                <Link href="/login">Probar Demo Gratis <ArrowRight className="ml-2" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold border-slate-200">
                Contactar Ventas
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                    <img src={`https://picsum.photos/seed/${i}/100/100`} alt="user" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 font-medium">+50 flotas activas en el corredor Argentina-Brasil</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-transparent rounded-3xl -z-10 blur-2xl"></div>
            <div className="rounded-2xl border bg-white shadow-2xl overflow-hidden">
               <img 
                src="https://picsum.photos/seed/fleet1/1200/800" 
                alt="LogísticaAr Dashboard" 
                className="w-full h-auto"
                data-ai-hint="freight truck"
               />
            </div>
            {/* Floating KPI mock */}
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl border shadow-xl animate-bounce duration-[3000ms]">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                   <TrendingUp size={20} />
                 </div>
                 <div>
                   <p className="text-[10px] uppercase font-bold text-slate-400">Eficiencia</p>
                   <p className="text-lg font-bold">+15.4% este mes</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Tecnología de Punta para su Flota</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Módulos integrados que cubren cada aspecto de la cadena de suministro nacional e internacional.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<MapPin className="text-blue-600" />}
              title="Seguimiento GPS Real"
              description="Monitoreo satelital constante de sus unidades con cálculo de ETA ajustado por tráfico y clima."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-green-600" />}
              title="Compliance CNRT"
              description="Alertas automáticas de vencimiento de LINTI, RTO y seguros para evitar multas costosas."
            />
            <FeatureCard 
              icon={<Globe className="text-orange-600" />}
              title="Gestión Aduanera"
              description="Preparado para el sistema MALVINA y MIC/DTA digital para cruces de frontera eficientes."
            />
          </div>
        </div>
      </section>

      {/* Value Prop Argentina */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center">
          <div>
             <h2 className="text-4xl font-bold text-slate-900 mb-6 leading-tight">Diseñado para la realidad del transporte en Argentina</h2>
             <div className="space-y-6">
                <ValuePoint title="Optimización de Combustible" text="Análisis de hábitos de conducción para reducir el gasto de gasoil entre un 10% y 15%." />
                <ValuePoint title="Gestión de CUIT y AFIP" text="Integración de datos fiscales para facturación automática y validación de dadores de carga." />
                <ValuePoint title="Hoja de Ruta Digital" text="Herramienta mobile para que sus conductores reporten estados en tiempo real sin llamadas." />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-4 pt-12">
                <StatCard label="Flota Activa" value="500+" />
                <StatCard label="Remitos Digitales" value="10k+" />
             </div>
             <div className="space-y-4">
                <StatCard label="Entregas OTIF" value="94%" />
                <StatCard label="Puntos de Carga" value="120+" />
             </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-bold">¿Listo para digitalizar su operación?</h2>
          <p className="text-xl text-blue-100">Únase a las empresas que ya están transformando la logística en el Cono Sur.</p>
          <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 h-16 px-12 text-xl font-bold shadow-2xl" asChild>
            <Link href="/login">Comenzar Ahora</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 font-bold text-blue-600 mb-4">
          <Truck size={18} />
          <span>LogísticaAr Argentina</span>
        </div>
        <p>© 2024 LogísticaAr S.A. Todos los derechos reservados. Buenos Aires, Argentina.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border shadow-sm hover:shadow-md transition-shadow space-y-4 text-center md:text-left">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto md:mx-0">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function ValuePoint({ title, text }: { title: string, text: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <CheckCircle2 className="text-blue-600" size={14} />
      </div>
      <div>
        <h4 className="font-bold text-slate-900">{title}</h4>
        <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-slate-900 p-8 rounded-2xl text-white text-center">
      <div className="text-3xl font-black mb-2">{value}</div>
      <div className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{label}</div>
    </div>
  );
}
