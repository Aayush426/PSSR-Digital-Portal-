"""User capability grants for RBAC beyond permanent roles."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class PermissionCode(str, Enum):
    CREATE_PSSR = "CREATE_PSSR"
    INITIATE_PSSR = "INITIATE_PSSR"
    VIEW_PSSR = "VIEW_PSSR"
    EDIT_ASSIGNED_CHECKLIST = "EDIT_ASSIGNED_CHECKLIST"
    CREATE_PUNCH_POINT = "CREATE_PUNCH_POINT"
    UPLOAD_EVIDENCE = "UPLOAD_EVIDENCE"
    CLOSE_CHECKLIST = "CLOSE_CHECKLIST"
    MANAGE_DEPARTMENT_USERS = "MANAGE_DEPARTMENT_USERS"
    MANAGE_ASSIGNED_DEPARTMENTS = "MANAGE_ASSIGNED_DEPARTMENTS"
    REVIEW_PSSR = "REVIEW_PSSR"
    APPROVE_PSSR = "APPROVE_PSSR"


class UserPermission(Base):
    """Auditable user-centric capability grant."""

    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    permission = Column(String(80), nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    granted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    revoked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    grant_reason = Column(Text, nullable=True)
    revoke_reason = Column(Text, nullable=True)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    granted_by = relationship("User", foreign_keys=[granted_by_user_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_user_id])

    __table_args__ = (
        Index("ix_user_permissions_user_permission_active", "user_id", "permission", "active"),
        Index("ix_user_permissions_permission_active", "permission", "active"),
    )
