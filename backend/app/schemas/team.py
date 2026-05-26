"""Pydantic schemas for TEAM_MEMBER dashboard APIs."""

from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.pssr import InitiatorStats


class TeamDashboardTask(BaseModel):
    id: str
    pssr_title: str
    unit: str
    priority: Optional[Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]] = None
    due_date: Optional[str] = None
    questions_answered: int = 0
    total_questions: int = 0
    progress: int = 0
    last_updated: Optional[str] = None
    submitted_date: Optional[str] = None
    reviewer_name: Optional[str] = None
    status: Optional[Literal["Not Started", "In Progress", "Completed", "Pending Review"]] = None


class TeamDashboardActivity(BaseModel):
    id: str
    timestamp: str
    action: str
    pssr_id: str
    detail: str


class TeamDashboardStats(BaseModel):
    todo_count: int
    in_progress_count: int
    completed_count: int
    pending_review_count: int


class TeamDashboardResponse(BaseModel):
    todo: List[TeamDashboardTask]
    in_progress: List[TeamDashboardTask]
    completed: List[TeamDashboardTask]
    activity: List[TeamDashboardActivity]
    stats: TeamDashboardStats
    is_pssr_initiator: bool = False
    initiator_stats: InitiatorStats = InitiatorStats()
