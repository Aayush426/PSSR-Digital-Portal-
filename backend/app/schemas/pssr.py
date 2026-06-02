"""PSSR capability and workflow DTOs."""

from datetime import datetime
from typing import Any, Literal, Optional

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
    under_preparation: int = 0
    draft_pssr: int = 0
    todo: int = 0
    in_progress: int = 0
    completed_by_team: int = 0
    pending_area_owner_approval: int = 0
    approved: int = 0
    open_punch_points: int = 0
    my_pssr: int = 0


WorkflowState = Literal[
    "UNDER_PREPARATION",
    "SUBMITTED",
    "TODO",
    "IN_PROGRESS",
    "COMPLETED_BY_DEPARTMENT",
    "PENDING_AREA_OWNER_APPROVAL",
    "AREA_OWNER_PENDING",
    "AREA_OWNER_APPROVED",
    "FINAL_APPROVED",
    "CLOSED",
    "REOPENED",
    "COMPLETED",
    "COMPLETED_BY_TEAM",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
]
CheckpointType = Literal["DOCUMENT", "FIELD"]


class PSSRTeamAssignmentIn(BaseModel):
    department: str = Field(..., min_length=2, max_length=120)
    user_id: int
    due_date: Optional[datetime] = None


class PSSRCustomQuestionIn(BaseModel):
    question_text: str = Field(..., min_length=3, max_length=4000)
    description: str = Field(..., min_length=3, max_length=4000)
    question_type: CheckpointType
    department_owner: str = Field(..., min_length=2, max_length=120)
    assigned_user_id: Optional[int] = None
    category: str = Field("Custom", max_length=120)
    mandatory: bool = True
    remarks: Optional[str] = Field(None, max_length=4000)
    attachments: list[dict[str, Any]] = []


class PSSRSelectedQuestionIn(BaseModel):
    annexure_id: int
    question_id: int
    question_type: CheckpointType
    department_owner: str = Field(..., min_length=2, max_length=120)
    assigned_user_id: Optional[int] = None


class PSSRCreateRequest(BaseModel):
    plant_unit: str = Field(..., min_length=2, max_length=120)
    equipment_system: str = Field(..., min_length=2, max_length=255)
    moc_type: Literal["MOC", "NON_MOC"]
    moc_number: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=4000)
    workflow_state: Literal["UNDER_PREPARATION", "TODO"] = "UNDER_PREPARATION"
    team_leader_user_id: Optional[int] = None
    area_owner_user_id: Optional[int] = None
    due_date: Optional[datetime] = None
    annexure_ids: list[int] = []
    selected_questions: list[PSSRSelectedQuestionIn] = []
    assignments: list[PSSRTeamAssignmentIn] = []
    custom_questions: list[PSSRCustomQuestionIn] = []


class PSSREditQuestionIn(BaseModel):
    id: Optional[int] = None
    annexure_id: Optional[int] = None
    annexure_question_id: Optional[int] = None
    question_text: str = Field(..., min_length=3, max_length=4000)
    description: Optional[str] = Field(None, max_length=4000)
    question_type: CheckpointType = "FIELD"
    department_owner: str = Field(..., min_length=2, max_length=120)
    assigned_user_id: Optional[int] = None
    category: str = Field("General", max_length=120)
    mandatory: bool = True
    custom: bool = False
    remarks: Optional[str] = Field(None, max_length=4000)
    attachments: list[dict[str, Any]] = []


class PSSREditRequest(BaseModel):
    plant_unit: str = Field(..., min_length=2, max_length=120)
    equipment_system: str = Field(..., min_length=2, max_length=255)
    moc_type: Literal["MOC", "NON_MOC"]
    moc_number: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=4000)
    team_leader_user_id: Optional[int] = None
    area_owner_user_id: Optional[int] = None
    annexure_ids: list[int] = []
    assignments: list[PSSRTeamAssignmentIn] = []
    questions: list[PSSREditQuestionIn] = []


class PSSRReopenDepartmentRequest(BaseModel):
    departments: list[str] = Field(..., min_length=1)
    confirm: bool = True


class PSSRTransitionRequest(BaseModel):
    target_state: WorkflowState
    area_owner_user_id: Optional[int] = None
    remarks: Optional[str] = Field(None, max_length=1000)


class PSSRQuestionResponseRequest(BaseModel):
    response: Literal["YES", "NO", "NA", "PENDING"]
    remarks: Optional[str] = Field(None, max_length=4000)
    attachments: list[dict[str, Any]] = []


class PSSRMemberCompletionRequest(BaseModel):
    confirm: bool = True


class PSSRDepartmentFinalizationRequest(BaseModel):
    department: Optional[str] = Field(None, min_length=2, max_length=120)
    confirm: bool = True


class PSSRPunchPointRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=3, max_length=4000)
    category: Literal["A", "B", "C"] = "B"
    owning_department: str = Field(..., min_length=2, max_length=120)
    assigned_to_user_id: Optional[int] = None
    due_date: Optional[datetime] = None
    closure_remarks: Optional[str] = Field(None, max_length=4000)
    status: Literal["OPEN", "IN_PROGRESS", "CLOSED"] = "OPEN"
    question_id: Optional[int] = None


class PSSRWorkflowSummary(BaseModel):
    pssr_id: str
    title: str
    plant_unit: str
    equipment_system: str
    moc_type: str
    moc_number: Optional[str] = None
    description: Optional[str] = None
    workflow_state: str
    initiator_user_id: int
    team_leader_user_id: Optional[int] = None
    area_owner_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    annexure_count: int = 0
    assignment_count: int = 0
    question_count: int = 0
    open_punch_points: int = 0
