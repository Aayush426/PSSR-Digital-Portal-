"""Enterprise PSSR task model."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String

from app.database import Base


class PSSRTask(Base):
    """Assigned PSSR workflow task backed by PostgreSQL."""

    __tablename__ = "pssr_tasks"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String(64), unique=True, nullable=False, index=True)
    pssr_title = Column(String(255), nullable=False)
    unit = Column(String(120), nullable=False, index=True)
    department = Column(String(120), nullable=False, index=True)
    priority = Column(String(20), nullable=False, index=True)
    status = Column(String(40), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    due_date = Column(DateTime, nullable=True, index=True)
    questions_answered = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False, default=0)
    progress = Column(Integer, nullable=False, default=0)
    reviewer_name = Column(String(255), nullable=True)
    submitted_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_pssr_tasks_assignee_status_due", "assigned_to_user_id", "status", "due_date"),
        Index("ix_pssr_tasks_creator_status_updated", "created_by_user_id", "status", "updated_at"),
        Index("ix_pssr_tasks_area_status_updated", "area_owner_user_id", "status", "updated_at"),
        Index("ix_pssr_tasks_department_status", "department", "status"),
    )
