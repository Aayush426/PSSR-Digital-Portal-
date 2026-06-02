"""
Team Member routes.

TEAM_MEMBER users execute assigned PSSR work. Initiator access is checked
dynamically through user permissions instead of a permanent PSSR_INITIATOR role.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import require_pssr_initiator, require_team_member_or_admin
from app.core.responses import success_response
from app.database.session import get_db
from app.models.user import User, UserRole
from app.services.team_service import TeamService
from app.services.user_service import UserService

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


@router.get("/users/directory", summary="Search active team member directory")
def team_member_directory(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    department: Optional[str] = Query(None, max_length=100),
    search: Optional[str] = Query(None, max_length=100),
    include_all_roles: bool = Query(False),
    role: Optional[UserRole] = Query(None),
    _: User = Depends(require_team_member_or_admin),
    db: Session = Depends(get_db),
):
    """Return searchable active TEAM_MEMBER users for PSSR assignment UI."""

    result = UserService.list_users_paginated(
        db=db,
        page=page,
        limit=limit,
        role=role if include_all_roles else UserRole.TEAM_MEMBER,
        department=department,
        active=True,
        search=search,
    )
    return success_response(
        data=result,
        message="Team member directory fetched successfully.",
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
