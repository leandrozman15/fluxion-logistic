
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
import { Target, Loader2, ShieldCheck, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    if (!userLoading && currentUser) {
      router.push("/dashboard");
    }
  }, [currentUser, userLoading, router]);

  const bootstrapUser = async (user: User) => {
    if (!db) return;
    try {
      const tenantId = "default_tenant";
      // No modo teste, garantimos que os documentos existam para evitar erros de permissão
      await setDoc(doc(db, "tenants", tenantId), {
        name: "Fluxion Radar HQ",
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

      await setDoc(doc(db, "tenants", tenantId, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: "admin"
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
      toast({ variant: "destructive", title: "Erro no login", description: "Verifique suas credenciais." });
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
      toast({ variant: "destructive", title: "Erro Google" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4">
            <Target className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-primary">Fluxion Radar</h1>
          <div className="flex items-center justify-center gap-2 text-green-600 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Modo de Teste Aberto
          </div>
        </div>

        <Card className="border shadow-lg">
          <CardHeader>
            <CardTitle>Bem-vindo</CardTitle>
            <CardDescription>Entre para acessar o ecossistema industrial.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full bg-primary" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Acessar Plataforma
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
              Entrar com Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
