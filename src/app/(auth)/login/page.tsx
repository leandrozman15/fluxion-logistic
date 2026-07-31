
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Truck, ShieldCheck, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Bienvenido al Sistema",
        description: "Iniciando sesión en el Panel de Control.",
      });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = "Verifique sus credenciales e intente nuevamente.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Email o contraseña incorrectos.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Demasiados intentos. Intente más tarde.";
      }

      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center border-2 border-blue-100 overflow-hidden mb-4">
            <Image src="/icono.png" alt="Logo" width={64} height={64} className="object-contain" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
            Logística<span className="text-blue-600">Ar</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            Control de Flota y Gestión Logística
          </p>
        </div>

        <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-8">
            <CardTitle className="text-lg font-black uppercase italic tracking-tight flex items-center gap-2">
              <Lock size={18} className="text-blue-400" /> Ingreso de Personal
            </CardTitle>
            <CardDescription className="text-white/40 text-[10px] uppercase font-bold tracking-widest">
              Identifíquese para acceder a la red operativa
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400 ml-1">Correo Electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="usuario@logistica-ar.com" 
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase text-slate-400 ml-1">Contraseña</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95" 
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                INICIAR SESIÓN
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-slate-50 p-6 flex flex-col gap-4 text-center">
             <div className="flex items-center gap-2 justify-center text-[10px] font-bold text-slate-400 uppercase">
                <ShieldCheck size={14} className="text-blue-500" />
                Acceso encriptado y auditado
             </div>
             <p className="text-[9px] text-slate-300 italic">
               Si olvidó su contraseña o requiere acceso, contacte con el Administrador de Sistemas.
             </p>
          </CardFooter>
        </Card>

        <div className="text-center">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
             LogísticaAr Digital Core v3.0
           </p>
        </div>
      </div>
    </div>
  );
}
