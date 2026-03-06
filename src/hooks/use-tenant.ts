"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

/**
 * Hook para obter o tenantId. No modo aberto, sempre retorna 'default_tenant' se não houver perfil.
 */
export function useTenant() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const [tenantId, setTenantId] = useState<string | null>("default_tenant");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !db) {
      setTenantId("default_tenant");
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Tentamos ler o perfil, mas se não existir ou der erro, usamos o padrão de teste
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTenantId(data.tenantId || "default_tenant");
      } else {
        setTenantId("default_tenant");
      }
      setLoading(false);
    }, (error) => {
      // No modo de teste aberto, ignoramos erros de permissão e usamos o tenant padrão
      setTenantId("default_tenant");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, authLoading]);

  return { tenantId, loading };
}