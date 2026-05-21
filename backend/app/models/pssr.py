"""PSSR dashboard support models."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text

from app.database import Base


class PSSRActivityLog(Base):
    """Recent auditable activity shown on role dashboards."""

    __tablename__ = "pssr_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    pssr_id = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False)
    detail = Column(Text, nullable=False)
    timestamp = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_pssr_activity_user_created", "user_id", "created_at"),
        Index("ix_pssr_activity_area_created", "area_owner_user_id", "created_at"),
    )


class PSSRMocReview(Base):
    """Management-of-change review item owned by an AREA_OWNER."""

    __tablename__ = "pssr_moc_reviews"

    id = Column(Integer, primary_key=True, index=True)
    moc_id = Column(String, nullable=False, unique=True, index=True)
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    due_date = Column(String, nullable=True)
    priority = Column(String, nullable=False, default="HIGH")
    status = Column(String, nullable=False, default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)
