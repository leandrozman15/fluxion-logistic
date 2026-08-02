"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserRole } from '@/app/lib/types';

/**
 * Hook Dinámico de Organización (Tenant).
 * Identifica a qué empresa pertenece el usuario logueado y qué rol tiene.
 */
export function useTenant() {
  const { user } = useUser();
  const db = useFirestore();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      if (!user) {
        setTenantId(null);
        setRole(null);
        setLoading(false);
      }
      return;
    }

    const userEmail = user.email?.toLowerCase().trim();

    // Super Admin Global
    if (userEmail === "leozman15@gmail.com") {
      setTenantId("default_tenant");
      setRole("admin");
      setLoading(false);
      return;
    }

    // Buscamos el mapeo en /users/{email}
    const userRef = doc(db, "users", userEmail!);
    
    setLoading(true);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setTenantId(data.tenantId || "default_tenant");
        setRole(data.role as UserRole || null);
      } else {
        setTenantId(null);
        setRole(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error useTenant:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  return { 
    tenantId: tenantId || "default_tenant", 
    role, 
    loading,
    uid: user?.uid || null,
    isAuthenticated: !!user 
  };
}
