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

const BOOTSTRAP_UID = "4zxTMJtXvbh5DjWF8xSrITJh1W33";
const BOOTSTRAP_EMAIL = "leozman15@gmail.com";

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
      // Re-run bootstrap check just in case it was interrupted
      bootstrapUser(currentUser).then(() => {
        router.push("/dashboard");
      });
    }
  }, [currentUser, userLoading, router]);

  const bootstrapUser = async (user: User) => {
    if (!db) return;

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const isInitialAdmin = user.uid === BOOTSTRAP_UID || user.email === BOOTSTRAP_EMAIL;
        const tenantId = "default_tenant";

        // 1. Create Tenant if it doesn't exist
        const tenantRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantRef);
        
        if (!tenantSnap.exists()) {
          await setDoc(tenantRef, {
            id: tenantId,
            name: "Fluxion Radar HQ",
            plan: "pro",
            createdAt: serverTimestamp(),
            settings: {
              scoringWeights: { effective: 0.6, ai: 0.4 },
              finalScoreMode: 'weighted',
              dailyTopLimit: 30,
              onboardingCompleted: false,
              autoDiscoveryEnabled: false
            }
          });
        }

        // 2. Create Global User Profile (Root Index)
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || "Admin",
          tenantId: tenantId,
          role: isInitialAdmin ? "admin" : "sales",
          createdAt: new Date().toISOString(),
          status: "active"
        });

        // 3. Create Tenant Membership
        const tenantUserRef = doc(db, "tenants", tenantId, "users", user.uid);
        await setDoc(tenantUserRef, {
          uid: user.uid,
          email: user.email,
          role: isInitialAdmin ? "admin" : "sales",
          createdAt: new Date().toISOString()
        });

        toast({
          title: "Acesso Configurado",
          description: "Sua conta de administrador foi vinculada com sucesso.",
        });
      }
    } catch (error: any) {
      console.error("Bootstrap error:", error);
      // Don't show toast here to avoid loops, just log
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
        description: "Credenciais inválidas ou erro de rede. Verifique seu e-mail e senha.",
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
        description: "Não foi possível entrar com Google Workspace.",
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
          <p className="text-muted-foreground">Inteligência Industrial de Prospecção</p>
        </div>

        {!isFirebaseConfigValid && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Configuração necessária:</strong> As credenciais do Firebase não estão configuradas corretamente.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-lg">
          <CardHeader>
            <CardTitle>Acesse sua conta</CardTitle>
            <CardDescription>Entre com suas credenciais para gerenciar seus prospects.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email corporativo</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nome@empresa.com.br" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || !isFirebaseConfigValid}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link href="#" className="text-xs text-accent hover:underline">Esqueceu a senha?</Link>
                </div>
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
                Entrar no Sistema
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleLogin}
              disabled={isLoading || !isFirebaseConfigValid}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google Workspace
            </Button>
          </CardFooter>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground">
          Ao entrar, você concorda com nossos <Link href="#" className="underline">Termos de Uso</Link> e <Link href="#" className="underline">Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}