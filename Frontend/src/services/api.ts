/**
 * Central API service layer for FastAPI communication.
 *
 * UI components never call fetch directly. This layer owns the API prefix,
 * bearer-token attachment, response-envelope parsing, and unauthorized-session
 * handling so future refinery modules can share one integration contract.
 */

import { tokenStore } from '../utils/token';

export type Role = 'ADMIN' | 'TEAM_MEMBER' | 'AREA_OWNER';

export interface AuthUser {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  role: Role;
  department: string;
  designation?: string | null;
  plant_location?: string | null;
  dashboard_path: string;
  is_pssr_initiator: boolean;
  active?: boolean;
  last_login_at?: string | null;
}

export interface AdminUser {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  role: Role;
  department: string;
  designation?: string | null;
  plant_location?: string | null;
  active: boolean;
  dashboard_path: string;
  is_pssr_initiator: boolean;
  last_login_at?: string | null;
}

export interface UserPagination {
  page: number;
  limit: number;
  total_records: number;
  total_pages: number;
}

export interface PaginatedUsersResponse {
  records: AdminUser[];
  pagination: UserPagination;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  role?: Role;
  active?: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  error: { status_code: number; details?: unknown } | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUser;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  /**
   * Attach Authorization centrally so protected routes cannot accidentally make
   * unauthenticated calls. Backend dependencies remain the real security gate.
   */
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = tokenStore.getToken();
  if (authenticated && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success) {
    if (response.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('pssr:unauthorized'));
    }
    throw new Error(envelope.message || 'API request failed.');
  }

  return envelope.data;
}

export const api = {
  /** Authenticate against FastAPI and receive a JWT plus routed user profile. */
  login(email: string, password: string): Promise<LoginResponse> {
    return apiRequest<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    );
  },

  /** Hydrate current auth context from the backend on app startup. */
  me(): Promise<AuthUser> {
    return apiRequest<AuthUser>('/auth/me');
  },

  /** Notify the backend of logout intent, then the client clears local state. */
  logout(): Promise<null> {
    return apiRequest<null>('/auth/logout', { method: 'POST' });
  },

  /**
   * Fetch the live ADMIN user directory from FastAPI.
   *
   * The backend owns filtering and RBAC enforcement. The frontend receives
   * typed PostgreSQL-backed records and never imports mock directory data.
   */
  listUsers(params: ListUsersParams): Promise<PaginatedUsersResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.department) query.set('department', params.department);
    if (params.role) query.set('role', params.role);
    if (typeof params.active === 'boolean') query.set('active', String(params.active));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<PaginatedUsersResponse>(`/admin/users${suffix}`);
  },
};
