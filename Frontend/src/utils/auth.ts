
/**
 * =========================================================
 * AUTHENTICATION UTILITY LAYER
 * =========================================================
 *
 * Purpose:
 * Centralized authentication and session management utility
 * for the Digital PSSR Portal.
 *
 * Current Authentication Strategy:
 * - Environment-based mock admin authentication
 * - Session persistence using sessionStorage
 * - Frontend-only validation for development/demo phase
 *
 * Future Scalability:
 * This utility layer is intentionally isolated so it can
 * later integrate with:
 *
 * - MOC Portal Authentication can be easily integrated 
 * - Microsoft Outlook can be integrated 
 * - OAuth Providers
 * - JWT-based authentication
 * - Internal Refinery SSO systems
 * - Backend RBAC authorization middleware
 *
 * without changing frontend business logic.
 * =========================================================
 */

/**
 * Browser session storage key.
 */
const AUTH_SESSION_KEY = 'pssr_auth_session';

/**
 * Session expiration duration.
 *
 * Current:
 * 24 hours
 *
 * Future:
 * Controlled via backend-issued token expiry.
 */
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Defines authenticated session structure.
 */
interface AuthSession {
  email: string;
  authenticated: boolean;
  timestamp: number;
  roles: string[];
}

/**
 * Environment-based admin credentials.
 *
 * IMPORTANT:
 * VITE_ prefix is required for frontend access in Vite.
 *
 * NOTE:
 * These credentials will  only be used  for development/demo usage.
 
 */
const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL ||
  'admin@refinery.com';

const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD ||
  'password123';

/**
 * Validates admin credentials.
 *
 * CURRENT IMPLEMENTATION:
 * Frontend environment variable comparison.
 *
 * FUTURE IMPLEMENTATION:
 * Replace with backend authentication request.
 */
export const validateAdmin = (
  email: string,
  password: string
): boolean => {

  return (
    email === ADMIN_EMAIL &&
    password === ADMIN_PASSWORD
  );
};

/**
 * Creates authenticated browser session.
 *
 * CURRENT:
 * Stores lightweight session in sessionStorage.
 *
 * FUTURE:
 * Store JWT access token + refresh token.
 */
export const login = (
  email: string
): void => {

  const sessionData: AuthSession = {
    email,
    authenticated: true,
    timestamp: Date.now(),

    /**
     * Mock role assignment.
     *
     * Future:
     * Roles should come from backend RBAC service.
     */
    roles: ['ADMIN']
  };

  sessionStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify(sessionData)
  );
};

/**
 * Clears active authentication session.
 *
 * Current behavior:
 * - Removes the  session
 * - Reloads whatever was the  application state
 *
 * Future:
 * - Invalidate within backend token
 * - Revoke the  refresh token
 * - Audit  the logout event
 */
export const logout = (): void => {

  sessionStorage.removeItem(
    AUTH_SESSION_KEY
  );

  /**
   * Reload application to reset protected state.
   */
  window.location.reload();
};

/**
 * Verifies whether valid authenticated session exists.
 *
 * Includes:
 * - Session existence validation
 * - Expiration validation
 * - Safe parsing protection
 */
export const isAuthenticated = (): boolean => {

  const session =
    sessionStorage.getItem(AUTH_SESSION_KEY);

  if (!session) {
    return false;
  }

  try {

    const parsedSession: AuthSession =
      JSON.parse(session);

    const currentTime = Date.now();

    /**
     * Session expiration validation.
     */
    const sessionExpired =
      currentTime - parsedSession.timestamp >
      SESSION_EXPIRY_MS;

    if (sessionExpired) {

      logout();

      return false;
    }

    return parsedSession.authenticated === true;

  } catch (error) {

    /**
     * Corrupted session recovery.
     */
    console.error(
      'Invalid session format detected:',
      error
    );

    return false;
  }
};

/**
 * Returns authenticated session data.
 *
 * Returns:
 * - Session object if authenticated
 * - null if session missing/invalid
 */
export const getSessionUser =
  (): AuthSession | null => {

    const session =
      sessionStorage.getItem(
        AUTH_SESSION_KEY
      );

    if (!session) {
      return null;
    }

    try {

      return JSON.parse(session);

    } catch (error) {

      console.error(
        'Failed to parse session:',
        error
      );

      return null;
    }
};
