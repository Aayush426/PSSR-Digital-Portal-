/**
 * Central authentication context.
 *
 * This context owns login, logout, token hydration, and authenticated user
 * state. Components consume auth state from here instead of reading storage,
 * which keeps future SSO or refresh-token work localized.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type AuthUser, type Role } from '../services/api';
import { tokenStore } from '../utils/token';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  retrySession: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => tokenStore.getUser());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const hydrateSession = useCallback(async () => {
    const token = tokenStore.getToken();
    if (!token) {
      setAuthError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const profile = await api.me();
      const currentToken = tokenStore.getToken();
      if (currentToken) tokenStore.save(currentToken, profile);
      setUser(profile);
      setAuthError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to validate your session.';
      if (!tokenStore.getToken()) {
        setUser(null);
      }
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    /**
     * Validate any cached token with /auth/me on startup. This prevents stale
     * client state from granting access after backend deactivation or role
     * changes.
     */
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    /**
     * Central 401 handling. The API layer emits this event when FastAPI rejects
     * a bearer token, allowing every protected screen to return to login
     * without duplicating expiry handling in components.
     */
    const handleUnauthorized = () => {
      tokenStore.clear();
      setUser(null);
      window.history.replaceState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    };

    window.addEventListener('pssr:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pssr:unauthorized', handleUnauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authError,
      isAuthenticated: Boolean(user && tokenStore.getToken()),
      async login(email: string, password: string) {
        const response = await api.login(email, password);
        tokenStore.save(response.access_token, response.user);
        setUser(response.user);
        setAuthError(null);
        return response.user;
      },
      async logout() {
        try {
          if (tokenStore.getToken()) await api.logout();
        } finally {
          tokenStore.clear();
          setUser(null);
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      },
      hasRole(roles: Role[]) {
        return Boolean(user && roles.includes(user.role));
      },
      retrySession: hydrateSession,
    }),
    [authError, hydrateSession, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  /** Expose auth state through a typed hook with a clear integration error. */
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}
