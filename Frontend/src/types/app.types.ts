export type UserRole = 'Admin' | 'Team Member' | 'Area Owner';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

export type DepartmentStatus = 'Active' | 'Inactive';

export interface Department {
  id: string;
  name: string;
  code: string;
  members: number;
  annexures: string[];
  status: DepartmentStatus;
  visibility: 'Global' | 'Restricted' | 'Hidden';
}

export interface Annexure {
  id: string;
  name: string;
  version: string;
  departments: string[];
  lastUpdated: string;
  status: 'Active' | 'Inactive' | 'Draft';
}

/**
 * Admin-side placeholder record used in PSSRRecordsPage (mock data).
 * Phase 5 will replace this with real API-backed data for user dashboards.
 */
export interface PSSRRecord {
  id: string;
  unit: string;
  initiator: string;
  department: string;
  stage: string;
  status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Overdue';
  dueDate: string;
  submissionDate?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
}

/** =========================
 * Phase 4/5 PSSR frontend types
 * ========================= */

export type PssrWorkflowState =
  | 'DRAFT'
  | 'LOCKED'
  | 'TEAM_REVIEW'
  | 'AREA_OWNER_REVIEW'
  | 'APPROVAL'
  | 'FINAL_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CLOSED';

export type PssrMocType = 'MOC' | 'NON_MOC';

export interface PssrMemberSnapshot {
  id: number;
  pssr_id: number;
  user_id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  role: string;
  created_at: string;
}

export interface PssrAnnexure {
  id: number;
  pssr_id: number;
  annexure_code: string;
  annexure_name: string;
  annexure_category?: string | null;
  is_soft_deleted: boolean;
  added_at: string;
  deleted_at?: string | null;
}

export interface PssrDetails {
  id: number;
  pssr_number: string;
  is_moc: boolean;  // backend returns this, not moc_type
  status: PssrWorkflowState;  // backend returns this, not workflow_state
  moc_number?: string | null;
  area: string;
  sub_area?: string | null;
  description?: string | null;
  created_by_id: number;
  assigned_to_id?: number | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  approved_at?: string | null;

  /** Phase 5 can render these without additional round-trips */
  members?: PssrMemberSnapshot[];
  annexures?: PssrAnnexure[];
}

/** ========================
 * Request Payloads
 * ======================== */

export interface PssrCreateDetailsPayload {
  pssr_number: string;
  is_moc: boolean;
  moc_number?: string | null;
  area: string;
  sub_area?: string | null;
  description?: string | null;
}

export interface PssrCreatePayload {
  details: PssrCreateDetailsPayload;
  members: PssrMemberAssignmentPayload[];
  annexures: PssrAnnexureAddPayload[];
}

export interface PssrUpdateDraftPayload {
  details?: Partial<PssrCreateDetailsPayload>;
}

export interface PssrSaveDraftPayload {
  /** Empty payload - backend just saves current state */
}

export interface PssrSubmitPayload {
  /** Empty payload - backend handles state transition */
}

export interface PssrMemberAssignmentPayload {
  user_id: number;
  department: string;
  designation: string;
}

export interface PssrAnnexureAddPayload {
  annexure_code: string;
  annexure_name: string;
  annexure_category?: string | null;
}

/** =========================
 * Backend-aligned request payloads (/pssr/*)
 * ========================= */

export interface PssrCreateDetailsPayload {
  pssr_number: string;
  is_moc: boolean;
  moc_number?: string | null;
  moc_description?: string | null;

  area: string;
  sub_area?: string | null;
  description?: string | null;
}

export interface PssrCreatePayload {
  details: PssrCreateDetailsPayload;
  members?: Array<{
    user_id: number;
    department: string;
    designation: string;
  }>;
  annexures?: Array<{
    annexure_code: string;
    annexure_name: string;
    annexure_category?: string | null;
  }>;
}

export interface PssrUpdateDraftPayload {
  details?: Partial<PssrCreateDetailsPayload>;
  members?: Array<{
    user_id: number;
    department: string;
    designation: string;
  }>;
  annexures?: Array<{
    annexure_code: string;
    annexure_name: string;
    annexure_category?: string | null;
  }>;
}

export interface PssrSaveDraftPayload {
  // backend route currently does not require a body
  [key: string]: unknown;
}

export interface PssrSubmitPayload {
  // backend route currently does not require a body
  [key: string]: unknown;
}

export interface PssrMemberAssignmentPayload {
  user_id: number;
  department: string;
  designation: string;
}

export interface PssrAnnexureAddPayload {
  annexure_code: string;
  annexure_name: string;
  annexure_category?: string | null;
}
