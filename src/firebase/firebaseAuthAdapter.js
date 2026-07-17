// src/firebase/firebaseAuthAdapter.js
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const firebaseAuthAdapter = {
  auth,
  db,
  async login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },
  async register(email, password, additionalData = {}) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      createdAt: new Date().toISOString(),
      ...additionalData
    }, { merge: true });
    return user;
  },
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        createdAt: new Date().toISOString()
      });
    }
    return user;
  },
  async logout() {
    return await signOut(auth);
  },
  subscribeToAuthChanges(callback) {
    return onAuthStateChanged(auth, callback);
  }
};
