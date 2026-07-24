
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir directamente al dashboard operativo
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-500 font-medium animate-pulse">Cargando Sistema Logístico...</p>
      </div>
    </div>
  );
}
