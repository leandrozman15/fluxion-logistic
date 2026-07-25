import { initializeFirebase } from "@/firebase";
import { getStorage } from "firebase/storage";

// Use the unified initialization logic to ensure persistence and singleton instances
const { firebaseApp, firestore, auth } = initializeFirebase();

// Storage helper (optional, handled separately as it doesn't affect Firestore persistence)
const storage = firebaseApp ? getStorage(firebaseApp) : undefined;

export { firebaseApp as app, auth, firestore as db, storage };
