"""Pydantic contracts for the annexure workflow API."""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


ResponseValue = Literal["PASS", "FAIL", "NA", "PENDING"]
QuestionType = Literal[
    "PASS_FAIL",
    "YES_NO",
    "YES_NO_NA",
    "TEXT",
    "NUMBER",
    "DATE",
    "CHECKBOX",
    "MULTISELECT",
    "FILE_UPLOAD",
    "CUSTOM",
]
CheckpointType = Literal["DOCUMENT", "FIELD"]


class AnnexureQuestionOut(BaseModel):
    id: int
    question_text: str
    question_type: CheckpointType = "FIELD"
    response_type: QuestionType = "PASS_FAIL"
    checked_by_department: str
    department_owner: Optional[str] = None
    category: str
    expected_evidence: Optional[str] = None
    help_text: Optional[str] = None
    guidance_notes: Optional[str] = None
    evidence_required: bool = False
    regulatory_reference: Optional[str] = None
    required: bool
    sequence: int
    sort_order: int
    latest_response: Optional[dict[str, Any]] = None


class AnnexureQuestionTemplateIn(BaseModel):
    id: Optional[int] = None
    question_text: str = Field(..., min_length=3, max_length=4000)
    question_type: CheckpointType = "FIELD"
    response_type: QuestionType = "PASS_FAIL"
    department_owner: Optional[str] = Field(None, max_length=120)
    category: str = Field("Document Control", max_length=120)
    expected_evidence: Optional[str] = Field(None, max_length=255)
    required: bool = True
    sequence: int = Field(0, ge=0)
    help_text: Optional[str] = Field(None, max_length=2000)
    guidance_notes: Optional[str] = Field(None, max_length=4000)
    evidence_required: bool = False
    remarks_allowed: bool = True
    attachment_allowed: bool = False
    punch_point_enabled: bool = True
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    regulatory_reference: Optional[str] = Field(None, max_length=255)


class AnnexureSectionTemplateIn(BaseModel):
    id: Optional[int] = None
    title: str = Field(..., min_length=2, max_length=255)
    section_type: str = Field("CUSTOM", max_length=40)
    description: Optional[str] = Field(None, max_length=4000)
    responsible_department: Optional[str] = Field(None, max_length=120)
    sort_order: int = Field(0, ge=0)
    questions: list[AnnexureQuestionTemplateIn] = []


class AnnexureCreateIn(BaseModel):
    number: int = Field(..., ge=1)
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=4000)
    revision: str = Field("1.0", max_length=40)
    active: bool = True
    department_visibility: list[str] = []
    sections: list[AnnexureSectionTemplateIn] = []


class AnnexureUpdateIn(BaseModel):
    number: Optional[int] = Field(None, ge=1)
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=4000)
    revision: Optional[str] = Field(None, max_length=40)
    active: Optional[bool] = None
    department_visibility: Optional[list[str]] = None
    sections: Optional[list[AnnexureSectionTemplateIn]] = None
    change_summary: Optional[str] = Field(None, max_length=1000)


class AnnexureSectionOut(BaseModel):
    id: int
    title: str
    section_type: str
    description: Optional[str] = None
    responsible_department: Optional[str] = None
    sort_order: int
    questions: list[AnnexureQuestionOut] = []


class AnnexureSummaryOut(BaseModel):
    id: int
    number: int
    code: str
    title: str
    description: Optional[str] = None
    active: bool
    sections_count: int = 0
    questions_count: int = 0
    departments: list[str] = []
    revision: str = "1.0"
    status: str = "ACTIVE"
    is_archived: bool = False
    archived_at: Optional[datetime] = None
    archived_by: Optional[int] = None
    modified_by: Optional[int] = None
    modified_at: datetime
    latest_revision: str = "1.0"
    uploaded_template: Optional[dict[str, Any]] = None
    updated_at: datetime


class AnnexureDetailOut(AnnexureSummaryOut):
    sections: list[AnnexureSectionOut] = []
    templates: list[dict[str, Any]] = []
    revisions: list[dict[str, Any]] = []


class AnnexureResponseIn(BaseModel):
    pssr_id: str = Field(..., max_length=64)
    annexure_id: int
    question_id: int
    response: ResponseValue
    remarks: Optional[str] = Field(None, max_length=4000)
    attachments: list[dict[str, Any]] = []


class AnnexureResponseOut(BaseModel):
    id: int
    pssr_id: str
    annexure_id: int
    question_id: int
    response: str
    remarks: Optional[str] = None
    attachments: list[dict[str, Any]] = []
    checked_by_user_id: Optional[int] = None
    checked_by_department: Optional[str] = None
    checked_at: Optional[datetime] = None
    modified_at: datetime


class AnnexureAssignmentIn(BaseModel):
    pssr_id: str = Field(..., max_length=64)
    annexure_id: int
    question_id: Optional[int] = None
    assigned_department: str = Field(..., max_length=120)
    assigned_to_user_id: Optional[int] = None
    area_owner_user_id: Optional[int] = None
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    due_date: Optional[datetime] = None
    remarks: Optional[str] = None


class AnnexureAssignmentOut(BaseModel):
    id: int
    pssr_id: str
    annexure_id: int
    question_id: Optional[int] = None
    assigned_department: str
    assigned_to_user_id: Optional[int] = None
    area_owner_user_id: Optional[int] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    review_status: str
    remarks: Optional[str] = None
    assigned_at: datetime


class PendingReviewOut(BaseModel):
    assignment_id: int
    pssr_id: str
    annexure_id: int
    annexure_title: str
    assigned_department: str
    assigned_to_user_id: Optional[int] = None
    priority: str
    due_date: Optional[datetime] = None
    review_status: str
    progress: int
    failed_count: int


class TemplateUploadOut(BaseModel):
    id: int
    annexure_id: int
    version: str
    file_name: str
    file_type: str
    storage_path: str
    uploaded_at: datetime


class AnnexureOverviewOut(BaseModel):
    total_annexures: int
    active_annexures: int
    archived_annexures: int
    total_sections: int
    total_questions: int
    latest_revision: str
    templates_uploaded: int
    department_visibility_count: int
    recent_activity: list[dict[str, Any]] = []
    recently_modified: list[dict[str, Any]] = []
    recently_uploaded_templates: list[dict[str, Any]] = []
    revision_history_preview: list[dict[str, Any]] = []


class PunchPointOut(BaseModel):
    id: int
    pssr_id: str
    annexure_id: int
    question_id: Optional[int] = None
    title: str
    category: str
    severity: str
    status: str
    owning_department: str
    due_date: Optional[datetime] = None
    raised_at: datetime
