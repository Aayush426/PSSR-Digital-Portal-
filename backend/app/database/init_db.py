"""Database schema initialization."""

from app.database.database import Base, engine

# Import model modules before create_all so every table is registered in
# SQLAlchemy metadata.
from app.models import (  # noqa: F401
    Annexure,
    AnnexureAuditLog,
    AnnexureAssignment,
    AnnexureDepartment,
    AnnexurePunchPoint,
    AnnexureQuestion,
    AnnexureRevision,
    AnnexureResponse,
    AnnexureSection,
    AnnexureTemplate,
    PSSRExecutionResponse,
    PSSRInstanceAnnexure,
    PSSRInstanceQuestion,
    PSSRReviewState,
    PSSRActivityLog,
    PSSRMocReview,
    PSSRTask,
    DepartmentRecord,
    DepartmentActivityLog,
    DepartmentAnnexureMapping,
    DepartmentAreaOwnerMapping,
    DepartmentPermissionConfig,
    DepartmentUnitMapping,
    DepartmentWorkflowResponsibility,
    RefineryUnit,
    UserPermission,
    User,
)


def initialize_database_schema() -> None:
    """Create all registered tables when running without Alembic migrations."""

    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    initialize_database_schema()
    print("Database tables created successfully")
