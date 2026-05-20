"""
Area Owner routes.

Area Owners represent operational accountability for refinery areas. This
router contains only area-owner concerns and uses the reusable RBAC dependency,
with no inline lambda authorization.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_area_owner
from app.core.responses import success_response
from app.database.session import get_db
from app.models.user import User
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/area-owner", tags=["Area Owner"])


@router.get("/dashboard", summary="Area Owner Dashboard")
def area_owner_dashboard(
    current_user: User = Depends(require_area_owner),
    db: Session = Depends(get_db),
):
    """Return the minimal AREA_OWNER dashboard payload."""

    return success_response(
        data=DashboardService.get_area_owner_dashboard(db, current_user),
        message="Welcome to Area Owner Dashboard",
    )
