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
      doc(db, "users", user.uid),
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

    const ref = doc(db, "users", user.uid);

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

    const ref = doc(db, "users", current.uid);

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

    const ref = doc(db, "users", current.uid);

    await setDoc(ref, {
      uid: current.uid,
      email: current.email,
      updatedAt: new Date().toISOString(),
      ...patch
    }, {
      merge: true
    });

    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {
      uid: current.uid,
      email: current.email,
      ...patch
    };

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
