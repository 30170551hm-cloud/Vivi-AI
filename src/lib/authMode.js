import firebaseConfigJson from '../../firebase-applet-config.json';

function readEnv(key) {
  try {
    const value = import.meta.env?.[key];
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return null;
    return trimmed;
  } catch {
    return null;
  }
}

const FIREBASE_API_KEY = readEnv('VITE_FIREBASE_API_KEY') || firebaseConfigJson?.apiKey;
const FIREBASE_AUTH_DOMAIN = readEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfigJson?.authDomain;
const FIREBASE_PROJECT_ID = readEnv('VITE_FIREBASE_PROJECT_ID') || firebaseConfigJson?.projectId;

const firebaseFullyConfigured = !!(FIREBASE_API_KEY && FIREBASE_AUTH_DOMAIN && FIREBASE_PROJECT_ID);
const allowLocalAuth = import.meta.env?.DEV || readEnv('VITE_ALLOW_LOCAL_AUTH') === 'true';

if (!firebaseFullyConfigured) {
  const message =
    '[authMode] Firebase no está completamente configurado.\n' +
    `  VITE_FIREBASE_API_KEY: ${FIREBASE_API_KEY ? 'OK' : 'FALTA'}\n` +
    `  VITE_FIREBASE_AUTH_DOMAIN: ${FIREBASE_AUTH_DOMAIN ? 'OK' : 'FALTA'}\n` +
    `  VITE_FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID ? 'OK' : 'FALTA'}`;

  if (allowLocalAuth) {
    console.warn(`${message}\n  Modo local permitido solo para desarrollo controlado.`);
  } else {
    console.error(`${message}\n  Modo local deshabilitado en producción; completa Firebase.`);
  }
}

export const AUTH_MODE = firebaseFullyConfigured ? 'firebase' : (allowLocalAuth ? 'local' : 'firebase');

export const isFirebaseConfigured = () => firebaseFullyConfigured;

export function getAuthModeLabel() {
  return AUTH_MODE === 'firebase'
    ? 'Firebase Authentication'
    : 'Local temporal (solo desarrollo controlado)';
}
