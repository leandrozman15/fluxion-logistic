
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBP1ejTVPBbh71XElr-CJQ7dSBYFPhnJTY',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'studio-5171832922-39b6b.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-5171832922-39b6b',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-5171832922-39b6b.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '645975171719',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:645975171719:web:6a5c8d836ada67582f4e22',
};

export const isFirebaseConfigValid = 
  !!firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your-api-key' &&
  firebaseConfig.apiKey !== 'undefined';
