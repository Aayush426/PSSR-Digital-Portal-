"""Database schema initialization."""

from sqlalchemy import inspect, text

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
    PSSRAnnexureSelection,
    PSSRAuditLog,
    PSSRCheckpointAttachment,
    PSSRNotification,
    PSSRPunchPointEvidence,
    PSSRQuestion,
    PSSRQuestionResponse,
    PSSRTeamMemberAssignment,
    PSSRWorkflow,
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
    _ensure_annexure_question_columns()
    _ensure_live_workflow_columns()


def _ensure_annexure_question_columns() -> None:
    """Backfill additive annexure columns for older local databases."""

    inspector = inspect(engine)
    if "annexure_questions" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("annexure_questions")}
    if "question_type" in existing:
        return
    dialect = engine.dialect.name
    column_type = "VARCHAR(20)" if dialect != "sqlite" else "VARCHAR"
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE annexure_questions ADD COLUMN question_type {column_type} NOT NULL DEFAULT 'FIELD'"))
        connection.execute(text("UPDATE annexure_questions SET question_type = 'FIELD' WHERE question_type IS NULL"))
        if dialect == "postgresql":
            connection.execute(text("ALTER TABLE annexure_questions ALTER COLUMN question_type DROP DEFAULT"))


def _ensure_live_workflow_columns() -> None:
    """Backfill additive live-workflow columns for existing local databases."""

    inspector = inspect(engine)
    if "pssr_workflows" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("pssr_workflows")}
    additions = {
        "completed_at": "TIMESTAMP",
        "completed_by_user_id": "INTEGER",
    }
    with engine.begin() as connection:
        for column, column_type in additions.items():
            if column not in existing:
                connection.execute(text(f"ALTER TABLE pssr_workflows ADD COLUMN {column} {column_type}"))


if __name__ == "__main__":
    initialize_database_schema()
    print("Database tables created successfully")
