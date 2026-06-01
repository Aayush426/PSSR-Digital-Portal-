"""PSSR punch point tracking and closure workflow."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text

from app.database import Base


class AnnexurePunchPoint(Base):
    """Punch point raised from failed annexure checkpoints."""

    __tablename__ = "annexure_punch_points"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="SET NULL"), nullable=True, index=True)
    question_id = Column(Integer, ForeignKey("annexure_questions.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(1), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    status = Column(String(40), nullable=False, default="OPEN", index=True)
    owning_department = Column(String(120), nullable=False, index=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    raised_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    closed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    due_date = Column(DateTime, nullable=True, index=True)
    closure_remarks = Column(Text, nullable=True)
    closure_evidence = Column(Text, nullable=True)
    raised_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    closed_at = Column(DateTime, nullable=True, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_annexure_punch_pssr_status_category", "pssr_id", "status", "category"),
        Index("ix_annexure_punch_department_due", "owning_department", "due_date"),
    )
