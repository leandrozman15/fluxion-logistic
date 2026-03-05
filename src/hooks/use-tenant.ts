
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * Hook para obtener el tenantId del usuario actual.
 * En un sistema multi-tenant real, esto vendría de un custom claim en el token de Auth
 * o de una colección de mapeo usuarios -> tenants.
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
        // Opción 1: Buscar en una colección global de 'users' que apunte al tenant
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setTenantId(userSnap.data().tenantId);
        } else {
          // Opción 2: Buscar en todos los sub-colecciones 'users' dentro de 'tenants' (más costoso)
          // Esto es una simplificación para el MVP.
          // Lo ideal es que el tenantId esté en el token del usuario.
          console.warn("User profile not found in root /users collection.");
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
