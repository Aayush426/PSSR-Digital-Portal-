/**
 * Central API service layer for FastAPI communication.
 *
 * UI components never call fetch directly. This layer owns the API prefix,
 * bearer-token attachment, response-envelope parsing, and unauthorized-session
 * handling so future refinery modules can share one integration contract.
 */

import { tokenStore } from '../utils/token';
import type {
  PssrAnnexure,
  PssrAnnexureAddPayload,
  PssrCreatePayload,
  PssrDetails,
  PssrMemberAssignmentPayload,
  PssrMemberSnapshot,
  PssrMocType,
  PssrSaveDraftPayload,
  PssrSubmitPayload,
  PssrUpdateDraftPayload,
  PssrWorkflowState,
} from '../types/app.types';

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

export interface DepartmentUser extends AdminUser {
  operational_unit?: string | null;
  assigned_pssr_count: number;
  pending_tasks_count?: number;
  annexure_responsibilities: DepartmentAnnexure[];
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

export interface DepartmentUsersResponse {
  records: DepartmentUser[];
  pagination: UserPagination;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  role?: Role;
  active?: boolean;
  initiator?: boolean;
  plant_area?: string;
}

export interface PSSRRecordOption {
  id: number;
  pssr_id: string;
  pssr_title: string;
  unit: string;
  department: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  due_date?: string | null;
}

export interface InitiatorCapability {
  user_id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department?: string | null;
  designation?: string | null;
  plant_location?: string | null;
  is_active: boolean;
  permission: 'INITIATE_PSSR';
  granted_at?: string | null;
  granted_by_full_name?: string | null;
  revoked_at?: string | null;
  statistics: Record<string, number>;
}

export interface InitiatorCapabilitiesResponse {
  records: InitiatorCapability[];
  pagination: UserPagination;
}

export interface PSSRRecordsResponse {
  records: PSSRRecordOption[];
  pagination: UserPagination;
}

export interface DepartmentAnnexure {
  id: number;
  mapping_id?: number | null;
  code: string;
  title: string;
  requirement_type: 'MANDATORY' | 'OPTIONAL' | string;
  visibility_scope: string;
  checklist_owner_role: string;
  workflow_stage: string;
  priority: number;
  active: boolean;
}

export interface OperationalUnit {
  id: number;
  code: string;
  name: string;
  zone: string;
  visibility: string;
  workflow_scope: string;
  area_owner_user_id?: number | null;
  active: boolean;
}

export interface DepartmentWorkflowResponsibility {
  id: number;
  stage: string;
  responsibility: string;
  owner_role: string;
  escalation_owner_role: string;
  due_days: number;
  punch_point_owner: string;
  approval_required: boolean;
  active: boolean;
}

export interface DepartmentPermissionConfig {
  id: number;
  capability: string;
  role: Role | string;
  allowed: boolean;
  scope: string;
  active: boolean;
}

export interface DepartmentAreaOwner {
  id: number;
  area_owner_user_id: number;
  area_owner_name: string;
  unit_id?: number | null;
  unit_name?: string | null;
  approval_scope: string;
  escalation_user_id?: number | null;
  escalation_owner_name?: string | null;
  active: boolean;
}

export interface DepartmentActivity {
  id: number;
  action: string;
  summary: string;
  actor_name?: string | null;
  created_at: string;
}

export interface DepartmentWorkflowImpact {
  active_pssr_count: number;
  pending_approvals: number;
  punch_point_count: number;
  completed_pssr_count: number;
  completion_rate: number;
  assigned_checklist_total: number;
  department_workload: number;
  recent_workflow_activity: DepartmentActivity[];
}

export interface RefineryDepartment {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  personnel_count: number;
  initiator_count: number;
  area_owner_count: number;
  workflow_impact: DepartmentWorkflowImpact;
  annexures: DepartmentAnnexure[];
  operational_units: OperationalUnit[];
  workflow_responsibilities: DepartmentWorkflowResponsibility[];
  permission_configs: DepartmentPermissionConfig[];
  area_owners: DepartmentAreaOwner[];
  activity_history: DepartmentActivity[];
  created_at: string;
  updated_at: string;
}

export interface DepartmentsResponse {
  records: RefineryDepartment[];
  pagination: UserPagination;
}

export interface UpdateUserPayload {
  employee_id?: string;
  full_name?: string;
  email?: string;
  role?: Role;
  department?: string;
  designation?: string;
  plant_location?: string;
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
    if (typeof params.initiator === 'boolean') query.set('initiator', String(params.initiator));
    if (params.plant_area) query.set('plant_area', params.plant_area);

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

