'use client';

import { useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

/**
 * Hook de usuário modificado para Modo Livre.
 * Se não houver um usuário real, ele simula um Administrador Master.
 */
export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>({
    uid: "4zxTMJtXvbh5DjWF8xSrITJh1W33",
    email: "admin@fluxionradar.com",
    displayName: "Admin Master (Modo Livre)",
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "",
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({})
  } as any);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      }
      // Se não houver usuário, mantemos o mock acima para o app não travar
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
