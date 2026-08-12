
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  Auth
} from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigValid } from './config';

// Global instances to ensure singleton behavior across the client
let appInstance: FirebaseApp | undefined;
let firestoreInstance: Firestore | undefined;
let authInstance: Auth | undefined;

/**
 * Initializes Firebase services with a singleton pattern.
 * Enables persistent local cache to allow the app to work offline.
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
    // Initialize App Singleton
    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    }

    // Initialize Firestore Singleton with Persistence
    if (!firestoreInstance && appInstance) {
      // Modern way to enable persistent cache in Firestore
      // Allows the driver app to open and work without internet
      firestoreInstance = initializeFirestore(appInstance, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    }

    // Initialize Auth Singleton
    // Nota: usamos initializeAuth (no getAuth) SIN popupRedirectResolver a propósito:
    // este proyecto solo usa signInWithEmailAndPassword (sin Google/popup/redirect),
    // así que evitamos que el SDK cargue el iframe de auth de Firebase
    // (__/auth/iframe.js, ~93KB) + gapi_iframes (~34KB), que solo hacen falta para
    // flujos de popup/redirect. Ahorra ~250-500ms de bloqueo de main thread en la carga.
    if (!authInstance && appInstance) {
      try {
        authInstance = initializeAuth(appInstance, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        });
      } catch {
        // Si ya fue inicializado por otro punto de entrada (ej. HMR en dev), caer a getAuth.
        authInstance = getAuth(appInstance);
      }
    }

    return { 
      firebaseApp: appInstance || null, 
      firestore: firestoreInstance || null, 
      auth: authInstance || null 
    };
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    // Return existing instances if any error occurs during re-initialization attempt
    return { 
      firebaseApp: appInstance || null, 
      firestore: firestoreInstance || null, 
      auth: authInstance || null 
    };
  }
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
