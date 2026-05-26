"""PSSR capability and workflow DTOs."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UpdateInitiatorCapabilityRequest(BaseModel):
    """Payload for granting or revoking user-centric initiator capability."""

    reason: Optional[str] = Field(None, max_length=1000)


class InitiatorCapabilityResponse(BaseModel):
    """TEAM_MEMBER capability projection returned to admin and dashboards."""

    user_id: int
    employee_id: str
    full_name: str
    email: str
    department: Optional[str]
    designation: Optional[str]
    plant_location: Optional[str]
    is_active: bool
    permission: str = "INITIATE_PSSR"
    granted_at: Optional[datetime] = None
    granted_by_full_name: Optional[str] = None
    revoked_at: Optional[datetime] = None
    statistics: dict = Field(default_factory=dict)


class InitiatorStats(BaseModel):
    active_capabilities: int = 0
    draft_pssr: int = 0
    in_progress: int = 0
    pending_area_owner_approval: int = 0
    approved: int = 0
    open_punch_points: int = 0
    my_pssr: int = 0
