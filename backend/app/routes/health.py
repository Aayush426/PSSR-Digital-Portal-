"""
Health routes.

Health probes remain unauthenticated so load balancers, Kubernetes, and uptime
monitors can assess service state without owning portal credentials.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.config.settings import settings
from app.database.session import check_database_connection

health_router = APIRouter(tags=["System"])


@health_router.get("/health", summary="System health check")
def health_check():
    """Return application and database health for platform monitoring."""

    db_healthy = check_database_connection()
    return {
        "status": "healthy" if db_healthy else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "database": "connected" if db_healthy else "unavailable",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
