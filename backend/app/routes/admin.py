"""
Admin routes for user management and executive dashboard metrics.

Every endpoint in this router is protected by `require_admin`. Route handlers
only validate input, call services, and return response envelopes; business
rules stay in the service layer for testability and future workflow reuse.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.core.responses import success_response
from app.database.session import get_db
from app.models.user import Department, User, UserRole
from app.schemas.auth import UserUpdateRequest
from pydantic import BaseModel
from app.services.admin_service import AdminService
from app.services.user_service import UserService

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/dashboard", summary="Admin Dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Return enterprise admin metrics assembled by AdminService."""

    return success_response(
        data=AdminService.get_dashboard_metrics(db, current_admin),
        message="Welcome to Admin Dashboard",
    )


@router.get("/users", summary="List users")
def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    role: Optional[UserRole] = Query(None),
    department: Optional[Department] = Query(None),
    active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    """
    Return one server-paginated page of the enterprise user directory.

    This endpoint is ADMIN and JWT protected at the router level. It returns a
    standardized response envelope and keeps each request bounded to at most
    100 users. Large refinery identity stores must be browsed through indexed
    database pagination rather than full-table browser rendering.
    """

    result = UserService.list_users_paginated(
        db=db,
        page=page,
        limit=limit,
        role=role,
        department=department,
        active=active,
        search=search,
    )
    return success_response(
        data=result,
        message="Users fetched successfully",
    )


@router.get("/users/team-members", summary="List assignable TEAM_MEMBER users")
def list_assignable_team_members(
    department: Optional[Department] = Query(None),
    db: Session = Depends(get_db),
):
    """Return active TEAM_MEMBER users eligible for dynamic initiator assignment."""

    users = UserService.get_team_members_available_for_assignment(db, department)
    return success_response(
        data=[user.model_dump(mode="json") for user in users],
        message=f"Found {len(users)} eligible team member(s).",
    )


@router.get("/users/{user_id}", summary="Get user profile")
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Return a single enriched user profile."""

    user = UserService.get_by_id(db, user_id)
    from app.core.exceptions import ResourceNotFoundError

    if not user:
        raise ResourceNotFoundError("User", user_id)
    profile = UserService.build_user_profile(db, user, check_initiator=True)
    return success_response(
        data=profile.model_dump(mode="json"),
        message="User retrieved successfully.",
    )


@router.patch("/users/{user_id}", summary="Update user profile")
def update_user(
    user_id: int,
    update_data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Apply an admin-approved partial update through the service layer."""

    profile = UserService.update_user(db, user_id, update_data, current_admin)
    return success_response(
        data=profile.model_dump(mode="json"),
        message="User profile updated successfully.",
    )


class AssignTeamMemberRequest(BaseModel):
    user_id: int
    department: str
    active: bool = True


@router.get(
    "/dashboard/departments-team-members",
    summary="List departments grouped with team members",
)
def departments_team_members(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
):
    """
    Return department -> TEAM_MEMBER listing for Admin Dashboard.

    Team members are grouped by the user's department string.
    is_pssr_initiator is computed dynamically from assignment table.
    """
    grouped = UserService.list_departments_with_team_members(
        db=db, include_inactive=include_inactive
    )
    return success_response(
        data=grouped,
        message=f"Found {len(grouped)} department(s) with team member(s).",
    )


@router.get("/departments", summary="List fixed departments")
def list_departments():
    """Return the fixed department catalog required by the portal spec."""
    return success_response(
        data=UserService.get_fixed_departments(),
        message=f"Found {len(UserService.get_fixed_departments())} department(s).",
    )


@router.get("/team-members", summary="List team members by department")
def list_team_members_by_department(
    department: str = Query(...),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Return TEAM_MEMBER users for the given department."""
    team_members = UserService.list_team_members_by_department(
        db=db, department=department, include_inactive=include_inactive
    )
    return success_response(
        data=[u.model_dump(mode="json") for u in team_members],
        message=f"Found {len(team_members)} team member(s) in '{department}'.",
    )


@router.post("/team-members/assign", summary="Assign TEAM_MEMBER to department")
def assign_team_member_to_department(
    request: AssignTeamMemberRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Assign TEAM_MEMBER role and department; soft-activates by default."""
    profile = UserService.assign_team_member_to_department(
        db=db,
        user_id=request.user_id,
        department=request.department,
        updated_by=current_admin,
        active=request.active,
    )
    return success_response(
        data=profile.model_dump(mode="json"),
        message=f"Assigned user '{profile.full_name}' to department '{profile.department}'.",
    )


@router.delete("/departments/{department}", summary="Deactivate all team members in department")
def deactivate_department_team_members(
    department: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    affected = UserService.deactivate_department_team_members(
        db=db, department=department, updated_by=current_admin
    )
    return success_response(
        data={"department": department, "affected_team_members": affected},
        message=f"Deactivated {affected} TEAM_MEMBER(s) in '{department}'.",
    )




@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate user account",
)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Soft-deactivate a user while preserving historical audit evidence."""

    user = UserService.deactivate_user(db, user_id, current_admin.id)
    return success_response(
        data={"user_id": user.id, "active": user.active},
        message=f"User '{user.full_name}' has been deactivated.",
    )
