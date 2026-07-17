// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { firebaseAuthAdapter } from '@/firebase/firebaseAuthAdapter';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Suscripción limpia y segura al adaptador de autenticación
    const unsubscribe = firebaseAuthAdapter.subscribeToAuthChanges(async (firebaseUser) => {
      try {
        setAuthError(null);

        if (firebaseUser) {
          // Intentar recuperar el perfil de Firestore de manera segura
          let userProfile = { 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || ''
          };

          try {
            const userRef = doc(firebaseAuthAdapter.db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              userProfile = { ...userProfile, ...userSnap.data() };
            }
          } catch (firestoreError) {
            console.warn('[AuthContext] No se pudo leer Firestore, usando credenciales básicas de Auth:', firestoreError);
          }

          setUser(userProfile);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error al sincronizar el usuario:', error);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'sync_error',
          message: error.message || 'Error al cargar el perfil de usuario'
        });
      } finally {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async (shouldRedirect = true) => {
    try {
      setUser(null);
      setIsAuthenticated(false);
      await firebaseAuthAdapter.logout();
      
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('[AuthContext] Error al cerrar sesión:', error);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: { id: 'vivi-ai', public_settings: {} },
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth: async () => {},
      checkAppState: async () => {}
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
