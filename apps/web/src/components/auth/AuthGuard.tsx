// ============================================================
// SIRA PLATFORM v4 - Auth Guard Component
// ============================================================
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { UserRole } from '@sira/shared';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Super admin can access everything
    if (user.role !== UserRole.SUPER_ADMIN) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
