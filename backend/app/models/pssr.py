"""
PSSR workflow models.

Supports:
- MOC and Non-MOC PSSR creation
- Team member assignment
- Annexure (checklist) selection with soft delete
- Workflow state tracking
- Audit/history logging
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class PSSRStatus(str, Enum):
    """PSSR workflow states (synchronized with frontend)."""

    DRAFT = "DRAFT"
    LOCKED = "LOCKED"
    TEAM_REVIEW = "TEAM_REVIEW"
    AREA_OWNER_REVIEW = "AREA_OWNER_REVIEW"
    APPROVAL = "APPROVAL"
    FINAL_REVIEW = "FINAL_REVIEW"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class PSSR(Base):
    """
    Process Safety System Review (PSSR) document.

    Tracks MOC-linked and standalone PSSSRs with multi-stage workflow.
    Immutable after submission except for drafts.
    """

    __tablename__ = "pssr"

    id = Column(Integer, primary_key=True, index=True)

    # Identifiers
    pssr_number = Column(String, unique=True, nullable=False, index=True)
    moc_number = Column(String, nullable=True, index=True)

    # Type and structure
    is_moc = Column(Boolean, default=False, nullable=False, index=True)
    moc_description = Column(String, nullable=True)

    # Location / scope
    area = Column(String, nullable=False, index=True)
    sub_area = Column(String, nullable=True)

    # Documentation
    description = Column(Text, nullable=True)

    # Workflow
    status = Column(
        String, default=PSSRStatus.DRAFT.value, nullable=False, index=True
    )

    # Audit trail
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    members = relationship("PSSRMember", back_populates="pssr", cascade="all, delete-orphan")
    annexures = relationship("PSSRAnnoture", back_populates="pssr", cascade="all, delete-orphan")
    history = relationship("PSSRHistory", back_populates="pssr", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_pssr_created_by_status", "created_by_id", "status"),
        Index("idx_pssr_moc_number", "moc_number"),
        Index("idx_pssr_area", "area"),
    )


class PSSRMember(Base):
    """
    Team member assigned to a PSSR for execution.

    Auto-populated on selection; editable only by PSSR Initiator or Area Owner
    after submission.
    """

    __tablename__ = "pssr_members"

    id = Column(Integer, primary_key=True, index=True)

    pssr_id = Column(Integer, ForeignKey("pssr.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Snapshot of user info at assignment time
    department = Column(String, nullable=False)
    designation = Column(String, nullable=False)

    # Status
    status = Column(String, default="ASSIGNED", nullable=False)  # ASSIGNED, IN_PROGRESS, COMPLETED

    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    pssr = relationship("PSSR", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])
    added_by = relationship("User", foreign_keys=[added_by_id])

    __table_args__ = (Index("idx_pssr_members_pssr_user", "pssr_id", "user_id"),)


class PSSRAnnoture(Base):
    """
    Annexure (checklist template) assigned to a PSSR.

    Supports soft delete to preserve historical data and allow re-addition with
    previous state intact.
    """

    __tablename__ = "pssr_annexures"

    id = Column(Integer, primary_key=True, index=True)

    pssr_id = Column(Integer, ForeignKey("pssr.id"), nullable=False, index=True)

    # Reference to annexure catalog
    annexure_code = Column(String, nullable=False, index=True)
    annexure_name = Column(String, nullable=False)
    annexure_category = Column(String, nullable=True)

    # Soft delete
    is_soft_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    pssr = relationship("PSSR", back_populates="annexures")
    added_by = relationship("User", foreign_keys=[added_by_id])
    deleted_by = relationship("User", foreign_keys=[deleted_by_id])

    __table_args__ = (
        Index("idx_pssr_annexures_pssr_code", "pssr_id", "annexure_code"),
        Index("idx_pssr_annexures_soft_delete", "pssr_id", "is_soft_deleted"),
    )


class PSSRHistory(Base):
    """
    Audit log for PSSR lifecycle events.

    Immutable record of all state changes, member/annexure modifications,
    and approvals.
    """

    __tablename__ = "pssr_history"

    id = Column(Integer, primary_key=True, index=True)

    pssr_id = Column(Integer, ForeignKey("pssr.id"), nullable=False, index=True)

    # Event details
    action = Column(String, nullable=False)  # created, draft_saved, submitted, member_added, etc.
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)

    # Context
    details = Column(Text, nullable=True)  # JSON or freeform event data

    # Actor
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    performed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    pssr = relationship("PSSR", back_populates="history")
    performed_by = relationship("User", foreign_keys=[performed_by_id])

    __table_args__ = (
        Index("idx_pssr_history_pssr_action", "pssr_id", "action"),
        Index("idx_pssr_history_performed_at", "performed_at"),
    )
