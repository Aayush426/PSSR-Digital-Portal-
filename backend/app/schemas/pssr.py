"""
Pydantic schemas for PSSR creation, validation, and API responses.

Follows enterprise envelope pattern with type hints and field validation.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class PSSRDetailsRequest(BaseModel):
    """PSSR details for creation."""

    pssr_number: str = Field(..., max_length=50, description="Unique PSSR identifier")
    is_moc: bool = Field(False, description="True if MOC-linked PSSR")
    moc_number: Optional[str] = Field(None, max_length=50, description="MOC reference if MOC PSSR")
    moc_description: Optional[str] = Field(None, max_length=500, description="Auto-populated from MOC portal")

    area: str = Field(..., max_length=100, description="Refinery area")
    sub_area: Optional[str] = Field(None, max_length=100, description="Sub-area or unit")
    description: Optional[str] = Field(None, max_length=2000, description="PSSR scope/objectives")


class TeamMemberRequest(BaseModel):
    """Team member to add to PSSR."""

    user_id: int = Field(..., description="User ID of team member")
    department: str = Field(..., max_length=100, description="Department snapshot")
    designation: str = Field(..., max_length=100, description="Designation snapshot")


class AnnotureSelectionRequest(BaseModel):
    """Annexure (checklist) to attach to PSSR."""

    annexure_code: str = Field(..., max_length=50, description="Annexure catalog code")
    annexure_name: str = Field(..., max_length=200, description="Display name")
    annexure_category: Optional[str] = Field(None, max_length=100, description="Category/type")


class CreatePSSRRequest(BaseModel):
    """Complete PSSR creation payload."""

    details: PSSRDetailsRequest
    members: List[TeamMemberRequest] = Field(default_factory=list, description="Initial team members")
    annexures: List[AnnotureSelectionRequest] = Field(default_factory=list, description="Initial annexures")


class UpdatePSSRRequest(BaseModel):
    """Update PSSR details (draft only)."""

    details: Optional[PSSRDetailsRequest] = None
    members: Optional[List[TeamMemberRequest]] = None
    annexures: Optional[List[AnnotureSelectionRequest]] = None


class AddPSSRMemberRequest(BaseModel):
    """Add a single member to PSSR."""

    user_id: int
    department: str = Field(..., max_length=100)
    designation: str = Field(..., max_length=100)


class RemovePSSRMemberRequest(BaseModel):
    """Remove a member from PSSR."""

    member_id: int


class AddPSSRAnnotureRequest(BaseModel):
    """Add a single annexure to PSSR."""

    annexure_code: str = Field(..., max_length=50)
    annexure_name: str = Field(..., max_length=200)
    annexure_category: Optional[str] = Field(None, max_length=100)


class RemovePSSRAnnotureRequest(BaseModel):
    """Remove (soft-delete) an annexure from PSSR."""

    annexure_id: int


class PSSRMemberResponse(BaseModel):
    """Serialized PSSR member."""

    id: int
    user_id: int
    department: str
    designation: str
    status: str
    added_at: datetime

    class Config:
        from_attributes = True


class PSSRAnnotureResponse(BaseModel):
    """Serialized PSSR annexure."""

    id: int
    annexure_code: str
    annexure_name: str
    annexure_category: Optional[str]
    is_soft_deleted: bool
    added_at: datetime
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


class PSSRHistoryEventResponse(BaseModel):
    """Serialized PSSR history event."""

    id: int
    action: str
    previous_status: Optional[str]
    new_status: Optional[str]
    details: Optional[str]
    performed_by_id: int
    performed_at: datetime

    class Config:
        from_attributes = True


class PSSRResponse(BaseModel):
    """Complete PSSR serialization for API."""

    id: int
    pssr_number: str
    moc_number: Optional[str]
    is_moc: bool

    area: str
    sub_area: Optional[str]
    description: Optional[str]

    status: str
    created_by_id: int
    assigned_to_id: Optional[int]

    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]

    members: List[PSSRMemberResponse] = []
    annexures: List[PSSRAnnotureResponse] = []
    history: List[PSSRHistoryEventResponse] = []

    class Config:
        from_attributes = True


class PSSRListItemResponse(BaseModel):
    """Lightweight PSSR for list/dashboard views."""

    id: int
    pssr_number: str
    moc_number: Optional[str]
    area: str
    status: str
    created_at: datetime
    submitted_at: Optional[datetime]
    member_count: int = 0
    annexure_count: int = 0

    class Config:
        from_attributes = True


class CreatePSSRTypeRequest(BaseModel):
    """User selects MOC or Non-MOC PSSR type (first step)."""

    is_moc: bool = Field(..., description="True for MOC PSSR, False for Non-MOC")
    moc_number: Optional[str] = Field(None, description="MOC number if MOC PSSR")
