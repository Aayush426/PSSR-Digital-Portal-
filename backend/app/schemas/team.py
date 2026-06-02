"""Pydantic schemas for TEAM_MEMBER dashboard APIs."""

from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.pssr import InitiatorStats


class TeamDashboardTask(BaseModel):
    id: str
    pssr_title: str
    unit: str
    department: Optional[str] = None
    due_date: Optional[str] = None
    questions_answered: int = 0
    total_questions: int = 0
    progress: int = 0
    last_updated: Optional[str] = None
    submitted_date: Optional[str] = None
    reviewer_name: Optional[str] = None
    area_owner: Optional[dict] = None
    status: Optional[Literal["Under Preparation", "To Do", "In Progress", "Completed"]] = None
    workflow_state: Optional[str] = None
    ownership: Optional[Literal["initiator", "team_leader", "assigned_member", "admin", "legacy"]] = None
    can_start: bool = False


class TeamDashboardActivity(BaseModel):
    id: str
    timestamp: str
    action: str
    pssr_id: str
    detail: str


class TeamDashboardStats(BaseModel):
    draft_count: int = 0
    assigned_count: int = 0
    todo_count: int
    in_progress_count: int
    completed_count: int
    pending_review_count: int


class TeamDashboardResponse(BaseModel):
    draft: List[TeamDashboardTask] = []
    assigned: List[TeamDashboardTask] = []
    todo: List[TeamDashboardTask]
    in_progress: List[TeamDashboardTask]
    completed: List[TeamDashboardTask]
    pending_review: List[TeamDashboardTask] = []
    approved: List[TeamDashboardTask] = []
    activity: List[TeamDashboardActivity]
    stats: TeamDashboardStats
    is_pssr_initiator: bool = False
    initiator_stats: InitiatorStats = InitiatorStats()
