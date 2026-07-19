import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";

const USERS_COLLECTION = "users";

export const firebaseAuthAdapter = {

  auth,
  db,

  async login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  },

  async loginViaEmailPassword(email, password) {
    return this.login(email, password);
  },

  async register(email, password, additionalData = {}) {

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = result.user;

    await setDoc(
      doc(db, USERS_COLLECTION, user.uid),
      {
        uid: user.uid,
        email: user.email,
        createdAt: new Date().toISOString(),
        ...additionalData
      },
      {
        merge: true
      }
    );

    return user;
  },

  async loginWithGoogle() {

    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);

    const user = result.user;

    const ref = doc(db, USERS_COLLECTION, user.uid);

    const snap = await getDoc(ref);

    if (!snap.exists()) {

      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        createdAt: new Date().toISOString()
      });

    }

    return user;

  },

  async loginWithProvider(provider) {

    if (provider === "google") {
      return this.loginWithGoogle();
    }

    throw new Error(`Proveedor no soportado: ${provider}`);

  },

  async me() {

    const current = auth.currentUser;

    if (!current) {
      return null;
    }

    const ref = doc(db, USERS_COLLECTION, current.uid);

    const snap = await getDoc(ref);

    if (!snap.exists()) {

      return {
        uid: current.uid,
        email: current.email
      };

    }

    return snap.data();

  },

  async updateMe(patch = {}) {

    const current = auth.currentUser;

    if (!current) {
      throw new Error('No hay usuario autenticado');
    }

    const ref = doc(db, USERS_COLLECTION, current.uid);

    // Allow any preference fields to be persisted; always include identity fields.
    const allowedFields = [
      'display_name', 'preferred_language', 'voice_enabled', 'voice_name',
      'voice_rate', 'voice_pitch', 'voice_volume', 'precise_mode',
    ];
    const updatePayload = { uid: current.uid, email: current.email, updatedAt: new Date().toISOString() };
    for (const key of Object.keys(patch)) {
      if (allowedFields.includes(key)) {
        updatePayload[key] = patch[key];
      }
    }

    await setDoc(ref, updatePayload, { merge: true });

    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('No se pudo actualizar el perfil del usuario');
    }
    return snap.data();

  },

  async logout() {
    return signOut(auth);
  },

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  subscribeToAuthChanges(callback) {
    return onAuthStateChanged(auth, callback);
  },

  redirectToLogin() {
    window.location.href = "/login";
  }

};
