// MOCK_firebase.mjs — MOCK explícito, NO el paquete real 'firebase'.
// Cubre únicamente 'firebase/app' y 'firebase/functions', que son los que
// alcanza la cadena real getVivi() → ViviCodeAnalyzer → githubProvider.js
// → firebase.js. No prueba que Firebase funcione de verdad.
export function initializeApp() { return { name: 'mock-app' }; }
export function getFunctions() { return { name: 'mock-functions' }; }
export function httpsCallable() { return async () => ({ data: null }); }
export function getAuth() { return { currentUser: null }; }
export function setPersistence() { return Promise.resolve(); }
export const browserLocalPersistence = 'mock-persistence';
export function getFirestore() { return { name: 'mock-firestore' }; }
export function getStorage() { return { name: 'mock-storage' }; }
