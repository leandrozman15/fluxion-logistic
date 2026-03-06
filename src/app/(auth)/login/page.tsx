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
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Target, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { isFirebaseConfigValid } from "@/firebase/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  const { user: currentUser, loading: userLoading } = useUser();

  useEffect(() => {
    if (!userLoading && currentUser) {
      bootstrapUser(currentUser).then(() => {
        router.push("/dashboard");
      });
    }
  }, [currentUser, userLoading, router]);

  const bootstrapUser = async (user: User) => {
    if (!db) return;

    try {
      const tenantId = "default_tenant";
      
      // No modo aberto, garantimos que todos os usuários tenham acesso ao tenant padrão
      const userRef = doc(db, "users", user.uid);
      
      // 1. Create/Update Tenant
      const tenantRef = doc(db, "tenants", tenantId);
      await setDoc(tenantRef, {
        id: tenantId,
        name: "Fluxion Radar HQ (Public Test)",
        plan: "pro",
        updatedAt: serverTimestamp(),
        settings: {
          scoringWeights: { effective: 0.6, ai: 0.4 },
          finalScoreMode: 'weighted',
          dailyTopLimit: 30,
          onboardingCompleted: true, // Bypass onboarding para testes
          autoDiscoveryEnabled: true
        }
      }, { merge: true });

      // 2. Create Global User Profile
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || "User",
        tenantId: tenantId,
        role: "admin", // Todos são admin no modo teste
        createdAt: new Date().toISOString(),
        status: "active"
      }, { merge: true });

      // 3. Create Tenant Membership
      const tenantUserRef = doc(db, "tenants", tenantId, "users", user.uid);
      await setDoc(tenantUserRef, {
        uid: user.uid,
        email: user.email,
        role: "admin",
        createdAt: new Date().toISOString()
      }, { merge: true });

    } catch (error: any) {
      console.error("Bootstrap error:", error);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await bootstrapUser(userCredential.user);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Erro ao acessar",
        description: "Credenciais inválidas.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      await bootstrapUser(userCredential.user);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Google login error:", error);
      toast({
        variant: "destructive",
        title: "Erro na autenticação",
        description: "Falha ao entrar com Google.",
      });
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
          <p className="text-muted-foreground">MODO DE TESTE ABERTO</p>
        </div>

        {!isFirebaseConfigValid && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Configuração necessária:</strong> As credenciais do Firebase não estão configuradas.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-lg">
          <CardHeader>
            <CardTitle>Acesso Liberado</CardTitle>
            <CardDescription>Qualquer conta terá permissão de administrador para testes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || !isFirebaseConfigValid}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || !isFirebaseConfigValid}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 mt-2"
                disabled={isLoading || !isFirebaseConfigValid}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Entrar
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleLogin}
              disabled={isLoading || !isFirebaseConfigValid}
            >
              Entrar com Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}