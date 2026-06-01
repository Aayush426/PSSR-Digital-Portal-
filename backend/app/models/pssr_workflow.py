"""Live PSSR workflow models.

These tables hold the normalized workflow aggregate created by PSSR initiators.
They intentionally sit beside the older ``pssr_tasks`` dashboard table so
existing dashboard/RBAC behavior remains compatible while new initiation,
assignment, notification, and audit flows have their own durable records.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.types import JSON

from app.database import Base


AttachmentList = MutableList.as_mutable(JSON().with_variant(JSONB, "postgresql"))


class PSSRWorkflow(Base):
    """Header and lifecycle state for one initiated PSSR workflow."""

    __tablename__ = "pssr_workflows"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    plant_unit = Column(String(120), nullable=False, index=True)
    equipment_system = Column(String(255), nullable=False)
    moc_type = Column(String(40), nullable=False, index=True)
    moc_number = Column(String(120), nullable=True, index=True)
    description = Column(Text, nullable=True)
    priority = Column(String(20), nullable=False, default="MEDIUM", index=True)
    workflow_state = Column(String(60), nullable=False, default="UNDER_PREPARATION", index=True)
    initiator_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    team_leader_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    due_date = Column(DateTime, nullable=True, index=True)
    submitted_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    started_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)
    completed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    approved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_pssr_workflows_initiator_state", "initiator_user_id", "workflow_state"),
        Index("ix_pssr_workflows_area_state", "area_owner_user_id", "workflow_state"),
        Index("ix_pssr_workflows_unit_state", "plant_unit", "workflow_state"),
    )


class PSSRTeamMemberAssignment(Base):
    """Department-scoped assignment of a PSSR to a team member."""

    __tablename__ = "pssr_team_member_assignments"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), ForeignKey("pssr_workflows.pssr_id", ondelete="CASCADE"), nullable=False, index=True)
    department = Column(String(120), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(40), nullable=False, default="ASSIGNED", index=True)
    due_date = Column(DateTime, nullable=True, index=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_id", "department", name="uq_pssr_assignment_department"),
        Index("ix_pssr_assignments_user_status_due", "user_id", "status", "due_date"),
        Index("ix_pssr_assignments_department_status", "department", "status"),
    )


class PSSRAnnexureSelection(Base):
    """Selected annexure template attached to a PSSR instance."""

    __tablename__ = "pssr_annexure_selections"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), ForeignKey("pssr_workflows.pssr_id", ondelete="CASCADE"), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="RESTRICT"), nullable=False, index=True)
    revision = Column(String(40), nullable=False)
    selected_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(40), nullable=False, default="SELECTED", index=True)
    selected_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_id", "annexure_id", name="uq_pssr_annexure_selection"),
        Index("ix_pssr_annexure_selections_pssr_status", "pssr_id", "status"),
    )


class PSSRQuestion(Base):
    """Frozen PSSR execution question, imported from annexures or entered manually."""

    __tablename__ = "pssr_questions"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), ForeignKey("pssr_workflows.pssr_id", ondelete="CASCADE"), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="RESTRICT"), nullable=True, index=True)
    annexure_question_id = Column(Integer, ForeignKey("annexure_questions.id", ondelete="RESTRICT"), nullable=True, index=True)
    question_text = Column(Text, nullable=False)
    question_description = Column(Text, nullable=True)
    question_type = Column(String(20), nullable=False, default="FIELD", index=True)
    response_type = Column(String(40), nullable=False, default="YES_NO_NA")
    department_owner = Column(String(120), nullable=False, index=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    category = Column(String(120), nullable=False, index=True)
    mandatory = Column(Boolean, nullable=False, default=True, index=True)
    custom = Column(Boolean, nullable=False, default=False, index=True)
    remarks = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default="PENDING", index=True)
    attachments = Column(AttachmentList, default=list, nullable=False)
    sequence = Column(Integer, nullable=False, default=0, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_id", "annexure_question_id", name="uq_pssr_question_source"),
        Index("ix_pssr_questions_pssr_department", "pssr_id", "department_owner"),
        Index("ix_pssr_questions_pssr_status", "pssr_id", "status"),
    )


class PSSRQuestionResponse(Base):
    """Department response to a frozen PSSR question."""

    __tablename__ = "pssr_question_responses"

    id = Column(Integer, primary_key=True, index=True)
    pssr_question_id = Column(Integer, ForeignKey("pssr_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    pssr_id = Column(String(64), ForeignKey("pssr_workflows.pssr_id", ondelete="CASCADE"), nullable=False, index=True)
    response = Column(String(20), nullable=False, default="PENDING", index=True)
    remarks = Column(Text, nullable=True)
    attachments = Column(AttachmentList, default=list, nullable=False)
    responded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    responded_by_department = Column(String(120), nullable=True, index=True)
    responded_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_question_id", name="uq_pssr_question_response"),
        Index("ix_pssr_question_responses_pssr_response", "pssr_id", "response"),
    )


class PSSRNotification(Base):
    """In-app notification record with email-ready metadata."""

    __tablename__ = "pssr_notifications"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_type = Column(String(80), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    read_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("ix_pssr_notifications_user_read_created", "recipient_user_id", "read_at", "created_at"),
    )


class PSSRAuditLog(Base):
    """Append-only audit history for PSSR workflow actions."""

    __tablename__ = "pssr_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(80), nullable=False, index=True)
    summary = Column(Text, nullable=False)
    metadata_json = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("ix_pssr_audit_pssr_created", "pssr_id", "created_at"),
    )

