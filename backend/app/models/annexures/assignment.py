"""Department and user workflow assignments for annexures."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class AnnexureAssignment(Base):
    """Assignment of an annexure or specific question to a department/member."""

    __tablename__ = "annexure_assignments"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("annexure_questions.id", ondelete="CASCADE"), nullable=True, index=True)
    assigned_department = Column(String(120), nullable=False, index=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(40), nullable=False, default="ASSIGNED", index=True)
    priority = Column(String(20), nullable=False, default="MEDIUM", index=True)
    due_date = Column(DateTime, nullable=True, index=True)
    review_status = Column(String(40), nullable=False, default="PENDING", index=True)
    remarks = Column(Text, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    annexure = relationship("Annexure", back_populates="assignments")
    question = relationship("AnnexureQuestion", back_populates="assignments")

    __table_args__ = (
        Index("ix_annexure_assignments_user_status_due", "assigned_to_user_id", "status", "due_date"),
        Index("ix_annexure_assignments_area_review", "area_owner_user_id", "review_status"),
        Index("ix_annexure_assignments_department_status", "assigned_department", "status"),
    )
