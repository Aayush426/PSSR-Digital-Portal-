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

logger = get_logger(__name__)


def ensure_user_directory_indexes() -> None:
    """
    Create user-directory indexes if they do not already exist.

    Server-side pagination is only half of the performance story. Search and
    filter columns must be indexed so PostgreSQL can locate each page without
    scanning the full enterprise identity table.
    """

    statements = [
        "CREATE INDEX IF NOT EXISTS ix_users_employee_id ON users (employee_id)",
        "CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)",
        "CREATE INDEX IF NOT EXISTS ix_users_role ON users (role)",
        "CREATE INDEX IF NOT EXISTS ix_users_department ON users (department)",
        "CREATE INDEX IF NOT EXISTS ix_users_active ON users (active)",
        "CREATE INDEX IF NOT EXISTS ix_users_full_name ON users (full_name)",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    logger.info("User directory indexes verified")
