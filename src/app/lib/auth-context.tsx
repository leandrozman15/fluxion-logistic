"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppUser } from "./types";

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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser && db) {
        // En un sistema multi-tenant serio, buscamos el mapeo uid -> tenantId
        // Por ahora, asumiremos que existe una colección global de perfiles o buscamos en tenants
        // Para el MVP, intentaremos encontrar al usuario en la base de datos
        try {
          // Nota: Aquí necesitaríamos una forma de saber a qué tenant pertenece el usuario
          // Una opción es que el tenantId esté en los custom claims del token o en una colección 'users' raíz
          // Para este diseño, buscaremos en una colección de 'profiles' raíz que apunte al tenant
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setAppUser(userDoc.data() as AppUser);
          }
        } catch (e) {
          console.error("Error cargando perfil de usuario:", e);
        }
      } else {
        setAppUser(null);
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
