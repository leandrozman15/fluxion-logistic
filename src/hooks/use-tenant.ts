
"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserRole } from '@/app/lib/types';

/**
 * Hook Dinámico de Organización (Tenant).
 * Identifica a qué empresa pertenece el usuario logueado y qué rol tiene.
 * Normaliza el email a minúsculas para asegurar el reconocimiento de permisos.
 */
export function useTenant() {
  const { user } = useUser();
  const db = useFirestore();
  const [tenantId, setTenantId] = useState<string>("default_tenant");
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si no hay usuario, mantenemos el default (o redireccionamos)
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const userEmail = user.email?.toLowerCase().trim();

    // El Super Administrador siempre opera sobre la base maestra o default
    if (userEmail === "leozman15@gmail.com") {
      setTenantId("default_tenant");
      setRole("admin");
      setLoading(false);
      return;
    }

    // Para el resto, buscamos su mapeo en la colección global /users/{email}
    // El ID del documento debe estar siempre en minúsculas
    const userRef = doc(db, "users", userEmail!);
    
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log("Tenant Hook: User profile found", data);
        setTenantId(data.tenantId || "default_tenant");
        setRole(data.role as UserRole || null);
      } else {
        console.warn("Tenant Hook: User profile NOT found for email:", userEmail);
        // Fallback para evitar bloqueo total
        setTenantId("default_tenant");
        setRole(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener tenant del usuario:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  return { tenantId, role, loading };
}
