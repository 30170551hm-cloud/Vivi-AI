import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration - uses env variables or demo mode
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-auth-domain',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'demo-sender',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app'
};

let app, auth, db, storage;
let firebaseInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Set persistence
  setPersistence(auth, browserLocalPersistence).catch(error => {
    console.warn('Firebase persistence not available:', error);
  });
  
  firebaseInitialized = true;
} catch (error) {
  console.warn('Firebase initialization failed, falling back to local storage:', error);
  firebaseInitialized = false;
}

export { auth, db, storage, app, firebaseInitialized };
export default app;
