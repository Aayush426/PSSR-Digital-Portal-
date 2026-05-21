"""Question bank for dynamic annexure rendering."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class AnnexureQuestion(Base):
    """Reusable checklist question template owned by a refinery discipline."""

    __tablename__ = "annexure_questions"

    id = Column(Integer, primary_key=True, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("annexure_sections.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    response_type = Column(String(40), nullable=False, default="PASS_FAIL", index=True)
    checked_by_department = Column(String(120), nullable=False, index=True)
    department_owner = Column(String(120), nullable=True, index=True)
    category = Column(String(120), nullable=False, index=True)
    expected_evidence = Column(String(255), nullable=True)
    help_text = Column(Text, nullable=True)
    guidance_notes = Column(Text, nullable=True)
    evidence_required = Column(Boolean, nullable=False, default=False, index=True)
    regulatory_reference = Column(String(255), nullable=True)
    required = Column(Boolean, nullable=False, default=True, index=True)
    sequence = Column(Integer, nullable=False, default=0, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    section = relationship("AnnexureSection", back_populates="questions")
    responses = relationship("AnnexureResponse", back_populates="question", cascade="all, delete-orphan")
    assignments = relationship("AnnexureAssignment", back_populates="question", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("section_id", "sort_order", name="uq_annexure_question_section_sort"),
        Index("ix_annexure_questions_annexure_department", "annexure_id", "checked_by_department"),
        Index("ix_annexure_questions_active_sort", "active", "sort_order"),
    )
