from app.database.database import engine, Base

# Import all models to register them with Base before creating tables
from app.models.user import User, AssignmentStatus, Department, UserRole  # noqa: F401
from app.models.assignment import PSSRInitiatorAssignment  # noqa: F401
from app.models.pssr import PSSR, PSSRMember, PSSRAnnoture, PSSRHistory, PSSRStatus  # noqa: F401

<<<<<<< HEAD
# Note: this module is intended for ad-hoc bootstrap / migrations-less setups.
Base.metadata.create_all(bind=engine)
=======
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
>>>>>>> 9b293bf (Refactor enterprise department workflows and improve PSSR admin UX)

print("Database tables created successfully")
