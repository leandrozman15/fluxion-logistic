import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Verificar si la configuración es mínima para evitar errores de inicialización
const isConfigValid = typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.length > 0 && firebaseConfig.apiKey !== "undefined";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

if (isConfigValid) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Error al inicializar los servicios de Firebase:", error);
  }
} else {
  console.warn("Firebase: NEXT_PUBLIC_FIREBASE_API_KEY no encontrada o inválida. El sistema funcionará en modo degradado (mock).");
}

// Exportamos como opcionales para que los componentes manejen el estado 'offline' o 'unconfigured'
export { app, auth, db, storage };
