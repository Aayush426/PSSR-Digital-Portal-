"""Live PSSR execution tables separated from annexure master templates."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.types import JSON

from app.database import Base


AttachmentList = MutableList.as_mutable(JSON().with_variant(JSONB, "postgresql"))


class PSSRInstanceAnnexure(Base):
    """Annexure template attached to a specific live PSSR execution record."""

    __tablename__ = "pssr_instance_annexures"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="RESTRICT"), nullable=False, index=True)
    revision = Column(String(40), nullable=False)
    status = Column(String(40), nullable=False, default="NOT_STARTED", index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_id", "annexure_id", name="uq_pssr_instance_annexure"),
        Index("ix_pssr_instance_annexures_pssr_status", "pssr_id", "status"),
    )


class PSSRInstanceQuestion(Base):
    """Frozen question template snapshot used during one PSSR execution."""

    __tablename__ = "pssr_instance_questions"

    id = Column(Integer, primary_key=True, index=True)
    pssr_instance_annexure_id = Column(Integer, ForeignKey("pssr_instance_annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    annexure_question_id = Column(Integer, ForeignKey("annexure_questions.id", ondelete="RESTRICT"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    response_type = Column(String(40), nullable=False)
    department_owner = Column(String(120), nullable=True, index=True)
    required = Column(Boolean, nullable=False, default=True)
    sequence = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_instance_annexure_id", "annexure_question_id", name="uq_pssr_instance_question"),
        Index("ix_pssr_instance_questions_owner_sequence", "department_owner", "sequence"),
    )


class PSSRExecutionResponse(Base):
    """PASS/FAIL/PENDING and other responses captured only for live PSSR execution."""

    __tablename__ = "pssr_execution_responses"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    pssr_instance_question_id = Column(Integer, ForeignKey("pssr_instance_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    response = Column(String(40), nullable=False, default="PENDING", index=True)
    remarks = Column(Text, nullable=True)
    attachments = Column(AttachmentList, default=list, nullable=False)
    checked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    checked_by_department = Column(String(120), nullable=True, index=True)
    checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_id", "pssr_instance_question_id", name="uq_pssr_execution_response_question"),
        Index("ix_pssr_execution_responses_pssr_response", "pssr_id", "response"),
    )


class PSSRReviewState(Base):
    """Review state for area-owner and startup authorization workflows."""

    __tablename__ = "pssr_review_states"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    pssr_instance_annexure_id = Column(Integer, ForeignKey("pssr_instance_annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    review_state = Column(String(40), nullable=False, default="PENDING", index=True)
    remarks = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("pssr_id", "pssr_instance_annexure_id", "reviewer_user_id", name="uq_pssr_review_state_reviewer"),
        Index("ix_pssr_review_states_state", "review_state"),
    )
