import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Vivi from '@/pages/Vivi';
import Chat from '@/pages/Chat';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>

          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas protegidas */}
          <Route
            element={
              <ProtectedRoute
                unauthenticatedElement={<Navigate to="/login" replace />}
              />
            }
          >
            <Route path="/" element={<Vivi />} />
            <Route path="/chat" element={<Chat />} />
          </Route>

          {/* Ruta por defecto */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}