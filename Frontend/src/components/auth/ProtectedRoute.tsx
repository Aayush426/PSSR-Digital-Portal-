/**
 * Frontend route guard.
 *
 * This wrapper protects user experience by preventing users from navigating to
 * dashboards that do not match their authenticated role. The backend still
 * enforces RBAC on every API route.
 */

import React from 'react';
import type { Role } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { user, hasRole } = useAuth();

  if (!user) return null;

  if (!hasRole(allowedRoles)) {
    window.history.replaceState({}, '', user.dashboard_path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return null;
  }

  return <>{children}</>;
};
