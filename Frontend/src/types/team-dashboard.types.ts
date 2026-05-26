export interface TeamDashboardTask {
  id: string;
  pssr_title: string;
  unit: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  due_date?: string | null;
  questions_answered: number;
  total_questions: number;
  progress: number;
  last_updated?: string | null;
  submitted_date?: string | null;
  reviewer_name?: string | null;
  status?: 'Not Started' | 'In Progress' | 'Completed' | 'Pending Review' | null;
}

export interface TeamDashboardActivity {
  id: string;
  timestamp: string;
  action: string;
  pssr_id: string;
  detail: string;
}

export interface TeamDashboardStats {
  todo_count: number;
  in_progress_count: number;
  completed_count: number;
  pending_review_count: number;
}

export interface InitiatorStats {
  active_capabilities: number;
  draft_pssr: number;
  in_progress: number;
  pending_area_owner_approval: number;
  approved: number;
  open_punch_points: number;
  my_pssr: number;
}

export interface TeamDashboardResponse {
  todo: TeamDashboardTask[];
  in_progress: TeamDashboardTask[];
  completed: TeamDashboardTask[];
  activity: TeamDashboardActivity[];
  stats: TeamDashboardStats;
  is_pssr_initiator: boolean;
  initiator_stats: InitiatorStats;
}
