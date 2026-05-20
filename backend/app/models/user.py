"""
User and role models for the Digital PSSR Portal.

The permanent role model is intentionally small: ADMIN, TEAM_MEMBER, and
AREA_OWNER. PSSR initiator authority is not represented as a user role because
it is a temporary operational assignment that must be granted and revoked per
workflow without rewriting identity records.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String

from app.database import Base


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    TEAM_MEMBER = "TEAM_MEMBER"
    AREA_OWNER = "AREA_OWNER"


class Department(str, Enum):
    ADMINISTRATION = "Administration"
    OPERATIONS = "Operations"
    MECHANICAL = "Mechanical"
    ELECTRICAL = "Electrical"
    INSTRUMENTATION = "Instrumentation"
    INSPECTION = "Inspection"
    SAFETY = "Safety"
    FIRE = "Fire"
    CIVIL = "Civil"
    PRODUCTION = "Production"
    UTILITIES = "Utilities"
    PROCESS = "Process"
    PROJECTS = "Projects"
    MAINTENANCE = "Maintenance"
    RELIABILITY = "Reliability"
    HSE = "HSE"
    QA_QC = "QA/QC"
    WAREHOUSE = "Warehouse"
    PLANNING = "Planning"
    TURNAROUND = "Turnaround"
    ENGINEERING = "Engineering"


class AssignmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class User(Base):
    """
    Enterprise User Model
    Supports:
    - RBAC
    - Department Access
    - Audit Tracking
    - Future SSO Integration
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(String, unique=True, nullable=False)

    full_name = Column(String, nullable=False)

    email = Column(String, unique=True, nullable=False)

    password_hash = Column(String, nullable=False)

    role = Column(String, nullable=False)

    department = Column(String, nullable=False)

    designation = Column(String, nullable=False)

    plant_location = Column(String, nullable=False)

    active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    last_login_at = Column(DateTime, nullable=True)

    __table_args__ = (
        # Enterprise directory queries filter and search across these columns.
        # Explicit indexes keep server-side pagination responsive as personnel
        # records grow from 10k seeded users toward 100k+ corporate identities.
        Index("ix_users_employee_id", "employee_id"),
        Index("ix_users_email", "email"),
        Index("ix_users_role", "role"),
        Index("ix_users_department", "department"),
        Index("ix_users_active", "active"),
        Index("ix_users_full_name", "full_name"),
    )
