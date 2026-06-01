export type AnnexureResponseValue = 'PASS' | 'FAIL' | 'NA' | 'PENDING';
export type AnnexureResponseType =
  | 'PASS_FAIL'
  | 'YES_NO'
  | 'YES_NO_NA'
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'CHECKBOX'
  | 'MULTISELECT'
  | 'FILE_UPLOAD'
  | 'CUSTOM';

export interface AnnexureResponse {
  id: number;
  pssr_id: string;
  annexure_id: number;
  question_id: number;
  response: AnnexureResponseValue;
  remarks?: string | null;
  attachments: Array<Record<string, unknown>>;
  checked_by_user_id?: number | null;
  checked_by_department?: string | null;
  checked_at?: string | null;
  modified_at: string;
}

export interface AnnexureQuestion {
  id: number;
  question_text: string;
  question_type?: 'DOCUMENT' | 'FIELD';
  response_type: AnnexureResponseType;
  checked_by_department: string;
  department_owner?: string | null;
  category: string;
  expected_evidence?: string | null;
  help_text?: string | null;
  guidance_notes?: string | null;
  evidence_required: boolean;
  remarks_allowed?: boolean;
  attachment_allowed?: boolean;
  punch_point_enabled?: boolean;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  regulatory_reference?: string | null;
  required: boolean;
  sequence: number;
  sort_order: number;
  latest_response?: AnnexureResponse | null;
}

export interface AnnexureSection {
  id: number;
  title: string;
  section_type: 'DOCUMENT' | 'FIELD' | 'CUSTOM' | string;
  description?: string | null;
  responsible_department?: string | null;
  sort_order: number;
  questions: AnnexureQuestion[];
}

export interface AnnexureSummary {
  id: number;
  number: number;
  code: string;
  title: string;
  description?: string | null;
  active: boolean;
  revision: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  is_archived: boolean;
  archived_at?: string | null;
  archived_by?: number | null;
  modified_by?: number | null;
  modified_at: string;
  latest_revision: string;
  sections_count: number;
  questions_count: number;
  departments: string[];
  uploaded_template?: {
    id: number;
    file_name: string;
    version: string;
    uploaded_at: string;
  } | null;
  progress?: number;
  pending_count?: number;
  failed_count?: number;
  updated_at: string;
}

export interface AnnexureDetail extends AnnexureSummary {
  sections: AnnexureSection[];
  templates: Array<Record<string, unknown>>;
  revisions: Array<Record<string, unknown>>;
}

export interface AnnexureListResponse {
  records: AnnexureSummary[];
  pagination: {
    page: number;
    limit: number;
    total_records: number;
    total_pages: number;
  };
}

export interface SaveAnnexureResponsePayload {
  pssr_id: string;
  annexure_id: number;
  question_id: number;
  response: AnnexureResponseValue;
  remarks?: string;
  attachments?: Array<Record<string, unknown>>;
}

export interface AnnexureOverview {
  total_annexures: number;
  active_annexures: number;
  archived_annexures: number;
  total_sections: number;
  total_questions: number;
  latest_revision: string;
  templates_uploaded: number;
  department_visibility_count: number;
  recent_activity: Array<Record<string, unknown>>;
  recently_modified: Array<Record<string, unknown>>;
  recently_uploaded_templates: Array<Record<string, unknown>>;
  revision_history_preview: Array<Record<string, unknown>>;
}

export type AnnexureQuestionTemplatePayload = {
  id?: number;
  question_text: string;
  question_type?: 'DOCUMENT' | 'FIELD';
  response_type: AnnexureResponseType;
  department_owner?: string;
  category: string;
  expected_evidence?: string;
  required: boolean;
  sequence: number;
  help_text?: string;
  guidance_notes?: string;
  evidence_required: boolean;
  remarks_allowed?: boolean;
  attachment_allowed?: boolean;
  punch_point_enabled?: boolean;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  regulatory_reference?: string;
};

export type AnnexureSectionTemplatePayload = {
  id?: number;
  title: string;
  section_type: string;
  description?: string;
  responsible_department?: string;
  sort_order: number;
  questions: AnnexureQuestionTemplatePayload[];
};

export type AnnexureMasterPayload = {
  number: number;
  title: string;
  description?: string;
  revision: string;
  active: boolean;
  department_visibility: string[];
  sections: AnnexureSectionTemplatePayload[];
  change_summary?: string;
};
