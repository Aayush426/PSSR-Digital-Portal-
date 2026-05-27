"""
Pydantic request and response schemas for auth, users, and assignments.

Schemas form the contract between FastAPI and the React client. They are kept
separate from SQLAlchemy models so database choices do not leak into API shape.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.user import Department, UserRole


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
    initiator_enabled: bool = False
    capabilities: list[str] = Field(default_factory=list)
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

    employee_id: Optional[str] = Field(None, min_length=2, max_length=100)
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[str] = Field(None, min_length=3, max_length=255)
    role: Optional[UserRole] = None
    department: Optional[str] = Field(None, max_length=100)
    designation: Optional[str] = Field(None, max_length=100)
    plant_location: Optional[str] = Field(None, max_length=100)
    active: Optional[bool] = None


class UserStatusUpdateRequest(BaseModel):
    """Admin payload for explicitly enabling or disabling a user."""

    active: bool
    reason: Optional[str] = Field(None, max_length=1000)


class UserPermissionResetRequest(BaseModel):
    """Admin payload for revoking all active capability grants."""

    reason: Optional[str] = Field(None, max_length=1000)
