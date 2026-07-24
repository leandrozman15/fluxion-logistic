
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Truck, ShieldCheck, Globe, TrendingUp, MapPin, CheckCircle2, ArrowRight, Package, Clock, Ship, Zap } from "lucide-react";
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
            <a href="#comex" className="hover:text-blue-600 transition-colors">Red Mercosur</a>
          </div>
          <Button asChild className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Link href="/login">Acceso Operadores</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">
              <Globe className="w-3 h-3" /> Conectando el Cono Sur
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1]">
              Logística Inteligente para el <span className="text-blue-600">Corredor Bioceánico</span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
              La plataforma integral para flotas en Argentina, Chile, Brasil, Paraguay, Uruguay y Bolivia. Gestión de Comex, cumplimiento aduanero y tracking en tiempo real.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-blue-600 h-14 px-8 text-lg font-bold shadow-xl shadow-blue-200" asChild>
                <Link href="/login">Iniciar Demo Regional <ArrowRight className="ml-2" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold border-slate-200">
                Alianzas Mercosur
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                    <img src={`https://picsum.photos/seed/${i+10}/100/100`} alt="user" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 font-medium">Operando en las principales aduanas de la región.</p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-transparent rounded-3xl -z-10 blur-2xl"></div>
            <div className="rounded-2xl border bg-white shadow-2xl overflow-hidden p-1">
               <img 
                src="https://picsum.photos/seed/reg1/1200/800" 
                alt="Logística Regional" 
                className="w-full h-auto rounded-xl"
                data-ai-hint="container ship truck"
               />
            </div>
          </div>
        </div>
      </section>

      {/* Flag Section */}
      <section className="py-10 bg-slate-50 border-y">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center items-center gap-8 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
          {['Argentina', 'Chile', 'Paraguay', 'Uruguay', 'Bolivia', 'Brasil'].map(country => (
            <div key={country} className="flex items-center gap-2 font-bold text-slate-400">
              <Globe size={16} /> {country}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Infraestructura Tecnológica Regional</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Nuestra red soporta los flujos comerciales más exigentes de Sudamérica.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="text-yellow-500" />}
              title="Velocidad en Fronteras"
              description="Digitalización de MIC/DTA y Relación de Carga para minimizar los tiempos de espera en aduanas terrestres."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-green-600" />}
              title="Cumplimiento Multipaís"
              description="Validación de normativas específicas: CNRT (AR), MTT (CL), ANTT (BR) y registros DINATRAN (PY)."
            />
            <FeatureCard 
              icon={<Ship className="text-blue-600" />}
              title="Bioceánico & Hidrovía"
              description="Control total sobre cargas que transitan por los puertos del Atlántico y el Pacífico."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-bold">¿Busca expandir su flota regionalmente?</h2>
          <p className="text-xl text-blue-100">LogísticaAr le brinda la visibilidad necesaria para dominar el mercado del Cono Sur.</p>
          <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 h-16 px-12 text-xl font-bold shadow-2xl" asChild>
            <Link href="/login">Acceder al Sistema</Link>
          </Button>
        </div>
      </section>

      <footer className="py-12 border-t text-center text-slate-500 text-sm">
        <p>© 2024 LogísticaAr Regional. Operando desde el corazón del Mercosur.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl border shadow-sm hover:shadow-md transition-shadow space-y-4">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed text-sm">{description}</p>
    </div>
  );
}
