
'use client';

import { useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

/**
 * Hook de usuario modificado para Acceso Libre (Modo Demo).
 * Provee un perfil de administrador master por defecto.
 */
export function useUser() {
  const auth = useAuth();
  
  // Mock de usuario administrador para acceso libre
  const mockUser = {
    uid: "demo_admin_user",
    email: "admin@logistica-ar.com",
    displayName: "Operador Central (Demo)",
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: "",
    tenantId: "default_tenant",
    delete: async () => {},
    getIdToken: async () => "mock-token",
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({})
  } as unknown as User;

  const [user, setUser] = useState<User | null>(mockUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    
    // Escuchamos el estado real, pero si no hay sesión, mantenemos el mock
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        // Mantenemos el mock para el modo libre
        setUser(mockUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
