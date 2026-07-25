'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigValid } from './config';

// Global instances to ensure singleton behavior across the client
let appInstance: FirebaseApp | undefined;
let firestoreInstance: Firestore | undefined;
let authInstance: Auth | undefined;
let persistenceAttempted = false;

/**
 * Initializes Firebase services with a singleton pattern.
 * Ensures that persistence is enabled exactly once and before any other operations.
 */
export function initializeFirebase(): {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
} {
  // SSR Guard: Firebase client SDKs require a window object
  if (typeof window === 'undefined') {
    return { firebaseApp: null, firestore: null, auth: null };
  }

  if (!isFirebaseConfigValid) {
    return { firebaseApp: null, firestore: null, auth: null };
  }

  try {
    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      firestoreInstance = getFirestore(appInstance);
      authInstance = getAuth(appInstance);

      // Persistence must be enabled BEFORE any other Firestore methods are called.
      // We initiate it immediately after the Firestore instance is created.
      if (!persistenceAttempted) {
        persistenceAttempted = true;
        enableIndexedDbPersistence(firestoreInstance).catch((err) => {
          if (err.code === 'failed-precondition') {
            // Probably multiple tabs open at once.
            console.warn('Persistencia fallida: Múltiples pestañas abiertas.');
          } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence.
            console.warn('Persistencia fallida: Navegador no compatible.');
          }
        });
      }
    }

    return { 
      firebaseApp: appInstance, 
      firestore: firestoreInstance, 
      auth: authInstance 
    };
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    return { firebaseApp: null, firestore: null, auth: null };
  }
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
