"""
Operational index bootstrap utilities.

Production deployments should manage these indexes through Alembic or the
corporate database migration pipeline. This helper exists because the current
project does not yet include migrations; it safely applies idempotent indexes
needed by the high-volume user directory.
"""

from sqlalchemy import text

from app.core.logging import get_logger
from app.database.database import engine
from app.models.department import (
    DepartmentActivityLog,
    DepartmentAnnexureMapping,
    DepartmentAreaOwnerMapping,
    DepartmentPermissionConfig,
    DepartmentRecord,
    DepartmentUnitMapping,
    DepartmentWorkflowResponsibility,
    RefineryUnit,
)
from app.models.permissions import UserPermission

logger = get_logger(__name__)


def ensure_user_directory_indexes() -> None:
    """
    Create user-directory indexes if they do not already exist.

    Server-side pagination is only half of the performance story. Search and
    filter columns must be indexed so PostgreSQL can locate each page without
    scanning the full enterprise identity table.
    """

    ensure_capability_and_department_tables()
    ensure_user_audit_columns()
    ensure_department_orchestration_columns()

    statements = [
        "CREATE INDEX IF NOT EXISTS ix_users_employee_id ON users (employee_id)",
        "CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)",
        "CREATE INDEX IF NOT EXISTS ix_users_role ON users (role)",
        "CREATE INDEX IF NOT EXISTS ix_users_department ON users (department)",
        "CREATE INDEX IF NOT EXISTS ix_users_active ON users (active)",
        "CREATE INDEX IF NOT EXISTS ix_users_full_name ON users (full_name)",
        "CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users (deleted_at)",
        "CREATE INDEX IF NOT EXISTS ix_user_permissions_user_permission_active ON user_permissions (user_id, permission, active)",
        "CREATE INDEX IF NOT EXISTS ix_user_permissions_permission_active ON user_permissions (permission, active)",
        "CREATE INDEX IF NOT EXISTS ix_departments_active_name ON departments (active, name)",
        "CREATE INDEX IF NOT EXISTS ix_refinery_units_zone ON refinery_units (zone)",
        "CREATE INDEX IF NOT EXISTS ix_department_unit_unique ON department_unit_mappings (department_id, unit_id)",
        "CREATE INDEX IF NOT EXISTS ix_department_annexure_active_priority ON department_annexure_mappings (department_id, active, priority)",
        "CREATE INDEX IF NOT EXISTS ix_department_workflow_stage_active ON department_workflow_responsibilities (department_id, stage, active)",
        "CREATE INDEX IF NOT EXISTS ix_department_permission_unique ON department_permission_configs (department_id, capability, role)",
        "CREATE INDEX IF NOT EXISTS ix_department_area_owner_unit_active ON department_area_owner_mappings (department_id, unit_id, active)",
        "CREATE INDEX IF NOT EXISTS ix_department_activity_department_created ON department_activity_logs (department_id, created_at)",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    logger.info("User directory indexes verified")


def ensure_capability_and_department_tables() -> None:
    """Ensure new capability and refinery structure tables exist."""

    with engine.begin() as connection:
        UserPermission.__table__.create(bind=connection, checkfirst=True)
        DepartmentRecord.__table__.create(bind=connection, checkfirst=True)
        RefineryUnit.__table__.create(bind=connection, checkfirst=True)
        DepartmentUnitMapping.__table__.create(bind=connection, checkfirst=True)
        DepartmentAnnexureMapping.__table__.create(bind=connection, checkfirst=True)
        DepartmentWorkflowResponsibility.__table__.create(bind=connection, checkfirst=True)
        DepartmentPermissionConfig.__table__.create(bind=connection, checkfirst=True)
        DepartmentAreaOwnerMapping.__table__.create(bind=connection, checkfirst=True)
        DepartmentActivityLog.__table__.create(bind=connection, checkfirst=True)


def ensure_user_audit_columns() -> None:
    """Add audit columns to older development user tables without data loss."""

    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER",
    ]
    if engine.dialect.name == "sqlite":
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_department_orchestration_columns() -> None:
    """Add orchestration columns to older department-unit tables without data loss."""

    if engine.dialect.name == "sqlite":
        return
    statements = [
        "ALTER TABLE department_unit_mappings ADD COLUMN IF NOT EXISTS workflow_scope VARCHAR(80) NOT NULL DEFAULT 'STANDARD_PSSR'",
        "ALTER TABLE department_unit_mappings ADD COLUMN IF NOT EXISTS area_owner_user_id INTEGER",
        "ALTER TABLE department_unit_mappings ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE department_unit_mappings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        "ALTER TABLE department_unit_mappings ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER",
        "ALTER TABLE department_unit_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
