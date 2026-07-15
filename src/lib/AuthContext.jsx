import React, { createContext, useState, useContext, useEffect } from 'react';
import { authClient } from '@/lib/authClient';
import { AUTH_MODE } from '@/lib/authMode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    setIsLoadingPublicSettings(false);
    
    const unsub = authClient.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const checkAppState = async () => {
    // ── Fix: Base44 is NOT configured — using Firebase Auth exclusively ──
    // This function is intentionally simplified: Base44 migration is complete,
    // and the public settings check is no longer needed.
    // All auth flows now go through Firebase.
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await authClient.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const loginViaEmailPassword = async (email, password) => {
    try {
      const loggedInUser = await authClient.loginViaEmailPassword(email, password);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAuthChecked(true);
      return loggedInUser;
    } catch (err) {
      throw err;
    }
  };

  const register = async (data) => {
    try {
      const registeredUser = await authClient.register(data);
      setUser(registeredUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAuthChecked(true);
      return registeredUser;
    } catch (err) {
      throw err;
    }
  };

  const loginWithProvider = async (provider, redirectPath) => {
    try {
      const loggedInUser = await authClient.loginWithProvider(provider, redirectPath);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setAuthChecked(true);
      return loggedInUser;
    } catch (err) {
      throw err;
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      authClient.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      authClient.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    authClient.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      authMode: AUTH_MODE,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      loginViaEmailPassword,
      register,
      loginWithProvider
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
