
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Intento de inicio de sesión real contra Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);
      
      toast({
        title: "Acceso Concedido",
        description: "Bienvenido al Panel de Control de LogísticaAr.",
      });
      
      router.push("/dashboard");
    } catch (error: any) {
      // Capturamos el error para mostrarlo en el UI y evitar el Red Screen
      let message = "Error de conexión. Verifique su internet.";
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = "El email o la contraseña son incorrectos. Asegúrese de haber creado este usuario (leozman15@gmail.com) en la Consola de Firebase -> Authentication.";
      } else if (error.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico no es válido.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Demasiados intentos fallidos. Su acceso ha sido bloqueado temporalmente.";
      }

      setErrorMessage(message);
      
      toast({
        variant: "destructive",
        title: "Fallo de Ingreso",
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
              <Lock size={18} className="text-blue-400" /> Acceso al Sistema
            </CardTitle>
            <CardDescription className="text-white/40 text-[10px] uppercase font-bold tracking-widest">
              Ingrese sus credenciales de personal autorizado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {errorMessage && (
              <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800 rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs font-black uppercase">Error de Autenticación</AlertTitle>
                <AlertDescription className="text-[10px] font-medium leading-tight">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400 ml-1">Correo Electrónico</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="leozman15@gmail.com" 
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase text-slate-400 ml-1">Contraseña</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    className="h-12 rounded-xl bg-slate-50 border-none font-bold pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
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
                Conexión segura y encriptada
             </div>
             <p className="text-[9px] text-slate-300 italic">
               Si no puede ingresar, verifique que el usuario esté habilitado en la consola de administración.
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
