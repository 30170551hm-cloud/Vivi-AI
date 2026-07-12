// firebaseAuthAdapter.js — Adaptador de Firebase Auth que replica la forma
// exacta de la API `base44.auth.*` usada hoy en AuthContext.jsx, Login.jsx,
// Register.jsx, ForgotPassword.jsx, ResetPassword.jsx y ViviSecurity.js:
//   .me()                                    → usuario actual + su doc de perfil
//   .updateMe(patch)                         → actualiza el doc users/{uid}
//   .loginViaEmailPassword(email, password)
//   .loginWithProvider('google', redirectPath)
//   .logout(redirectUrl?)
//   .redirectToLogin(redirectUrl)
//
// ESTADO: escrito y verificado sintácticamente, NO probado contra un proyecto
// Firebase real. NO está conectado a AuthContext.jsx todavía — ese es
// deliberadamente el ÚLTIMO paso de la migración (Fase B, punto 6 del plan),
// porque cortar autenticación en caliente es la operación de mayor riesgo de
// las que quedan pendientes.

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import app from './firebase';

const auth = getAuth(app);
const db = getFirestore(app);

async function fetchUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

async function ensureUserProfile(firebaseUser) {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Perfil por defecto — mismos campos y valores default que base44/entities/User.jsonc
    const defaultProfile = {
      display_name: firebaseUser.displayName || '',
      preferred_language: 'auto',
      voice_enabled: true,
      is_founder: false,
      voice_name: '',
      voice_rate: 0.85,
      voice_pitch: 1.0,
      voice_volume: 1.0,
      precise_mode: true,
      email: firebaseUser.email,
      created_date: serverTimestamp(),
    };
    await setDoc(ref, defaultProfile);
    return { id: firebaseUser.uid, ...defaultProfile };
  }
  return { id: firebaseUser.uid, ...snap.data() };
}

export const firebaseAuthAdapter = {
  /** Usuario actual + su perfil de Firestore combinados (como base44 auth.me()). */
  async me() {
    const current = auth.currentUser;
    if (!current) throw new Error('No hay sesión activa');
    const profile = await fetchUserProfile(current.uid);
    return { uid: current.uid, email: current.email, ...(profile || {}) };
  },

  /** Actualiza el perfil del usuario actual en users/{uid}. */
  async updateMe(patch) {
    const current = auth.currentUser;
    if (!current) throw new Error('No hay sesión activa');
    const ref = doc(db, 'users', current.uid);
    await setDoc(ref, patch, { merge: true });
    return this.me();
  },

  /** Login con email/contraseña. */
  async loginViaEmailPassword(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return ensureUserProfile(cred.user);
  },

  /** Registro con email/contraseña (Base44 no distinguía login/registro en un solo método;
   *  aquí sí, porque Firebase Auth los separa — usar en Register.jsx). */
  async registerWithEmailPassword(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return ensureUserProfile(cred.user);
  },

  /** Alias con la firma {email, password} que usa Register.jsx (misma que Base44). */
  async register({ email, password }) {
    return this.registerWithEmailPassword(email, password);
  },

  /** Alias con la firma que usa ForgotPassword.jsx. */
  async resetPasswordRequest(email) {
    return this.sendPasswordReset(email);
  },

  /** Alias con la firma {resetToken, newPassword} que usa ResetPassword.jsx.
   *  En Firebase, resetToken ES el "oobCode" que llega en el link del email. */
  async resetPassword({ resetToken, newPassword }) {
    return this.confirmPasswordReset(resetToken, newPassword);
  },

  /** Redirige a /login (Firebase no tiene una página de login hospedada como Base44). */
  redirectToLogin(returnUrl) {
    window.location.href = `/login${returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : ''}`;
  },

  /** Login con proveedor OAuth (hoy solo 'google' está en uso). */
  async loginWithProvider(provider) {
    if (provider !== 'google') {
      throw new Error(`Proveedor no soportado: ${provider}`);
    }
    // Diagnóstico previo: si authDomain quedó en el fallback de demo,
    // el popup fallaría contra un dominio inexistente — error distinto
    // y más confuso que auth/unauthorized-domain. Se corta aquí con un
    // mensaje exacto en vez de dejar que falle de forma críptica.
    if (auth.config?.authDomain === 'demo-auth-domain') {
      throw new Error(
        'Firebase authDomain no está configurado (VITE_FIREBASE_AUTH_DOMAIN ausente). ' +
        'Configúralo en Vercel → Settings → Environment Variables con el valor de tu consola de Firebase ' +
        '(normalmente "<tu-proyecto>.firebaseapp.com") y vuelve a desplegar — en Vite, las variables de ' +
        'entorno se incrustan en tiempo de BUILD, no de ejecución, así que cambiarlas requiere redeploy.'
      );
    }
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      return ensureUserProfile(cred.user);
    } catch (err) {
      if (err?.code === 'auth/unauthorized-domain') {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '(desconocido)';
        throw new Error(
          `Firebase rechazó el login porque el dominio actual ("${currentDomain}") no está en su lista de ` +
          'dominios autorizados. Solución exacta: Firebase Console → Authentication → Settings → ' +
          `Authorized domains → "Add domain" → agrega "${currentDomain}". ` +
          'Los cambios en esa lista aplican de inmediato, sin redeploy.'
        );
      }
      throw err;
    }
  },

  /** Envía email de recuperación de contraseña (para ForgotPassword.jsx). */
  async sendPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
  },

  /** Confirma el reset de contraseña con el código recibido por email (para ResetPassword.jsx). */
  async confirmPasswordReset(code, newPassword) {
    await confirmPasswordReset(auth, code, newPassword);
  },

  /** Cierra sesión. redirectUrl es manejado por el caller (React Router), no aquí. */
  async logout() {
    await signOut(auth);
  },

  /** Suscribirse a cambios de sesión (reemplaza el polling manual de AuthContext.jsx). */
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },
};
