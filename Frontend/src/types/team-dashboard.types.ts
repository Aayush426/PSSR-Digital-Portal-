export interface DashboardUserBrief {
  id: number;
  employee_id: string;
  full_name: string;
  email: string;
  department?: string | null;
  designation?: string | null;
}

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
  ownership?: 'initiator' | 'team_leader' | 'assigned_member' | 'admin' | 'legacy' | 'punch_point' | null;
  punch_point_id?: number | null;
  punch_point_title?: string | null;
  punch_point_description?: string | null;
  punch_checkpoint_question?: string | null;
  punch_original_answer?: string | null;
  punch_original_remarks?: string | null;
  punch_annexure_name?: string | null;
  punch_question_number?: number | null;
  priority?: string | null;
  raised_by?: DashboardUserBrief | null;
  assigned_by?: DashboardUserBrief | null;
  assigned_to?: DashboardUserBrief | null;
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
  approved: TeamDashboardTask[];
  assigned_punch_points?: TeamDashboardTask[];
  activity: TeamDashboardActivity[];
  stats: TeamDashboardStats;
  is_pssr_initiator: boolean;
  initiator_stats: InitiatorStats;
}
