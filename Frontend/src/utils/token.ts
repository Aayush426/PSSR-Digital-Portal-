/**
 * JWT token management utility.
 *
 * The portal stores only the bearer access token and the authenticated profile
 * snapshot needed to render guarded dashboards. The module is isolated so the
 * platform can later move to httpOnly cookies, refresh tokens, or corporate
 * SSO without rewriting dashboard components.
 */

import type { AuthUser } from '../services/api';

const TOKEN_KEY = 'pssr_access_token';
const USER_KEY = 'pssr_auth_user';

export const tokenStore = {
  /**
   * Persist the backend-issued JWT and user profile for the browser session.
   *
   * sessionStorage limits persistence to the current browser session, which is
   * safer for shared operations terminals than localStorage. Backend RBAC still
   * validates every protected request.
   */
  save(accessToken: string, user: AuthUser): void {
    sessionStorage.setItem(TOKEN_KEY, accessToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /** Return the current bearer token, if one exists. */
  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  /** Return the cached user profile used during app bootstrapping. */
  getUser(): AuthUser | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      tokenStore.clear();
      return null;
    }
  },

  /** Clear all client-side authentication state. */
  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};
