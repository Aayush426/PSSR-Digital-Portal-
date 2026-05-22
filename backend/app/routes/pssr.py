"""
PSSR assignment routes.

The current PSSR surface is limited to dynamic initiator assignment management.
Future workflow endpoints for checklists, approvals, MOC links, and SAP work
orders can be added here without mixing them into admin user-management routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.core.responses import paginated_response, success_response
from app.database.session import get_db
from app.models.user import AssignmentStatus, User
from app.schemas.auth import AssignInitiatorRequest, RevokeInitiatorRequest
from app.services.initiator_service import InitiatorAssignmentService

router = APIRouter(
    prefix="/admin/pssr",
    tags=["Admin — PSSR Initiator Management"],
    dependencies=[Depends(require_admin)],
)


@router.post(
    "/assign-initiator",
    status_code=status.HTTP_201_CREATED,
    summary="Assign TEAM_MEMBER as PSSR Initiator",
)
def assign_pssr_initiator(
    request: AssignInitiatorRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Create an auditable temporary initiator assignment."""

    assignment = InitiatorAssignmentService.assign_initiator(db, request, current_admin)
    return success_response(
        data=assignment.model_dump(mode="json"),
        message=(
            f"'{assignment.user_full_name}' has been assigned as PSSR Initiator "
            f"for project '{assignment.project_reference or 'global'}'."
        ),
    )


@router.post("/revoke-initiator", summary="Revoke PSSR Initiator assignment")
def revoke_pssr_initiator(
    request: RevokeInitiatorRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Revoke an assignment without deleting historical evidence."""

    assignment = InitiatorAssignmentService.revoke_initiator(db, request, current_admin)
    return success_response(
        data=assignment.model_dump(mode="json"),
        message=f"PSSR Initiator assignment for '{assignment.user_full_name}' revoked.",
    )


@router.delete(
    "/hard-delete-assignment/{assignment_id}",
    summary="Hard delete PSSR initiator assignment (keep User)",
)
def hard_delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Hard delete the initiator assignment row.

    The User row is not affected.
    """

    deleted_id = InitiatorAssignmentService.hard_delete_assignment(
        db=db, assignment_id=assignment_id
    )
    return success_response(
        data={"assignment_id": deleted_id},
        message=f"Hard deleted PSSR initiator assignment {deleted_id}.",
    )


@router.get("/assignments", summary="List PSSR initiator assignments")
def list_pssr_assignments(
    status: Optional[AssignmentStatus] = Query(None, alias="status"),
    status_filter: Optional[AssignmentStatus] = Query(None),
    user_id: Optional[int] = Query(None),
    project_reference: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return paginated assignment records for admin review.

    Accepts both `?status=` (aliased) and `?status_filter=` for robustness
    against older frontend clients.
    """

    effective_status = status_filter if status_filter is not None else status

    assignments, total = InitiatorAssignmentService.list_assignments(
        db=db,
        status_filter=effective_status,
        user_id=user_id,
        project_reference=project_reference,
        page=page,
        per_page=per_page,
    )
    return paginated_response(
        data=[assignment.model_dump(mode="json") for assignment in assignments],
        total=total,
        page=page,
        per_page=per_page,
        message=f"Found {total} assignment(s).",
    )
