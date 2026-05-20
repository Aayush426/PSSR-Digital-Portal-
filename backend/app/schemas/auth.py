"""
Pydantic request and response schemas for auth, users, and assignments.

Schemas form the contract between FastAPI and the React client. They are kept
separate from SQLAlchemy models so database choices do not leak into API shape.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.user import AssignmentStatus, Department, UserRole


class LoginRequest(BaseModel):
    """Credentials submitted by the frontend login form."""

    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserProfileResponse(BaseModel):
    """Authenticated user profile returned to dashboards and route guards."""

    id: int
    employee_id: str
    full_name: str
    email: str
    role: str
    department: str
    designation: Optional[str] = None
    plant_location: Optional[str] = None
    active: bool
    dashboard_path: str
    is_pssr_initiator: bool = False
    last_login_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    """JWT login response payload."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserProfileResponse


class UserFilterParams(BaseModel):
    """Validated filters for admin user grids."""

    role: Optional[UserRole] = None
    department: Optional[Department] = None
    active: Optional[bool] = True
    search: Optional[str] = None
    page: int = 1
    per_page: int = 20


class UserUpdateRequest(BaseModel):
    """Fields an ADMIN can update without replacing the user record."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    role: Optional[UserRole] = None
    department: Optional[str] = Field(None, max_length=100)
    designation: Optional[str] = Field(None, max_length=100)
    plant_location: Optional[str] = Field(None, max_length=100)
    active: Optional[bool] = None


class AssignInitiatorRequest(BaseModel):
    """Payload for assigning a TEAM_MEMBER as a temporary PSSR initiator."""

    user_id: int
    project_reference: Optional[str] = Field(None, max_length=100)
    reason: Optional[str] = Field(None, max_length=1000)


class RevokeInitiatorRequest(BaseModel):
    """Payload for revoking an active initiator assignment."""

    assignment_id: int
    reason: Optional[str] = Field(None, max_length=1000)


class InitiatorAssignmentResponse(BaseModel):
    """Assignment projection safe for API responses."""

    id: int
    user_id: int
    user_employee_id: str
    user_full_name: str
    project_reference: Optional[str]
    status: str
    reason: Optional[str]
    assigned_at: datetime
    revoked_at: Optional[datetime]


class AssignmentFilterParams(BaseModel):
    """Validated filters for assignment listings."""

    status_filter: Optional[AssignmentStatus] = None
    user_id: Optional[int] = None
    project_reference: Optional[str] = None
    page: int = 1
    per_page: int = 20
