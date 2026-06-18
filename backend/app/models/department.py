"""Refinery department and operational structure models."""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class DepartmentRecord(Base):
    """Backend-owned refinery department master."""

    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(40), nullable=False, unique=True, index=True)
    name = Column(String(120), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    unit_mappings = relationship("DepartmentUnitMapping", back_populates="department")
    annexure_mappings = relationship("DepartmentAnnexureMapping", back_populates="department")
    workflow_responsibilities = relationship("DepartmentWorkflowResponsibility", back_populates="department")
    permission_configs = relationship("DepartmentPermissionConfig", back_populates="department")
    area_owner_mappings = relationship("DepartmentAreaOwnerMapping", back_populates="department")
    activity_logs = relationship("DepartmentActivityLog", back_populates="department")

    __table_args__ = (
        Index("ix_departments_active_name", "active", "name"),
    )


class RefineryUnit(Base):
    """Operational unit or zone visible during PSSR creation."""

    __tablename__ = "refinery_units"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(40), nullable=False, unique=True, index=True)
    name = Column(String(140), nullable=False, unique=True, index=True)
    zone = Column(String(120), nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department_mappings = relationship("DepartmentUnitMapping", back_populates="unit")


class DepartmentUnitMapping(Base):
    """Visibility mapping between departments and refinery units."""

    __tablename__ = "department_unit_mappings"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("refinery_units.id"), nullable=False, index=True)
    visibility = Column(String(40), nullable=False, default="VISIBLE", index=True)
    workflow_scope = Column(String(80), nullable=False, default="STANDARD_PSSR")
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("DepartmentRecord", back_populates="unit_mappings")
    unit = relationship("RefineryUnit", back_populates="department_mappings")

    __table_args__ = (
        Index("ix_department_unit_unique", "department_id", "unit_id", unique=True),
    )


class DepartmentAnnexureMapping(Base):
    """Department-owned annexure visibility and checklist ownership config."""

    __tablename__ = "department_annexure_mappings"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    annexure_id = Column(Integer, ForeignKey("annexures.id"), nullable=False, index=True)
    requirement_type = Column(String(40), nullable=False, default="MANDATORY", index=True)
    visibility_scope = Column(String(80), nullable=False, default="DEPARTMENT")
    checklist_owner_role = Column(String(80), nullable=False, default="TEAM_MEMBER")
    workflow_stage = Column(String(80), nullable=False, default="IN_PROGRESS")
    priority = Column(Integer, nullable=False, default=100, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("DepartmentRecord", back_populates="annexure_mappings")

    __table_args__ = (
        Index("ix_department_annexure_unique", "department_id", "annexure_id", unique=True),
        Index("ix_department_annexure_active_priority", "department_id", "active", "priority"),
    )


class DepartmentWorkflowResponsibility(Base):
    """Routing matrix for department workflow ownership."""

    __tablename__ = "department_workflow_responsibilities"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    stage = Column(String(80), nullable=False, index=True)
    responsibility = Column(String(255), nullable=False)
    owner_role = Column(String(80), nullable=False, default="TEAM_MEMBER", index=True)
    escalation_owner_role = Column(String(80), nullable=False, default="AREA_OWNER")
    due_days = Column(Integer, nullable=False, default=3)
    punch_point_owner = Column(String(80), nullable=False, default="DEPARTMENT")
    approval_required = Column(Boolean, nullable=False, default=False, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("DepartmentRecord", back_populates="workflow_responsibilities")

    __table_args__ = (
        Index("ix_department_workflow_stage_active", "department_id", "stage", "active"),
    )


class DepartmentPermissionConfig(Base):
    """Department RBAC capability switch used by workflow visibility checks."""

    __tablename__ = "department_permission_configs"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    capability = Column(String(80), nullable=False, index=True)
    role = Column(String(80), nullable=False, index=True)
    allowed = Column(Boolean, nullable=False, default=True, index=True)
    scope = Column(String(80), nullable=False, default="DEPARTMENT")
    active = Column(Boolean, nullable=False, default=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("DepartmentRecord", back_populates="permission_configs")

    __table_args__ = (
        Index("ix_department_permission_unique", "department_id", "capability", "role", unique=True),
    )


class DepartmentAreaOwnerMapping(Base):
    """Area-owner approval and escalation routing per department/unit."""

    __tablename__ = "department_area_owner_mappings"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("refinery_units.id"), nullable=True, index=True)
    area_owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    approval_scope = Column(String(80), nullable=False, default="UNIT")
    escalation_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("DepartmentRecord", back_populates="area_owner_mappings")
    unit = relationship("RefineryUnit")
    area_owner = relationship("User", foreign_keys=[area_owner_user_id])
    escalation_owner = relationship("User", foreign_keys=[escalation_user_id])

    __table_args__ = (
        Index("ix_department_area_owner_unit_active", "department_id", "unit_id", "active"),
    )


class DepartmentActivityLog(Base):
    """Append-only audit trail for department orchestration changes."""

    __tablename__ = "department_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(80), nullable=False, index=True)
    summary = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    department = relationship("DepartmentRecord", back_populates="activity_logs")
    actor = relationship("User")
