from app.database.database import engine, Base

# Import all models to register them with Base before creating tables
from app.models.user import User, AssignmentStatus, Department, UserRole  # noqa: F401
from app.models.assignment import PSSRInitiatorAssignment  # noqa: F401
from app.models.pssr import PSSR, PSSRMember, PSSRAnnoture, PSSRHistory, PSSRStatus  # noqa: F401

# Note: this module is intended for ad-hoc bootstrap / migrations-less setups.
Base.metadata.create_all(bind=engine)

print("Database tables created successfully")
