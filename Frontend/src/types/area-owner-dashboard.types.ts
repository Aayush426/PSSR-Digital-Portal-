export interface AreaOwnerPendingRecord {
  id: string;
  pssr_id: string;
  submitted_by: string;
  unit: string;
  department: string;
  submitted_at?: string | null;
}

export interface AreaOwnerApprovedRecord {
  id: string;
  pssr_id: string;
  approved_by: string;
  unit?: string | null;
  approved_at?: string | null;
}

export interface AreaOwnerMocRecord {
  id: string;
  moc_id: string;
  due_date?: string | null;
}

export interface AreaOwnerDecisionLog {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
}

export interface AreaOwnerDashboardStats {
  pending_count: number;
  approved_count: number;
  moc_pending_count: number;
  approval_rate: number;
}

export interface AreaOwnerDashboardResponse {
  pending_records: AreaOwnerPendingRecord[];
  approved_records: AreaOwnerApprovedRecord[];
  moc_pending_records: AreaOwnerMocRecord[];
  decision_logs: AreaOwnerDecisionLog[];
  stats: AreaOwnerDashboardStats;
}
