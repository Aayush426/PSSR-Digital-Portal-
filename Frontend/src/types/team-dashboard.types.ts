export interface TeamDashboardTask {
  id: string;
  pssr_title: string;
  unit: string;
  department?: string | null;
  due_date?: string | null;
  questions_answered: number;
  total_questions: number;
  progress: number;
  last_updated?: string | null;
  submitted_date?: string | null;
  reviewer_name?: string | null;
  status?: 'Under Preparation' | 'To Do' | 'In Progress' | 'Completed' | null;
  workflow_state?: string | null;
  ownership?: 'initiator' | 'team_leader' | 'assigned_member' | 'admin' | 'legacy' | null;
  can_start?: boolean;
}

export interface TeamDashboardActivity {
  id: string;
  timestamp: string;
  action: string;
  pssr_id: string;
  detail: string;
}

export interface TeamDashboardStats {
  draft_count: number;
  assigned_count: number;
  todo_count: number;
  in_progress_count: number;
  completed_count: number;
  pending_review_count: number;
}

export interface InitiatorStats {
  active_capabilities: number;
  under_preparation?: number;
  draft_pssr: number;
  todo?: number;
  in_progress: number;
  completed_by_team?: number;
  pending_area_owner_approval: number;
  approved: number;
  open_punch_points: number;
  my_pssr: number;
}

export interface TeamDashboardResponse {
  draft: TeamDashboardTask[];
  assigned: TeamDashboardTask[];
  todo: TeamDashboardTask[];
  in_progress: TeamDashboardTask[];
  completed: TeamDashboardTask[];
  pending_review: TeamDashboardTask[];
  activity: TeamDashboardActivity[];
  stats: TeamDashboardStats;
  is_pssr_initiator: boolean;
  initiator_stats: InitiatorStats;
}
