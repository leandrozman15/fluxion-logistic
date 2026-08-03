'use client';

import React, { useEffect, useMemo } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

const BACKEND_TOKEN_KEY = 'backendBearerToken';

// Intercambia el ID token de Firebase por el JWT que exige el backend (ver /api/auth/backend-session).
async function refreshBackendSession(idToken: string) {
  try {
    const response = await fetch('/api/auth/backend-session', {
      method: 'POST',
      headers: { authorization: `Bearer ${idToken}` },
    });
    const data = await response.json();
    if (response.ok && data.token) {
      sessionStorage.setItem(BACKEND_TOKEN_KEY, data.token);
    } else {
      console.error('No se pudo obtener la sesión del backend:', data.message);
      sessionStorage.removeItem(BACKEND_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Error al conectar con el backend:', e);
  }
}

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    if (!auth) return;

    // onIdTokenChanged (no onAuthStateChanged) para capturar también el refresh automático (~1h).
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await refreshBackendSession(await firebaseUser.getIdToken());
      } else {
        sessionStorage.removeItem(BACKEND_TOKEN_KEY);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      {children}
    </FirebaseProvider>
  );
};
