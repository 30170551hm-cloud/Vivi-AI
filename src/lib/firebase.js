import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Firebase configuration - uses env variables or config JSON fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || 'demo-auth-domain',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || 'demo-bucket',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || 'demo-sender',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || 'demo-app'
};

const firestoreDatabaseId = firebaseConfigJson.firestoreDatabaseId || undefined;

let app, auth, db, storage;
let firebaseInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, firestoreDatabaseId);
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
