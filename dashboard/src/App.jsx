import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PromotionsPage from './pages/PromotionsPage';

function ProtectedRoute({ children }) {
  const { owner, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center px-6">
        <div className="panel p-8 flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2cc7b8] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted mono">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (!owner) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { owner } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={owner ? <Navigate to="/" replace /> : <LoginPage />} 
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/promotions"
        element={
          <ProtectedRoute>
            <PromotionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
