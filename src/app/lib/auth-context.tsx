"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getIdTokenResult, onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AppUser } from "./types";

const BACKEND_TOKEN_KEY = "backendBearerToken";

async function refreshBackendSession(idToken: string) {
  try {
    const response = await fetch("/api/auth/backend-session", {
      method: "POST",
      headers: { authorization: `Bearer ${idToken}` },
    });
    const data = await response.json();
    if (response.ok && data.token) {
      sessionStorage.setItem(BACKEND_TOKEN_KEY, data.token);
    } else {
      console.error("No se pudo obtener la sesión del backend:", data.message);
      sessionStorage.removeItem(BACKEND_TOKEN_KEY);
    }
  } catch (e) {
    console.error("Error al conectar con el backend:", e);
  }
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  tenantId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  tenantId: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const tokenResult = await getIdTokenResult(firebaseUser);
          const claims = tokenResult.claims as Record<string, unknown>;

          const tenantId = typeof claims.tenantId === "string" ? claims.tenantId : "";
          const role = typeof claims.role === "string" ? claims.role : "viewer";
          const status = typeof claims.status === "string" ? claims.status : "active";

          const resolvedUser: AppUser = {
            uid: firebaseUser.uid,
            tenantId,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || undefined,
            role: role as AppUser["role"],
            status: status as AppUser["status"],
            lastLogin: firebaseUser.metadata.lastSignInTime || undefined,
            createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          };

          setAppUser(resolvedUser);
          await refreshBackendSession(tokenResult.token);
        } catch (e) {
          console.error("Error cargando perfil de usuario:", e);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
        sessionStorage.removeItem(BACKEND_TOKEN_KEY);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      appUser, 
      loading, 
      tenantId: appUser?.tenantId || null 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
