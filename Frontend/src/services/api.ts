/**
 * Central API service layer for FastAPI communication.
 *
 * UI components never call fetch directly. This layer owns the API prefix,
 * bearer-token attachment, response-envelope parsing, and unauthorized-session
 * handling so future refinery modules can share one integration contract.
 */

import { tokenStore } from '../utils/token';

export type Role = 'ADMIN' | 'TEAM_MEMBER' | 'AREA_OWNER';
export type Capability = 'INITIATE_PSSR' | string;

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
  initiator_enabled?: boolean;
  capabilities?: Capability[];
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
  initiator_enabled?: boolean;
  capabilities?: Capability[];
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

export interface CreatePSSRPayload {
  plant_unit: string;
  equipment_system: string;
  moc_type: 'MOC' | 'NON_MOC';
  moc_number?: string | null;
  description?: string | null;
  workflow_state?: 'UNDER_PREPARATION' | 'TODO';
  team_leader_user_id?: number | null;
  area_owner_user_id?: number | null;
  annexure_ids: number[];
  selected_questions?: Array<{ annexure_id: number; question_id: number; question_type: 'DOCUMENT' | 'FIELD'; department_owner: string; assigned_user_id?: number | null }>;
  assignments: Array<{ department: string; user_id: number; due_date?: string | null }>;
  custom_questions?: Array<{ question_text: string; description: string; question_type: 'DOCUMENT' | 'FIELD'; department_owner: string; assigned_user_id?: number | null; category: string; mandatory: boolean; remarks?: string | null; attachments?: Array<Record<string, unknown>> }>;
}

export interface EditPSSRPayload {
  plant_unit: string;
  equipment_system: string;
  moc_type: 'MOC' | 'NON_MOC';
  moc_number?: string | null;
  description?: string | null;
  team_leader_user_id?: number | null;
  area_owner_user_id?: number | null;
  annexure_ids: number[];
  assignments: Array<{ department: string; user_id: number; due_date?: string | null }>;
  questions: Array<{
    id?: number | null;
    annexure_id?: number | null;
    annexure_question_id?: number | null;
    question_text: string;
    description?: string | null;
    question_type: 'DOCUMENT' | 'FIELD';
    department_owner: string;
    assigned_user_id?: number | null;
    category: string;
    mandatory: boolean;
    custom: boolean;
    remarks?: string | null;
    attachments?: Array<Record<string, unknown>>;
  }>;
}

