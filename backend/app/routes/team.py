"""
Team Member routes.

TEAM_MEMBER users execute assigned PSSR work. Initiator access is checked
dynamically through user permissions instead of a permanent PSSR_INITIATOR role.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_pssr_initiator, require_team_member_or_admin
from app.core.responses import success_response
from app.database.session import get_db
from app.models.user import User
from app.services.team_service import TeamService

router = APIRouter(prefix="/team", tags=["Team Member"])


@router.get("/dashboard", summary="Team Member Dashboard")
def team_dashboard(
    current_user: User = Depends(require_team_member_or_admin),
    db: Session = Depends(get_db),
):
    """Return the backend-owned TEAM_MEMBER dashboard payload."""

    return success_response(
        data=TeamService.get_dashboard(db, current_user).model_dump(mode="json"),
        message="Welcome to Team Member Dashboard",
    )


@router.get("/pssr/initiate", summary="PSSR initiation entry")
def pssr_initiation_entry(
    current_user: User = Depends(require_pssr_initiator),
):
    """Authorize entry into future PSSR initiation workflow screens."""

    return success_response(
        data={
            "user_id": current_user.id,
            "employee_id": current_user.employee_id,
            "message": "PSSR initiation access granted.",
        },
        message="PSSR initiation available.",
    )
