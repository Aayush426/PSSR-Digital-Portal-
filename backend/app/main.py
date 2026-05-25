"""
PSSR Portal - FastAPI Application Factory

File: app/main.py

Purpose:
    Application entry point. Creates and configures the FastAPI instance with:
    - CORS middleware
    - Request logging middleware
    - Global exception handlers
    - API router registration (versioned under /api/v1)
    - Startup/shutdown lifecycle events
    - Swagger UI customization

Architecture:
    Uses the Application Factory pattern — the app instance is created by
    create_application() for testability (tests create their own instance).

 Standards:
    - API versioned at /api/v1 — enables non-breaking future API evolution
    - CORS restricted to configured origins (no wildcard * in production)
    - Swagger available only in development/staging environments
    - Lifecycle events handle database validation and caching warm-up

Deployment:
    Run with: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
    Docker: ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database.indexes import ensure_user_directory_indexes
from app.database.session import check_database_connection
from app.middleware.exception_handler import register_exception_handlers
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.routes import (
    auth_router, admin_router, pssr_router, pssr_initiator_router,
    team_router, area_owner_router, health_router
)
from app.core.logging import get_logger

logger = get_logger(__name__)



# Application Lifecycle Events


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Handles startup and shutdown events cleanly.

    Startup Checks:
        - Database connectivity verification
        - (Future) Redis cache connection
        - (Future) Background task scheduler initialization

    Shutdown Cleanup:
        - (Future) Flush pending audit log events
        - (Future) Graceful task queue drain
    """
    # ------- STARTUP -------
    logger.info(
        f"Starting {settings.APP_NAME} v{settings.APP_VERSION} "
        f"[env={settings.APP_ENV}]"
    )

    # Verify database connectivity at startup — fail fast if DB is unreachable
    if not check_database_connection():
        logger.critical(
            "STARTUP FAILED: Cannot connect to PostgreSQL database. "
            "Check DATABASE_URL environment variable."
        )
        raise RuntimeError("Database connection failed at startup")

    logger.info("Database connection: VERIFIED")

    # Ensure schema exists before creating indexes (prevents "no such table: main.users" on fresh DBs)
    try:
        from app.database.database import engine, Base
        
        # Import all models to register them with Base before creating tables
        from app.models.user import User, AssignmentStatus, Department, UserRole  # noqa: F401
        from app.models.assignment import PSSRInitiatorAssignment  # noqa: F401
        from app.models.pssr import PSSR, PSSRMember, PSSRAnnoture, PSSRHistory, PSSRStatus  # noqa: F401
        
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception:
        # Fallback: do not block startup if table creation is managed externally.
        logger.exception("Database table bootstrap failed (tables may already exist / migrations may handle schema)")

    ensure_user_directory_indexes()
    logger.info(f"API available at: http://0.0.0.0:8000{settings.API_PREFIX}")
    logger.info(
        f"Swagger UI: http://0.0.0.0:8000/docs "
        f"({'ENABLED' if settings.DEBUG else 'DISABLED in production'})"
    )

    yield  # Application runs here

    # ------- SHUTDOWN -------
    logger.info(f"Shutting down {settings.APP_NAME}...")



# Application Factory


def create_application() -> FastAPI:
    """
    Factory function that creates and configures the FastAPI application.

    Factory Pattern Benefits:
        - Tests create isolated app instances
        - Configuration is injected (not global)
        - Middleware and routes are explicitly composed here
        - Easy to create variants (e.g., minimal app for migrations)

    Returns:
        Configured FastAPI application instance.
    """

    # Swagger/OpenAPI docs only available in non-production environments
    docs_url = "/docs" if settings.DEBUG or settings.APP_ENV != "production" else None
    redoc_url = "/redoc" if settings.DEBUG or settings.APP_ENV != "production" else None

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="""
## PSSR Enterprise Portal — Backend API

**Pre-Startup Safety Review (PSSR) Management System** for refinery operations.

### Authentication
Use `POST /api/v1/auth/login` to obtain a JWT Bearer token.
Include in all subsequent requests as: `Authorization: Bearer <token>`

### Role-Based Access
| Role | Dashboard | Capabilities |
|------|-----------|--------------|
| `ADMIN` | `/admin/dashboard` | Full system access, user management, PSSR assignments |
| `TEAM_MEMBER` | `/team/dashboard` | PSSR execution; initiator access via assignment |
| `AREA_OWNER` | `/area-owner/dashboard` | PSSR visibility and approval within plant area |

### PSSR Initiator Model
`PSSR_INITIATOR` is not a permanent role. TEAM_MEMBERs are dynamically
assigned as initiators per-project by an ADMIN.

### Response Envelope
All responses follow the standard envelope:
```json
{ "success": bool, "message": str, "data": any, "error": ErrorDetail | null }
```
        """,
        contact={
            "name": "PSSR Portal Engineering Team",
            "email": "pssr-support@refinery.com",
        },
        license_info={
            "name": "Proprietary — Refinery Internal Use Only",
        },
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url="/openapi.json" if docs_url else None,
        lifespan=lifespan,
    )

    
    # Middleware Stack (applied in reverse order — last added = first executed)
    

    # CORS  must be first to handle preflight OPTIONS requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],       # Allows frontend to read correlation IDs
    )

    # Request Logging — structured audit trail for all API calls
    app.add_middleware(RequestLoggingMiddleware)

    
    # Exception Handlers
    
    register_exception_handlers(app)

    
    # Route Registration
    
    # All routes mounted under /api/v1 for versioning.
    # Future API version: add /api/v2 prefix for non-breaking additions.


    # Health check — NO auth required, mounted at root level
    app.include_router(health_router)

    # Authentication routes — public (login, etc.)
    app.include_router(auth_router, prefix=settings.API_PREFIX)

    # Admin routes — RBAC enforced at router level
    app.include_router(admin_router, prefix=settings.API_PREFIX)
    app.include_router(pssr_router, prefix=settings.API_PREFIX)

    # PSSR Initiator routes — requires PSSR Initiator privilege
    app.include_router(pssr_initiator_router, prefix=settings.API_PREFIX)

    # Team Member routes
    app.include_router(team_router, prefix=settings.API_PREFIX)

    # Area Owner routes
    app.include_router(area_owner_router, prefix=settings.API_PREFIX)

    logger.info(
        f"Application factory complete — "
        f"{len(app.routes)} routes registered"
    )

    return app



# Application Instance
# This is the ASGI application object used by uvicorn / gunicorn.
# Import path: app.main:app


app = create_application()
