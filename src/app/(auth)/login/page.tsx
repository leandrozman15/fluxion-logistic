
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  User
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Truck, Loader2, ShieldCheck, Play, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user: currentUser, loading: userLoading } = useUser();

  // Se já estiver logado, redireciona direto
  useEffect(() => {
    if (!userLoading && currentUser && currentUser.email !== "admin@fluxionradar.com") {
      router.push("/dashboard");
    }
  }, [currentUser, userLoading, router]);

  const bootstrapUser = async (user: User) => {
    if (!db) return;
    try {
      const tenantId = "default_tenant";
      await setDoc(doc(db, "tenants", tenantId), {
        name: "LogísticaAr Casa Central",
        plan: "pro",
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        tenantId: tenantId,
        role: "admin",
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Bootstrap failed", e);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await bootstrapUser(cred.user);
      router.push("/dashboard");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en el login", description: "Verifique sus credenciales." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await bootstrapUser(cred.user);
      router.push("/dashboard");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error con Google" });
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
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>Ingrese al panel de control nacional de flota.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" placeholder="nombre@empresa.com.ar" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full bg-blue-600 h-12 text-lg font-bold" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Acceder al Sistema
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">O continuar con</span></div>
            </div>
            <Button variant="outline" className="w-full h-11" onClick={handleGoogleLogin} disabled={isLoading}>
              Google Workspace
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
