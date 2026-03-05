
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Hook para obter o tenantId do usuário atual de forma robusta.
 */
export function useTenant() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function findTenant() {
      if (!user || !db) {
        setTenantId(null);
        setLoading(false);
        return;
      }

      try {
        // Busca o documento do usuário na raiz para pegar seu tenantId
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setTenantId(userSnap.data().tenantId);
        } else {
          // Se não existe, tentamos o sub-path comum de convites (backup)
          // Mas normalmente o login deve garantir o documento na raiz
          console.warn(`User profile ${user.uid} not found in root /users collection.`);
        }
      } catch (error) {
        console.error("Error finding tenant:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      findTenant();
    }
  }, [user, db, authLoading]);

  return { tenantId, loading: authLoading || loading };
}
