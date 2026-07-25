"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

/**
 * Pantalla Raíz: Redirección inmediata al Dashboard.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-24 h-24 flex items-center justify-center overflow-hidden">
          <Image src="/icono.png" alt="LogísticaAr Logo" width={96} height={96} className="object-contain" />
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
