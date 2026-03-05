
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

/**
 * Hook para obter o tenantId do usuário atual de forma robusta.
 */
export function useTenant() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !db) {
      setTenantId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Use onSnapshot to react to profile creation during bootstrap
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setTenantId(docSnap.data().tenantId);
      } else {
        setTenantId(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tenant:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, authLoading]);

  return { tenantId, loading };
}
