
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";

/**
 * Pantalla Raíz: Redirección inmediata al Dashboard.
 * Se elimina la landing page para que el sistema sea de acceso directo.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir directamente al panel operativo
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
          <Truck size={40} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Logística<span className="text-blue-600">Ar</span></h1>
          <p className="text-sm text-slate-500 font-medium">Iniciando sistema central...</p>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mt-4" />
      </div>
    </div>
  );
}
