'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
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
    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      
      // Modern way to enable persistent cache in Firestore
      // Allows the driver app to open and work without internet
      firestoreInstance = initializeFirestore(appInstance, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      
      authInstance = getAuth(appInstance);
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
