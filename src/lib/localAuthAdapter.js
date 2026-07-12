// localAuthAdapter.js — Sistema de autenticación LOCAL TEMPORAL.
//
// ⚠️ ADVERTENCIA DE SEGURIDAD — LEER ANTES DE USAR EN PRODUCCIÓN:
// Este adaptador NO usa hashing criptográfico real ni servidor — guarda
// usuarios en localStorage del navegador, en texto plano. Es intencional:
// existe únicamente para que la aplicación sea usable de punta a punta
// mientras no haya Base44 ni Firebase configurados. NUNCA debe usarse así
// en producción con datos reales de usuarios. Cuando actives Firebase
// (VITE_FIREBASE_API_KEY en .env), este adaptador deja de usarse
// automáticamente — ver src/lib/authMode.js.

const USERS_KEY = 'vivi_local_users';
const SESSION_KEY = 'vivi_local_session';

function sanitizeUsersObject(value) {
  const clean = Object.create(null);
  if (!value || typeof value !== 'object') return clean;
  for (const [key, user] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue;
    clean[key] = user;
  }
  return clean;
}

function readUsers() {
  try {
    return sanitizeUsersObject(JSON.parse(localStorage.getItem(USERS_KEY) || '{}'));
  } catch {
    return Object.create(null);
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(sanitizeUsersObject(users)));
}

function getSessionEmail() {
  return localStorage.getItem(SESSION_KEY);
}

function defaultProfile(email) {
  return {
    email,
    display_name: email.split('@')[0],
    preferred_language: 'auto',
    voice_enabled: true,
    is_founder: false,
    voice_name: '',
    voice_rate: 0.85,
    voice_pitch: 1.0,
    voice_volume: 1.0,
    precise_mode: true,
  };
}

export const localAuthAdapter = {
  async me() {
    const email = getSessionEmail();
    if (!email) throw new Error('No hay sesión activa');
    const users = readUsers();
    const user = users[email];
    if (!user) throw new Error('Usuario no encontrado');
    const { password: _password, ...profile } = user;
    void _password;
    return profile;
  },

  async updateMe(patch) {
    const email = getSessionEmail();
    if (!email) throw new Error('No hay sesión activa');
    const users = readUsers();
    if (!users[email]) throw new Error('Usuario no encontrado');
    users[email] = { ...users[email], ...patch };
    writeUsers(users);
    return this.me();
  },

  /** Login local — valida contra lo guardado en localStorage. */
  async loginViaEmailPassword(email, password) {
    const users = readUsers();
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = Object.prototype.hasOwnProperty.call(users, normalizedEmail) ? users[normalizedEmail] : null;
    if (!user || user.password !== password) {
      throw new Error('Email o contraseña inválidos');
    }
    localStorage.setItem(SESSION_KEY, user.email);
    return this.me();
  },

  /** Registro local — sin verificación por email (no hay servidor de correo). */
  async register({ email, password }) {
    const normalizedEmail = String(email).toLowerCase().trim();
    const users = readUsers();
    if (Object.prototype.hasOwnProperty.call(users, normalizedEmail)) {
      throw new Error('Ya existe una cuenta con ese email');
    }
    users[normalizedEmail] = { ...defaultProfile(normalizedEmail), password };
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, normalizedEmail);
    return { email: normalizedEmail };
  },

  /** Google OAuth no está disponible en modo local — se informa claramente, no se rompe. */
  async loginWithProvider() {
    throw new Error('Continuar con Google requiere Base44 o Firebase configurado. Usa email y contraseña mientras tanto.');
  },

  async resetPasswordRequest(email) {
    // No hay servidor de correo en modo local — se documenta la limitación
    // en vez de fingir que se envió un email real.
    console.warn(`[localAuthAdapter] Solicitud de reset para ${email} — modo local no envía emails reales.`);
  },

  async resetPassword({ newPassword }) {
    const email = getSessionEmail();
    if (!email) throw new Error('No hay sesión activa para restablecer la contraseña en modo local');
    const users = readUsers();
    if (!Object.prototype.hasOwnProperty.call(users, email)) throw new Error('Usuario no encontrado');
    users[email].password = newPassword;
    writeUsers(users);
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  redirectToLogin(returnUrl) {
    window.location.href = `/login${returnUrl ? `?from=${encodeURIComponent(returnUrl)}` : ''}`;
  },
};
