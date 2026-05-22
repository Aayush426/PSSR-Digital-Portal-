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

export interface DepartmentTeamMembers {
  department: string;
  count: number;
  teamMembers: AdminUser[];
}

export interface PssrInitiatorAssignment {
  id: number;
  user_id: number;
  user_employee_id: string;
  user_full_name: string;
  project_reference?: string | null;
  status: string;
  reason?: string | null;
  assigned_at: string;
  revoked_at?: string | null;
}

export interface AssignInitiatorRequest {
  user_id: number;
  project_reference?: string | null;
  reason?: string | null;
}

export interface RevokeInitiatorRequest {
  assignment_id: number;
  reason?: string | null;
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

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  /**
   * Attach Authorization centrally so protected routes cannot accidentally make
   * unauthenticated calls. Backend dependencies remain the real security gate.
   */
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

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

export interface DepartmentListResponse {
  departments: string[];
}

export interface TeamMemberDirectoryRow {
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

export const api = {
  /** Authenticate against FastAPI and receive a JWT plus routed user profile. */
  login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>(
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
    return request<AuthUser>('/auth/me');
  },

  /** Notify the backend of logout intent, then the client clears local state. */
  logout(): Promise<null> {
    return request<null>('/auth/logout', { method: 'POST' });
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
    return request<PaginatedUsersResponse>(`/admin/users${suffix}`);
  },

  /** Admin dashboard: grouped departments -> team members (team role). */
  getDepartmentsTeamMembers(includeInactive = true): Promise<DepartmentTeamMembers[]> {
    const query = new URLSearchParams();
    query.set('include_inactive', String(includeInactive));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<DepartmentTeamMembers[]>(
      `/admin/dashboard/departments-team-members${suffix}`
    );
  },

  /** Admin: update user role/department/active status. */
  updateUser(userId: number, payload: Partial<{
    full_name: string;
    role: Role;
    department: string;
    designation: string | null;
    plant_location: string | null;
    active: boolean;
  }>): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /** Admin: list PSSR initiator assignments (paginated envelope). */
  listPssrInitiatorAssignments(params?: {
    status?: 'ACTIVE' | 'REVOKED';
    status_filter?: 'ACTIVE' | 'REVOKED';
    user_id?: number;
    project_reference?: string;
    page?: number;
    per_page?: number;
  }): Promise<any> {
    const query = new URLSearchParams();
    // backend accepts both ?status (aliased) and ?status_filter for compatibility
    if (params?.status) query.set('status', params.status);
    if (params?.status_filter) query.set('status_filter', params.status_filter);
    if (params?.user_id !== undefined) query.set('user_id', String(params.user_id));
    if (params?.project_reference) query.set('project_reference', params.project_reference);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.per_page !== undefined) query.set('per_page', String(params.per_page));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<any>(`/admin/pssr/assignments${suffix}`);
  },

  /** Admin: assign a TEAM_MEMBER as a temporary PSSR initiator. */
  assignPssrInitiator(payload: AssignInitiatorRequest): Promise<PssrInitiatorAssignment> {
    return request<PssrInitiatorAssignment>('/admin/pssr/assign-initiator', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Admin: revoke an active PSSR initiator assignment. */
  revokePssrInitiator(payload: RevokeInitiatorRequest): Promise<PssrInitiatorAssignment> {
    return request<PssrInitiatorAssignment>('/admin/pssr/revoke-initiator', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Admin: hard delete a PSSR initiator assignment row (keeps User). */
  hardDeletePssrInitiatorAssignment(assignmentId: number): Promise<{ assignment_id: number }> {
    return request<{ assignment_id: number }>(`/admin/pssr/hard-delete-assignment/${assignmentId}`, {
      method: 'DELETE',
    });
  },


  /** Admin: fixed department catalog (portal spec). */
  getFixedDepartments(): Promise<string[]> {
    return request<string[]>(`/admin/departments`);
  },

  /** Admin: team members for a specific department. */
  listTeamMembersByDepartment(params: { department: string; includeInactive?: boolean }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    query.set('department', params.department);
    query.set('include_inactive', String(params.includeInactive ?? false));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<AdminUser[]>(`/admin/team-members${suffix}`);
  },

  /** Admin: assign (or re-activate) TEAM_MEMBER role to a department. */
  assignTeamMemberToDepartment(payload: { user_id: number; department: string; active?: boolean }): Promise<AdminUser> {
    return request<AdminUser>(`/admin/team-members/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Admin: deactivate all TEAM_MEMBERs in a department (bulk soft remove). */
  deactivateDepartmentTeamMembers(
    department: string
  ): Promise<{ department: string; affected_team_members: number }> {
    return request<{ department: string; affected_team_members: number }>(
      `/admin/departments/${encodeURIComponent(department)}`
    );
  },
};
