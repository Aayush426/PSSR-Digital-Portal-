"""
PSSR initiator assignment model.

Assignments are separate from permanent user roles so ADMIN users can grant a
TEAM_MEMBER temporary authority for a project or shutdown scope, then revoke it
without corrupting the identity/RBAC model. The table preserves revoked records
for audit and future workflow evidence packs.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class PSSRInitiatorAssignment(Base):
    __tablename__ = "pssr_initiator_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    revoked_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    project_reference = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="ACTIVE", index=True)
    reason = Column(Text, nullable=True)

    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_id])
