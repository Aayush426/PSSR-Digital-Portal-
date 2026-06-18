"""
Request-scoped database session dependencies.

FastAPI routes receive sessions through `get_db` so transactions are bounded to
one HTTP request. This is important for audit-heavy workflow software: a failed
request should not leave half-written approval or assignment state behind.
"""

from typing import Generator

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal, engine


def get_db() -> Generator[Session, None, None]:
    """
    Yield one SQLAlchemy session per request and always close it.

    Business services commit only after completing a coherent operation. Route
    handlers should not manually create sessions because that hides transaction
    boundaries from reviewers and future audit instrumentation.
    """

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    """
    Verify database connectivity for startup checks and health probes.

    The query is deliberately minimal. In production this can be extended to
    validate replica lag or migration state without changing route handlers.
    """

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
