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
from app.schemas.department import (
    DepartmentAnnexureMappingRequest,
    DepartmentAreaOwnerMappingRequest,
    DepartmentCreateRequest,
    DepartmentPermissionConfigRequest,
    DepartmentUnitMappingRequest,
    DepartmentUpdateRequest,
    DepartmentWorkflowResponsibilityRequest,
)
from app.schemas.auth import UserPermissionResetRequest, UserStatusUpdateRequest, UserUpdateRequest
from app.services.admin_service import AdminService
from app.services.department_service import DepartmentService
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
    initiator: Optional[bool] = Query(None),
    plant_area: Optional[str] = Query(None, max_length=100),
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
        initiator=initiator,
        plant_area=plant_area,
        search=search,
    )
    return success_response(
        data=result,
        message="Users fetched successfully",
    )


@router.get("/users/team-members", summary="List active TEAM_MEMBER users")
def list_assignable_team_members(
    department: Optional[Department] = Query(None),
    db: Session = Depends(get_db),
):
    """Return active TEAM_MEMBER users eligible for capability grants and department work."""

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


@router.patch("/users/{user_id}/status", summary="Enable or disable user")
def update_user_status(
    user_id: int,
    request: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Apply an explicit account status change with audit metadata."""

    profile = UserService.set_user_status(db, user_id, request.active, current_admin.id)
    return success_response(
        data=profile.model_dump(mode="json"),
        message="User status updated successfully.",
    )


@router.patch("/users/{user_id}/permissions", summary="Reset user permissions")
def reset_user_permissions(
    user_id: int,
    request: UserPermissionResetRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Revoke all active user capability grants for access reset."""

    profile = UserService.reset_user_permissions(db, user_id, current_admin.id, request.reason)
    return success_response(
        data=profile.model_dump(mode="json"),
        message="User permissions reset successfully.",
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


@router.get("/departments", summary="List refinery departments")
def list_departments(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """Return backend-driven department masters with personnel, annexures, and units."""

    return success_response(
        data=DepartmentService.list_departments(
            db,
            search=search,
            active=active,
            page=page,
            limit=limit,
        ),
        message="Departments fetched successfully.",
    )


@router.post("/departments", status_code=status.HTTP_201_CREATED, summary="Create department")
def create_department(
    request: DepartmentCreateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.create_department(db, request, current_admin)
    return success_response(data=department, message="Department created successfully.")


@router.patch("/departments/{department_id}", summary="Update department")
def update_department(
    department_id: int,
    request: DepartmentUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.update_department(db, department_id, request, current_admin)
    return success_response(data=department, message="Department updated successfully.")


@router.get("/departments/{department_id}/users", summary="List department users")
def list_department_users(
    department_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    role: Optional[UserRole] = Query(None),
    active: Optional[bool] = Query(None),
    initiator: Optional[bool] = Query(None),
    plant_area: Optional[str] = Query(None, max_length=100),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    """Return department personnel with initiator, workload, and annexure rollups."""

    department = DepartmentService.get_department_by_id(db, department_id)
    result = UserService.list_department_users_paginated(
        db=db,
        department_name=department.name,
        department_code=department.code,
        page=page,
        limit=limit,
        role=role,
        active=active,
        initiator=initiator,
        plant_area=plant_area,
        search=search,
    )
    return success_response(
        data=result,
        message="Department users fetched successfully.",
    )


@router.delete("/departments/{department_id}", summary="Soft delete department")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.soft_delete_department(db, department_id, current_admin)
    return success_response(data=department, message="Department deactivated successfully.")


@router.patch("/departments/{department_id}/annexures", summary="Map or configure department annexure")
def configure_department_annexure(
    department_id: int,
    request: DepartmentAnnexureMappingRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.upsert_annexure_mapping(db, department_id, request, current_admin)
    return success_response(data=department, message="Department annexure mapping updated successfully.")


@router.delete("/departments/{department_id}/annexures/{mapping_id}", summary="Soft remove department annexure mapping")
def remove_department_annexure(
    department_id: int,
    mapping_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.remove_annexure_mapping(db, department_id, mapping_id, current_admin)
    return success_response(data=department, message="Department annexure mapping deactivated successfully.")


@router.patch("/departments/{department_id}/units", summary="Configure department operational unit")
def configure_department_unit(
    department_id: int,
    request: DepartmentUnitMappingRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.upsert_unit_mapping(db, department_id, request, current_admin)
    return success_response(data=department, message="Department operational unit updated successfully.")


@router.patch("/departments/{department_id}/workflow-responsibilities", summary="Configure department workflow responsibility")
def configure_workflow_responsibility(
    department_id: int,
    request: DepartmentWorkflowResponsibilityRequest,
    responsibility_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.upsert_workflow_responsibility(db, department_id, request, current_admin, responsibility_id)
    return success_response(data=department, message="Department workflow responsibility updated successfully.")


@router.patch("/departments/{department_id}/permissions", summary="Configure department permission")
def configure_department_permission(
    department_id: int,
    request: DepartmentPermissionConfigRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.upsert_permission_config(db, department_id, request, current_admin)
    return success_response(data=department, message="Department permission updated successfully.")


@router.patch("/departments/{department_id}/area-owners", summary="Configure department area owner routing")
def configure_area_owner(
    department_id: int,
    request: DepartmentAreaOwnerMappingRequest,
    mapping_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    department = DepartmentService.upsert_area_owner_mapping(db, department_id, request, current_admin, mapping_id)
    return success_response(data=department, message="Department area owner routing updated successfully.")
