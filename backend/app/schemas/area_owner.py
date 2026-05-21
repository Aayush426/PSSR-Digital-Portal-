"""Pydantic schemas for AREA_OWNER dashboard APIs."""

from typing import List, Literal, Optional

from pydantic import BaseModel


class AreaOwnerPendingRecord(BaseModel):
    id: str
    pssr_id: str
    submitted_by: str
    unit: str
    department: str
    submitted_at: Optional[str] = None


class AreaOwnerApprovedRecord(BaseModel):
    id: str
    pssr_id: str
    approved_by: str
    unit: Optional[str] = None
    approved_at: Optional[str] = None


class AreaOwnerMocRecord(BaseModel):
    id: str
    moc_id: str
    due_date: Optional[str] = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"


class AreaOwnerDecisionLog(BaseModel):
    id: str
    timestamp: str
    action: str
    detail: str


class AreaOwnerDashboardStats(BaseModel):
    pending_count: int
    approved_count: int
    moc_pending_count: int
    approval_rate: int


class AreaOwnerDashboardResponse(BaseModel):
    pending_records: List[AreaOwnerPendingRecord]
    approved_records: List[AreaOwnerApprovedRecord]
    moc_pending_records: List[AreaOwnerMocRecord]
    decision_logs: List[AreaOwnerDecisionLog]
    stats: AreaOwnerDashboardStats
