"""Annexure master records for the refinery PSSR checklist engine."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Annexure(Base):
    """Global refinery annexure master template definition."""

    __tablename__ = "annexures"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False, unique=True, index=True)
    code = Column(String(32), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    revision = Column(String(40), nullable=False, default="1.0", index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    sections = relationship(
        "AnnexureSection",
        back_populates="annexure",
        cascade="all, delete-orphan",
        order_by="AnnexureSection.sort_order",
    )
    templates = relationship("AnnexureTemplate", back_populates="annexure", cascade="all, delete-orphan")
    assignments = relationship("AnnexureAssignment", back_populates="annexure", cascade="all, delete-orphan")
    departments = relationship("AnnexureDepartment", back_populates="annexure", cascade="all, delete-orphan")
    audit_logs = relationship("AnnexureAuditLog", back_populates="annexure", cascade="all, delete-orphan")
    revisions = relationship("AnnexureRevision", back_populates="annexure", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_annexures_active_sort", "active", "is_deleted", "sort_order"),
        Index("ix_annexures_title_active", "title", "active", "is_deleted"),
    )


class AnnexureDepartment(Base):
    """Flexible department visibility for global annexure templates."""

    __tablename__ = "annexure_departments"

    id = Column(Integer, primary_key=True, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id = Column(String(120), nullable=False, index=True)
    responsibility = Column(String(80), nullable=False, default="VISIBLE")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    annexure = relationship("Annexure", back_populates="departments")

    __table_args__ = (
        Index("ix_annexure_departments_annexure_department", "annexure_id", "department_id", unique=True),
    )


class AnnexureAuditLog(Base):
    """Append-only administrative audit trail for annexure master changes."""

    __tablename__ = "annexure_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(80), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    summary = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    annexure = relationship("Annexure", back_populates="audit_logs")


class AnnexureRevision(Base):
    """Version history for annexure metadata and checklist structure."""

    __tablename__ = "annexure_revisions"

    id = Column(Integer, primary_key=True, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id", ondelete="CASCADE"), nullable=False, index=True)
    revision = Column(String(40), nullable=False)
    change_summary = Column(Text, nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    annexure = relationship("Annexure", back_populates="revisions")

    __table_args__ = (
        Index("ix_annexure_revisions_annexure_revision", "annexure_id", "revision"),
    )
