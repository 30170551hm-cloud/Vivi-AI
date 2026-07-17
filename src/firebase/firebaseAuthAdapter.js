import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const firebaseAuthAdapter = {
  // Observador de estado de autenticación
  onAuthStateChanged: (callback) => {
    return onAuthStateChanged(auth, callback);
  },

  // Obtener perfil del usuario actual desde Firestore
  me: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado");

    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return { uid: user.uid, email: user.email, ...userDoc.data() };
    } else {
      const defaultProfile = { uid: user.uid, email: user.email, createdAt: new Date().toISOString() };
      await setDoc(userDocRef, defaultProfile, { merge: true });
      return defaultProfile;
    }
  },

  // Cerrar sesión
  logout: async () => {
    await signOut(auth);
  },

  // Redirecciones seguras
  redirectToLogin: () => {
    window.location.href = "/login";
  }
};
