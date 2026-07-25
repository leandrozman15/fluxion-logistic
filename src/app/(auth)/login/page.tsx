
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Loader2, ShieldCheck, Play, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();

  const handleFastAccess = async () => {
    setIsLoading(true);
    try {
      if (db) {
        const tenantId = "default_tenant";
        // Aseguramos que la organización exista para el modo demo
        await setDoc(doc(db, "tenants", tenantId), {
          name: "LogísticaAr Demo",
          plan: "pro",
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      toast({ 
        title: "Acceso Concedido", 
        description: "Ingresando al sistema en modo demostración." 
      });
      
      // Redirigir al dashboard directamente
      router.push("/dashboard");
    } catch (error) {
      console.error("Error en acceso rápido:", error);
      // Aún si falla Firestore, redirigimos para no bloquear la demo
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-4 transition-colors">
            <ArrowLeft size={16} /> Volver al inicio
          </Link>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4 shadow-xl shadow-blue-200">
            <Truck className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Logística<span className="text-blue-600">Ar</span></h1>
          <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-xs uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" /> Acceso de Operadores
          </div>
        </div>

        <Card className="border shadow-2xl bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
            <CardDescription>Haga clic abajo para ingresar al panel de control nacional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleFastAccess} 
              className="w-full bg-blue-600 h-16 text-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200" 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
              ) : (
                <Play className="w-6 h-6 mr-2 fill-current" />
              )}
              Entrar al Sistema
            </Button>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] text-blue-700 font-bold uppercase mb-1 flex items-center gap-1">
                <ShieldCheck size={10} /> Modo Acceso Libre Activo
              </p>
              <p className="text-xs text-blue-600 leading-relaxed">
                Usted está ingresando con un perfil de Administrador Temporal para evaluar las funcionalidades de la plataforma.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