export interface PSSRWorkflowDetail {
  pssr_id: string;
  title: string;
  plant_unit: string;
  equipment_system: string;
  moc_type: string;
  moc_number?: string | null;
  description?: string | null;
  workflow_state: string;
  initiator_user_id?: number;
  team_leader_user_id?: number | null;
  area_owner_user_id?: number | null;
  initiator?: { id: number; employee_id: string; full_name: string; email: string; department?: string | null; designation?: string | null } | null;
  team_leader?: { id: number; employee_id: string; full_name: string; email: string; department?: string | null; designation?: string | null } | null;
  area_owner?: { id: number; employee_id: string; full_name: string; email: string; department?: string | null; designation?: string | null } | null;
  started_at?: string | null;
  submitted_at?: string | null;
  started_by_user_id?: number | null;
  completed_at?: string | null;
  completed_by_user_id?: number | null;
  approved_at?: string | null;
  assignment_count: number;
  question_count: number;
  questions_answered?: number;
  mandatory_question_count?: number;
  mandatory_questions_answered?: number;
  progress?: number;
  open_punch_points: number;
  mandatory_open_punch_points?: number;
  annexure_count?: number;
  created_at?: string;
  updated_at?: string;
  assignments?: Array<{
    id: number;
    pssr_id: string;
    department: string;
    user_id: number;
    status: string;
    due_date?: string | null;
    assigned_at: string;
    started_at?: string | null;
    completed_at?: string | null;
    user?: {
      id: number;
      employee_id: string;
      full_name: string;
      email: string;
      department?: string | null;
      designation?: string | null;
    } | null;
  }>;
  questions?: Array<{
    id: number;
    pssr_id: string;
    annexure_id?: number | null;
    annexure_question_id?: number | null;
    question_text: string;
    question_description?: string | null;
    question_type?: 'DOCUMENT' | 'FIELD';
    response_type: string;
    department_owner: string;
    assigned_user_id?: number | null;
    assigned_user?: {
      id: number;
      employee_id: string;
      full_name: string;
      email: string;
      department?: string | null;
      designation?: string | null;
    } | null;
    category: string;
    mandatory: boolean;
    custom: boolean;
    remarks?: string | null;
    status: string;
    sequence: number;
    can_answer?: boolean;
    latest_response?: {
      id: number;
      response: string;
      remarks?: string | null;
      attachments: Array<Record<string, unknown>>;
      responded_by_user_id?: number | null;
      responded_at?: string | null;
    } | null;
  }>;
  annexures?: Array<{ id: number; code: string; title: string; revision: string; status: string; selected_at: string }>;
  punch_points?: Array<{ id: number; title: string; description?: string | null; category: string; severity: string; status: string; owning_department: string; assigned_to_user_id?: number | null; assigned_to_user?: { id: number; employee_id: string; full_name: string; email: string; department?: string | null; designation?: string | null } | null; question_id?: number | null; workflow_reference?: string; due_date?: string | null; remarks?: string | null; created_at: string; updated_at?: string | null }>;
  audit_timeline?: Array<{ id: number; action: string; summary: string; actor_user_id?: number | null; actor?: { id: number; employee_id: string; full_name: string; email: string; department?: string | null; designation?: string | null } | null; department?: string | null; metadata: Record<string, unknown>; created_at: string }>;
  permissions?: {
    is_admin: boolean;
    is_initiator: boolean;
    is_team_leader: boolean;
    is_assigned_member: boolean;
    can_submit?: boolean;
    can_edit_header: boolean;
    can_edit_punchlist?: boolean;
    can_complete_my_side?: boolean;
    can_finalize_department_work?: boolean;
    can_send_to_area_owner?: boolean;
    editable_departments: string[];
  };
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

const API_TIMEOUT_MS = 15000;

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }
  return 'http://127.0.0.1:8000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

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

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`API request timed out after ${API_TIMEOUT_MS / 1000}s: ${API_BASE_URL}${path}`);
    }
    throw new Error(`Unable to reach backend API at ${API_BASE_URL}. Check backend server, VITE_API_BASE_URL, and CORS.`);
  } finally {
    window.clearTimeout(timeoutId);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Backend returned a non-JSON response for ${path} with status ${response.status}.`);
  }
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
    if (typeof params.initiator === 'boolean') query.set('initiator', String(params.initiator));
    if (params.plant_area) query.set('plant_area', params.plant_area);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<PaginatedUsersResponse>(`/admin/users${suffix}`);
  },

  listTeamDirectory(params: { page?: number; limit?: number; search?: string; department?: string; includeAllRoles?: boolean; role?: Role } = {}): Promise<PaginatedUsersResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 50));
    if (params.search) query.set('search', params.search);
    if (params.department) query.set('department', params.department);
    if (params.includeAllRoles) query.set('include_all_roles', 'true');
    if (params.role) query.set('role', params.role);
    return apiRequest<PaginatedUsersResponse>(`/team/users/directory?${query.toString()}`);
  },

  listPSSRRecords(params: { page?: number; limit?: number; search?: string; department?: string } = {}): Promise<PSSRRecordsResponse> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 50));
    if (params.search) query.set('search', params.search);
    if (params.department) query.set('department', params.department);
    return apiRequest<PSSRRecordsResponse>(`/pssr/records?${query.toString()}`);
  },

  createPSSR(payload: CreatePSSRPayload): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>('/pssr', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getPSSR(pssrId: string): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}`);
  },

  updatePSSR(pssrId: string, payload: EditPSSRPayload): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  submitPSSR(pssrId: string): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}/submit`, {
      method: 'POST',
    });
  },

  respondToPSSRQuestion(pssrId: string, questionId: number, payload: { response: 'YES' | 'NO' | 'NA' | 'PENDING'; remarks?: string | null; attachments?: Array<Record<string, unknown>> }): Promise<NonNullable<PSSRWorkflowDetail['questions']>[number]> {
    return apiRequest<NonNullable<PSSRWorkflowDetail['questions']>[number]>(`/pssr/${encodeURIComponent(pssrId)}/questions/${questionId}/respond`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  transitionPSSR(pssrId: string, targetState: 'PENDING_AREA_OWNER_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CLOSED', remarks?: string | null, areaOwnerUserId?: number | null): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ target_state: targetState, remarks: remarks ?? null, area_owner_user_id: areaOwnerUserId ?? null }),
    });
  },

  completeMyPSSRSide(pssrId: string): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}/complete-my-side`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
  },

  finalizeDepartmentWork(pssrId: string, department?: string | null): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}/finalize-department-work`, {
      method: 'POST',
      body: JSON.stringify({ department: department ?? null, confirm: true }),
    });
  },

  reopenDepartmentWork(pssrId: string, departments: string[]): Promise<PSSRWorkflowDetail> {
    return apiRequest<PSSRWorkflowDetail>(`/pssr/${encodeURIComponent(pssrId)}/reopen-department-work`, {
      method: 'POST',
      body: JSON.stringify({ departments, confirm: true }),
    });
  },

  createPSSRPunchPoint(pssrId: string, payload: { title: string; description: string; category: 'A' | 'B' | 'C'; owning_department: string; assigned_to_user_id?: number | null; due_date?: string | null; closure_remarks?: string | null; status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'; question_id?: number | null }): Promise<NonNullable<PSSRWorkflowDetail['punch_points']>[number]> {
    return apiRequest<NonNullable<PSSRWorkflowDetail['punch_points']>[number]>(`/pssr/${encodeURIComponent(pssrId)}/punch-points`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePSSRPunchPoint(pssrId: string, punchPointId: number, payload: { title: string; description: string; category: 'A' | 'B' | 'C'; owning_department: string; assigned_to_user_id?: number | null; due_date?: string | null; closure_remarks?: string | null; status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'; question_id?: number | null }): Promise<NonNullable<PSSRWorkflowDetail['punch_points']>[number]> {
    return apiRequest<NonNullable<PSSRWorkflowDetail['punch_points']>[number]>(`/pssr/${encodeURIComponent(pssrId)}/punch-points/${punchPointId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
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
