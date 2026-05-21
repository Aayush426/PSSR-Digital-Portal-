"""Auditable checklist responses and evidence attachments."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class AnnexureResponse(Base):
    """Execution response for one question in a PSSR workflow instance."""

    __tablename__ = "annexure_responses"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("annexure_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    response = Column(String(20), nullable=False, default="PENDING", index=True)
    remarks = Column(Text, nullable=True)
    attachments = Column(JSON, nullable=False, default=list)
    checked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    checked_by_department = Column(String(120), nullable=True, index=True)
    checked_at = Column(DateTime, nullable=True, index=True)
    modified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    question = relationship("AnnexureQuestion", back_populates="responses")

    __table_args__ = (
        UniqueConstraint("pssr_id", "question_id", name="uq_annexure_response_pssr_question"),
        Index("ix_annexure_responses_pssr_annexure", "pssr_id", "annexure_id"),
        Index("ix_annexure_responses_response_checked", "response", "checked_at"),
    )
