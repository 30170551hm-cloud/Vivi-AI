// authClient.js — Punto único de autenticación para toda la UI.
// Login.jsx, Register.jsx, ForgotPassword.jsx, ResetPassword.jsx y
// AuthContext.jsx importan `authClient` de aquí — NUNCA `base44` directo
// para operaciones de auth. Esto es lo que corrige el bug reportado:
// antes, cada página llamaba a `base44.auth.*` sin verificar si Base44
// estaba configurado, generando llamadas con app_id=null.
//
// Las operaciones de datos (memoria, conversaciones, entidades) SIGUEN
// pasando por `base44` directamente sin cambios — este archivo solo cubre
// autenticación, que es el alcance de esta corrección.

import { base44 } from '@/api/base44Client';
import { AUTH_MODE } from './authMode';

// Import perezoso: los adaptadores de Firebase/local solo se cargan si
// realmente se van a usar, para que el modo 'base44' (el actual, en
// producción) no toque Firebase para nada.
let _adapterPromise = null;
async function getAdapter() {
  if (_adapterPromise) return _adapterPromise;

  if (AUTH_MODE === 'firebase') {
    _adapterPromise = import('./firebaseAuthAdapter').then((m) => m.firebaseAuthAdapter);
  } else if (AUTH_MODE === 'local') {
    _adapterPromise = import('./localAuthAdapter').then((m) => m.localAuthAdapter);
  } else {
    _adapterPromise = Promise.resolve(base44.auth);
  }
  return _adapterPromise;
}

/**
 * authClient — misma forma que base44.auth, pero resuelta dinámicamente
 * según el modo real detectado. Cada método espera a que el adaptador
 * correcto esté listo antes de delegar.
 */
export const authClient = {
  async me() { return (await getAdapter()).me(); },
  async updateMe(patch) { return (await getAdapter()).updateMe(patch); },
  async loginViaEmailPassword(email, password) {
    return (await getAdapter()).loginViaEmailPassword(email, password);
  },
  async register(data) {
    const adapter = await getAdapter();
    if (typeof adapter.register === 'function') return adapter.register(data);
    throw new Error('El adaptador de autenticación actual no soporta registro directo.');
  },
  async verifyOtp(data) {
    const adapter = await getAdapter();
    if (typeof adapter.verifyOtp === 'function') return adapter.verifyOtp(data);
    throw new Error('Verificación por código no aplica en este modo de autenticación.');
  },
  async resendOtp(email) {
    const adapter = await getAdapter();
    if (typeof adapter.resendOtp === 'function') return adapter.resendOtp(email);
    throw new Error('Reenvío de código no aplica en este modo de autenticación.');
  },
  async setToken(token) {
    const adapter = await getAdapter();
    if (typeof adapter.setToken === 'function') return adapter.setToken(token);
    // No-op seguro en modos donde no existe el concepto de token manual.
  },
  async loginWithProvider(provider, redirectPath) {
    return (await getAdapter()).loginWithProvider(provider, redirectPath);
  },
  async resetPasswordRequest(email) {
    return (await getAdapter()).resetPasswordRequest(email);
  },
  async resetPassword(data) {
    return (await getAdapter()).resetPassword(data);
  },
  async logout(redirectUrl) {
    const adapter = await getAdapter();
    return adapter.logout(redirectUrl);
  },
  async redirectToLogin(returnUrl) {
    const adapter = await getAdapter();
    return adapter.redirectToLogin(returnUrl);
  },
};
