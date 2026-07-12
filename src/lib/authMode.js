// authMode.js — Decide qué backend de autenticación usar, EN ORDEN:
//   1. Base44, si VITE_BASE44_APP_ID está configurado.
//   2. Firebase, si VITE_FIREBASE_API_KEY está configurado.
//   3. Local (localStorage) — sistema temporal para poder abrir y usar la
//      app sin ningún backend configurado, tal como se pidió.
//
// Esto es lo que impide el bug reportado: antes, el código intentaba usar
// Base44 SIEMPRE, sin verificar si `app_id` existía, generando llamadas con
// app_id=null y 404s. Ahora se detecta ANTES de intentar nada.

function readEnv(key) {
  try {
    const value = import.meta.env?.[key];
    if (!value) return null;
    const trimmed = String(value).trim();
    // Trata valores placeholder comunes ("null", "undefined", vacío) como
    // NO configurado — de lo contrario, un .env con VITE_BASE44_APP_ID=null
    // escrito literalmente pasaría como "configurado" porque el string
    // "null" es truthy en JavaScript.
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

const BASE44_APP_ID = readEnv('VITE_BASE44_APP_ID');
const FIREBASE_API_KEY = readEnv('VITE_FIREBASE_API_KEY');
const FIREBASE_AUTH_DOMAIN = readEnv('VITE_FIREBASE_AUTH_DOMAIN');
const FIREBASE_PROJECT_ID = readEnv('VITE_FIREBASE_PROJECT_ID');

// El modo Firebase requiere las 3 variables mínimas para autenticación
// (apiKey, authDomain, projectId). Antes bastaba con la API key, lo que
// permitía un estado a medio configurar donde authDomain caía al fallback
// falso 'demo-auth-domain' de firebase.js — produciendo errores de OAuth
// confusos (popup contra un dominio inexistente) difíciles de distinguir
// del error real auth/unauthorized-domain.
const firebaseFullyConfigured = !!(FIREBASE_API_KEY && FIREBASE_AUTH_DOMAIN && FIREBASE_PROJECT_ID);

if (FIREBASE_API_KEY && !firebaseFullyConfigured) {
  console.error(
    '[authMode] Firebase está PARCIALMENTE configurado — se ignora y se usa modo local.\n' +
    `  VITE_FIREBASE_API_KEY: ${FIREBASE_API_KEY ? 'OK' : 'FALTA'}\n` +
    `  VITE_FIREBASE_AUTH_DOMAIN: ${FIREBASE_AUTH_DOMAIN ? 'OK' : 'FALTA'}\n` +
    `  VITE_FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID ? 'OK' : 'FALTA'}\n` +
    '  Configura las 3 variables (en .env local o en Vercel → Settings → Environment Variables) y vuelve a desplegar.'
  );
}

export const AUTH_MODE = BASE44_APP_ID
  ? 'base44'
  : firebaseFullyConfigured
    ? 'firebase'
    : 'local';

export const isBase44Configured = () => !!BASE44_APP_ID;
export const isFirebaseConfigured = () => firebaseFullyConfigured;

/** Mensaje visible para diagnósticos (founder panel, consola) — nunca oculta el modo real. */
export function getAuthModeLabel() {
  switch (AUTH_MODE) {
    case 'base44': return 'Base44 (configurado)';
    case 'firebase': return 'Firebase Authentication (fallback)';
    default: return 'Local temporal (sin backend configurado — solo para desarrollo)';
  }
}
