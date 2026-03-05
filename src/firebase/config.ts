
export const firebaseConfig = {
  apiKey: "AIzaSyBP1ejTVPBbh71XElr-CJQ7dSBYFPhnJTY",
  authDomain: "studio-5171832922-39b6b.firebaseapp.com",
  projectId: "studio-5171832922-39b6b",
  storageBucket: "studio-5171832922-39b6b.firebasestorage.app",
  messagingSenderId: "645975171719",
  appId: "1:645975171719:web:6a5c8d836ada67582f4e22",
};

export const isFirebaseConfigValid = 
  !!firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your-api-key' &&
  firebaseConfig.apiKey !== 'undefined';
