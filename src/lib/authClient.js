import { AUTH_MODE } from './authMode';

let _adapterPromise = null;
async function getAdapter() {
  if (_adapterPromise) return _adapterPromise;

  if (AUTH_MODE === 'local') {
    _adapterPromise = import('./localAuthAdapter').then((m) => m.localAuthAdapter);
  } else {
    _adapterPromise = import('./firebaseAuthAdapter').then((m) => m.firebaseAuthAdapter);
  }

  return _adapterPromise;
}

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
  onAuthStateChanged(callback) {
    let unsub = null;
    let cancelled = false;
    getAdapter().then((adapter) => {
      if (cancelled) return;
      if (typeof adapter.onAuthStateChanged === 'function') {
        unsub = adapter.onAuthStateChanged(callback);
      } else {
        adapter.me().then(
          (user) => { if (!cancelled) callback(user); },
          () => { if (!cancelled) callback(null); }
        );
      }
    });
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  },
};