  /** =========================
   * Phase 4/5 PSSR endpoints
   * ========================= */

  /** TEAM_MEMBER / AREA_OWNER: create a new PSSR draft. */
  createPssr(payload: PssrCreatePayload): Promise<PssrDetails> {
    return request<PssrDetails>(`/pssr/create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: fetch PSSR details. */
  getPssr(id: number): Promise<PssrDetails> {
    return request<PssrDetails>(`/pssr/${id}`);
  },

  /** TEAM_MEMBER / AREA_OWNER: update PSSR draft (draft-only fields). */
  updatePssrDraft(id: number, payload: PssrUpdateDraftPayload): Promise<PssrDetails> {
    return request<PssrDetails>(`/pssr/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: save as draft (separate endpoint for UX). */
  savePssrDraft(id: number, payload: PssrSaveDraftPayload): Promise<PssrDetails> {
    return request<PssrDetails>(`/pssr/${id}/save-draft`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: submit to team (workflow state transition). */
  submitPssr(id: number, payload: PssrSubmitPayload = {}): Promise<PssrDetails> {
    return request<PssrDetails>(`/pssr/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: list current user's PSSRs. */
  listMyPssrs(params: {
    page: number;
    limit: number;
    workflow_state?: PssrWorkflowState;
    status?: PssrWorkflowState;
  }): Promise<{ records: PssrDetails[]; pagination?: unknown }> {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('limit', String(params.limit));
    if (params.workflow_state) query.set('workflow_state', params.workflow_state);
    if (params.status) query.set('status', params.status);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<any>(`/pssr${suffix}`);
  },

  /** TEAM_MEMBER / AREA_OWNER: add member to a PSSR. */
  addPssrMember(pssrId: number, payload: PssrMemberAssignmentPayload): Promise<PssrMemberSnapshot> {
    return request<PssrMemberSnapshot>(`/pssr/${pssrId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: remove member from a PSSR (editable post-submission rules handled by backend). */
  removePssrMember(pssrId: number, memberAssignmentId: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/pssr/${pssrId}/members/${memberAssignmentId}`, {
      method: 'DELETE',
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: add annexure to a PSSR. */
  addPssrAnnexure(
    pssrId: number,
    payload: PssrAnnexureAddPayload
  ): Promise<PssrAnnexure> {
    return request<PssrAnnexure>(`/pssr/${pssrId}/annexures`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** TEAM_MEMBER / AREA_OWNER: remove annexure from a PSSR. */
  removePssrAnnexure(
    pssrId: number,
    pssrAnnexureId: number
  ): Promise<{ id: number }> {
    return request<{ id: number }>(`/pssr/${pssrId}/annexures/${pssrAnnexureId}`, {
      method: 'DELETE',
    });
  },

  listPSSRRecords(params: { page?: number; limit?: number; search?: string; department?: string } = {}): Promise<PSSRRecordsResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 50));
    if (params.search) query.set('search', params.search);
    if (params.department) query.set('department', params.department);
    return apiRequest<PSSRRecordsResponse>(`/pssr/records?${query.toString()}`);
  },

  listInitiators(params: { page?: number; limit?: number; active?: boolean; department?: string; search?: string } = {}): Promise<InitiatorCapabilitiesResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 25));
    if (typeof params.active === 'boolean') query.set('active', String(params.active));
    if (params.department) query.set('department', params.department);
    if (params.search) query.set('search', params.search);
    return apiRequest<InitiatorCapabilitiesResponse>(`/pssr/initiators?${query.toString()}`);
  },

  enableInitiator(userId: number, reason?: string): Promise<InitiatorCapability> {
    return apiRequest<InitiatorCapability>(`/pssr/initiators/${userId}/enable`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  disableInitiator(userId: number, reason?: string): Promise<InitiatorCapability> {
    return apiRequest<InitiatorCapability>(`/pssr/initiators/${userId}/disable`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  listDepartments(params: { page?: number; limit?: number; search?: string; active?: boolean } = {}): Promise<DepartmentsResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 50));
    if (params.search) query.set('search', params.search);
    if (typeof params.active === 'boolean') query.set('active', String(params.active));
    return apiRequest<DepartmentsResponse>(`/admin/departments?${query.toString()}`);
  },

  createDepartment(payload: { code: string; name: string; description?: string; unit_ids?: number[] }): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>('/admin/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDepartment(id: number, payload: { code?: string; name?: string; description?: string; active?: boolean; unit_ids?: number[] }): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteDepartment(id: number): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}`, {
      method: 'DELETE',
    });
  },

  configureDepartmentAnnexure(id: number, payload: {
    annexure_id: number;
    requirement_type: string;
    visibility_scope: string;
    checklist_owner_role: string;
    workflow_stage: string;
    priority: number;
    active?: boolean;
  }): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}/annexures`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeDepartmentAnnexure(id: number, mappingId: number): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}/annexures/${mappingId}`, {
      method: 'DELETE',
    });
  },

  configureDepartmentUnit(id: number, payload: {
    unit_id: number;
    visibility: string;
    workflow_scope: string;
    area_owner_user_id?: number | null;
    active?: boolean;
  }): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}/units`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  configureDepartmentWorkflowResponsibility(id: number, payload: Omit<DepartmentWorkflowResponsibility, 'id'>, responsibilityId?: number): Promise<RefineryDepartment> {
    const suffix = responsibilityId ? `?responsibility_id=${responsibilityId}` : '';
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}/workflow-responsibilities${suffix}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  configureDepartmentPermission(id: number, payload: Omit<DepartmentPermissionConfig, 'id'>): Promise<RefineryDepartment> {
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  configureDepartmentAreaOwner(id: number, payload: {
    area_owner_user_id: number;
    unit_id?: number | null;
    approval_scope: string;
    escalation_user_id?: number | null;
    active?: boolean;
  }, mappingId?: number): Promise<RefineryDepartment> {
    const suffix = mappingId ? `?mapping_id=${mappingId}` : '';
    return apiRequest<RefineryDepartment>(`/admin/departments/${id}/area-owners${suffix}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  listDepartmentUsers(departmentId: number, params: { page?: number; limit?: number; search?: string; role?: Role; active?: boolean; initiator?: boolean; plant_area?: string } = {}): Promise<DepartmentUsersResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 25));
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (typeof params.active === 'boolean') query.set('active', String(params.active));
    if (typeof params.initiator === 'boolean') query.set('initiator', String(params.initiator));
    if (params.plant_area) query.set('plant_area', params.plant_area);
    return apiRequest<DepartmentUsersResponse>(`/admin/departments/${departmentId}/users?${query.toString()}`);
  },

  updateUser(userId: number, payload: UpdateUserPayload): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  setUserStatus(userId: number, active: boolean, reason?: string): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active, reason }),
    });
  },

  deleteUser(userId: number): Promise<{ user_id: number; active: boolean }> {
    return apiRequest<{ user_id: number; active: boolean }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  resetUserPermissions(userId: number, reason?: string): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin/users/${userId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },
};
