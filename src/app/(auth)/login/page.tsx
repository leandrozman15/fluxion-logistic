
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Pantalla de Login: Deshabilitada.
 * Redirige automáticamente al Dashboard en modo acceso libre.
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-2 text-blue-600 font-bold">
        <Loader2 className="animate-spin" />
        Acceso Libre Activo...
      </div>
    </div>
  );
}
