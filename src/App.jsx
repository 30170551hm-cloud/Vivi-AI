import Vivi from '@/pages/Vivi';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
// Nota: Mantén aquí tus imports reales de las demás vistas de Vivi AI

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas Protegidas */}
          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
            {/* Aquí se montan las rutas protegidas del sistema */}
            <Route
  path="/"
  element={<Vivi />}
/>
navigate('/chat')
import Chat from '@/pages/Chat';
<Route
  path="/chat"
  element={<Chat />}
/>
          </Route>

          {/* Fallback general */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}