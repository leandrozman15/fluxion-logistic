
"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

/**
 * Hook para obter o tenantId. No modo aberto de teste, ele é resiliente
 * e sempre garante um ID funcional para não quebrar a UI.
 */
export function useTenant() {
  const { user } = useUser();
  const db = useFirestore();
  const [tenantId, setTenantId] = useState<string>("default_tenant");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !db) return;

    // Tenta ler o perfil real, mas o estado inicial já é 'default_tenant'
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantId) setTenantId(data.tenantId);
      }
    }, (error) => {
      // Em caso de erro de permissão ou rede, mantemos o default_tenant
      console.log("Tenant fallback active");
    });

    return () => unsubscribe();
  }, [user, db]);

  return { tenantId, loading };
}
