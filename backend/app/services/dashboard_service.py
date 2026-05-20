"""
Role-specific dashboard service.

Dashboards currently return minimal profile-centric payloads, but the service
boundary is already prepared for future workflow KPIs, area-scoped approvals,
and refinery unit health summaries.
"""

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.user_service import UserService


class DashboardService:
    """Compose dashboard payloads for non-admin roles."""

    @staticmethod
    def get_team_dashboard(db: Session, current_user: User) -> dict:
        """Return the TEAM_MEMBER landing payload."""

        profile = UserService.build_user_profile(db, current_user, check_initiator=True)
        return {
            "user": profile.model_dump(mode="json"),
            "dashboard_type": "TEAM_MEMBER",
            "welcome_message": "Welcome to Team Member Dashboard",
            "initiator_privileges": profile.is_pssr_initiator,
        }

    @staticmethod
    def get_area_owner_dashboard(db: Session, current_user: User) -> dict:
        """Return the AREA_OWNER landing payload."""

        profile = UserService.build_user_profile(db, current_user, check_initiator=False)
        return {
            "user": profile.model_dump(mode="json"),
            "dashboard_type": "AREA_OWNER",
            "welcome_message": "Welcome to Area Owner Dashboard",
        }
