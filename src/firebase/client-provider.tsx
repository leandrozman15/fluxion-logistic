'use client';

import React, { useEffect, useMemo } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { refreshBackendSession, clearBackendSession } from '@/lib/backend-api';

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    if (!auth) return;

    // onIdTokenChanged (no onAuthStateChanged) para capturar también el refresh automático (~1h).
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await refreshBackendSession(await firebaseUser.getIdToken());
      } else {
        clearBackendSession();
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
