"""API schemas for refinery department structure."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DepartmentCreateRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=40)
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    unit_ids: list[int] | None = None


class DepartmentUpdateRequest(BaseModel):
    code: Optional[str] = Field(None, min_length=2, max_length=40)
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    active: Optional[bool] = None
    unit_ids: list[int] | None = None


class DepartmentAnnexureMappingRequest(BaseModel):
    annexure_id: int
    requirement_type: str = Field("MANDATORY", max_length=40)
    visibility_scope: str = Field("DEPARTMENT", max_length=80)
    checklist_owner_role: str = Field("TEAM_MEMBER", max_length=80)
    workflow_stage: str = Field("IN_PROGRESS", max_length=80)
    priority: int = Field(100, ge=1, le=999)
    active: bool = True


class DepartmentUnitMappingRequest(BaseModel):
    unit_id: int
    visibility: str = Field("VISIBLE", max_length=40)
    workflow_scope: str = Field("STANDARD_PSSR", max_length=80)
    area_owner_user_id: Optional[int] = None
    active: bool = True


class DepartmentWorkflowResponsibilityRequest(BaseModel):
    stage: str = Field(..., min_length=2, max_length=80)
    responsibility: str = Field(..., min_length=2, max_length=255)
    owner_role: str = Field("TEAM_MEMBER", max_length=80)
    escalation_owner_role: str = Field("AREA_OWNER", max_length=80)
    due_days: int = Field(3, ge=0, le=365)
    punch_point_owner: str = Field("DEPARTMENT", max_length=80)
    approval_required: bool = False
    active: bool = True


class DepartmentPermissionConfigRequest(BaseModel):
    capability: str = Field(..., min_length=2, max_length=80)
    role: str = Field(..., min_length=2, max_length=80)
    allowed: bool = True
    scope: str = Field("DEPARTMENT", max_length=80)
    active: bool = True


class DepartmentAreaOwnerMappingRequest(BaseModel):
    area_owner_user_id: int
    unit_id: Optional[int] = None
    approval_scope: str = Field("UNIT", max_length=80)
    escalation_user_id: Optional[int] = None
    active: bool = True


class OperationalUnitResponse(BaseModel):
    id: int
    code: str
    name: str
    zone: str
    visibility: str = "VISIBLE"
    workflow_scope: str = "STANDARD_PSSR"
    area_owner_user_id: Optional[int] = None
    active: bool = True


class DepartmentAnnexureResponse(BaseModel):
    id: int
    mapping_id: Optional[int] = None
    code: str
    title: str
    requirement_type: str = "MANDATORY"
    visibility_scope: str = "DEPARTMENT"
    checklist_owner_role: str = "TEAM_MEMBER"
    workflow_stage: str = "IN_PROGRESS"
    priority: int = 100
    active: bool = True


class DepartmentWorkflowResponsibilityResponse(BaseModel):
    id: int
    stage: str
    responsibility: str
    owner_role: str
    escalation_owner_role: str
    due_days: int
    punch_point_owner: str
    approval_required: bool
    active: bool


class DepartmentPermissionConfigResponse(BaseModel):
    id: int
    capability: str
    role: str
    allowed: bool
    scope: str
    active: bool


class DepartmentAreaOwnerResponse(BaseModel):
    id: int
    area_owner_user_id: int
    area_owner_name: str
    unit_id: Optional[int]
    unit_name: Optional[str]
    approval_scope: str
    escalation_user_id: Optional[int]
    escalation_owner_name: Optional[str]
    active: bool


class DepartmentActivityResponse(BaseModel):
    id: int
    action: str
    summary: str
    actor_name: Optional[str]
    created_at: datetime


class DepartmentWorkflowImpactResponse(BaseModel):
    active_pssr_count: int
    pending_approvals: int
    punch_point_count: int
    completed_pssr_count: int
    completion_rate: int
    assigned_checklist_total: int
    department_workload: int
    recent_workflow_activity: list[DepartmentActivityResponse]


class DepartmentResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    active: bool
    personnel_count: int
    initiator_count: int
    area_owner_count: int
    workflow_impact: DepartmentWorkflowImpactResponse
    annexures: list[DepartmentAnnexureResponse]
    operational_units: list[OperationalUnitResponse]
    workflow_responsibilities: list[DepartmentWorkflowResponsibilityResponse]
    permission_configs: list[DepartmentPermissionConfigResponse]
    area_owners: list[DepartmentAreaOwnerResponse]
    activity_history: list[DepartmentActivityResponse]
    created_at: datetime
    updated_at: datetime
