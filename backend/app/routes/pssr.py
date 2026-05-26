<<<<<<< HEAD
"""
PSSR routes: initiator assignment management + PSSR workflow.

Contains:
1. Admin endpoints for managing PSSR initiator assignments
2. PSSR Initiator endpoints for creating and managing PSSR documents
3. Future extensions for checklists, approvals, MOC links, SAP integration

Workflow: initiator creates PSSR → adds members → adds annexures → submits
"""
=======
"""PSSR workflow and initiator capability routes."""
>>>>>>> 9b293bf (Refactor enterprise department workflows and improve PSSR admin UX)

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_pssr_initiator
from app.core.responses import paginated_response, success_response
from app.database.session import get_db
<<<<<<< HEAD
from app.models.user import AssignmentStatus, User
from app.schemas.auth import AssignInitiatorRequest, RevokeInitiatorRequest
from app.schemas.pssr import (
    AddPSSRAnnotureRequest,
    AddPSSRMemberRequest,
    CreatePSSRRequest,
    RemovePSSRAnnotureRequest,
    RemovePSSRMemberRequest,
    UpdatePSSRRequest,
)
from app.services.initiator_service import InitiatorAssignmentService
from app.services.pssr_service import PSSRService

# Admin router: initiator assignment management
admin_router = APIRouter(
    prefix="/admin/pssr",
    tags=["Admin — PSSR Initiator Management"],
    dependencies=[Depends(require_admin)],
)

# PSSR Initiator router: PSSR document lifecycle
pssr_router = APIRouter(
    prefix="/pssr",
    tags=["PSSR Initiator — Workflow"],
    dependencies=[Depends(require_pssr_initiator)],
)

# Expose both routers
router = admin_router


@admin_router.post(
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


@admin_router.post("/revoke-initiator", summary="Revoke PSSR Initiator assignment")
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


@admin_router.delete(
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


@admin_router.get("/assignments", summary="List PSSR initiator assignments")
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
=======
from app.models.user import User
from app.repositories.pssr_repository import PSSRTaskRepository
from app.schemas.pssr import UpdateInitiatorCapabilityRequest
from app.services.department_service import DepartmentService
from app.services.initiator_service import InitiatorCapabilityService

router = APIRouter(prefix="/pssr", tags=["PSSR Workflow"])


@router.patch(
    "/initiators/{user_id}/enable",
    status_code=status.HTTP_200_OK,
    summary="Grant TEAM_MEMBER user PSSR initiator capability",
)
def enable_pssr_initiator(
    user_id: int,
    request: UpdateInitiatorCapabilityRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    capability = InitiatorCapabilityService.grant_initiator_access(
        db,
>>>>>>> 9b293bf (Refactor enterprise department workflows and improve PSSR admin UX)
        user_id=user_id,
        current_admin=current_admin,
        reason=request.reason,
    )
    return success_response(
        data=capability.model_dump(mode="json"),
        message="PSSR initiator access enabled.",
    )


@router.patch(
    "/initiators/{user_id}/disable",
    summary="Revoke TEAM_MEMBER user PSSR initiator capability",
)
def disable_pssr_initiator(
    user_id: int,
    request: UpdateInitiatorCapabilityRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    capability = InitiatorCapabilityService.revoke_initiator_access(
        db,
        user_id=user_id,
        current_admin=current_admin,
        reason=request.reason,
    )
    return success_response(
        data=capability.model_dump(mode="json"),
        message="PSSR initiator access disabled.",
    )


@router.get("/initiators", summary="List PSSR initiator-capable users")
def list_pssr_initiators(
    active: Optional[bool] = Query(True),
    department: Optional[str] = Query(None, max_length=120),
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    initiators, total = InitiatorCapabilityService.list_initiators(
        db,
        active=active,
        department=department,
        search=search,
        page=page,
        limit=limit,
    )
    return paginated_response(
        data=[initiator.model_dump(mode="json") for initiator in initiators],
        total=total,
        page=page,
        per_page=limit,
        message=f"Found {total} PSSR initiator-capable user(s).",
    )


@router.get("/initiators/statistics", summary="PSSR initiator capability statistics")
def pssr_initiator_statistics(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return success_response(
        data=InitiatorCapabilityService.capability_counts(db),
        message="PSSR initiator statistics fetched successfully.",
    )


@router.get("/records", summary="List PSSR workflow records")
def list_pssr_records(
    search: Optional[str] = Query(None, max_length=100),
    department: Optional[str] = Query(None, max_length=120),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    records, total = PSSRTaskRepository.list_records(
        db,
        search=search,
        department=department,
        page=page,
        limit=limit,
    )
    return paginated_response(
        data=[
            {
                "id": record.id,
                "pssr_id": record.pssr_id,
                "pssr_title": record.pssr_title,
                "unit": record.unit,
                "department": record.department,
                "priority": record.priority,
                "status": record.status,
                "due_date": record.due_date.date().isoformat() if record.due_date else None,
            }
            for record in records
        ],
        total=total,
        page=page,
        per_page=limit,
        message=f"Found {total} PSSR record(s).",
    )


@router.get("/creation-context", summary="Department-driven PSSR creation context")
def pssr_creation_context(
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_pssr_initiator),
):
    """
    Return active department orchestration data for new PSSR workflows.

    PSSR creation should consume this payload for department selection, annexure
    visibility, checklist ownership, operational units, and approval routing.
    """

    return success_response(
        data=DepartmentService.list_departments(
            db,
            search=search,
            active=True,
            page=1,
            limit=100,
        ),
        message="PSSR creation context fetched successfully.",
    )


# =========================================================
# PSSR Initiator Workflow Endpoints
# =========================================================


@pssr_router.post(
    "/create",
    status_code=status.HTTP_201_CREATED,
    summary="Create new PSSR (draft)",
)
def create_pssr(
    request: CreatePSSRRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """
    Create a new PSSR in DRAFT state.

    Business workflow:
    1. User selects MOC or Non-MOC type
    2. Fills PSSR details (number, area, description, etc.)
    3. Optionally adds team members and annexures
    4. Saves as draft for continued editing

    Only PSSR Initiators can create PSSRs. Area is pre-populated from initiator profile.
    """

    pssr = PSSRService.create_pssr(db, request, current_user)
    return success_response(
        data=pssr.model_dump(mode="json"),
        message=f"PSSR {pssr.pssr_number} created successfully in draft state.",
        status_code=status.HTTP_201_CREATED,
    )


@pssr_router.get("/{pssr_id}", summary="Get PSSR details")
def get_pssr(
    pssr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Retrieve complete PSSR with all members, annexures, and history."""

    pssr = PSSRService.get_pssr_detail(db, pssr_id)
    return success_response(
        data=pssr.model_dump(mode="json"),
        message="PSSR retrieved successfully.",
    )


@pssr_router.put("/{pssr_id}", summary="Update PSSR (draft only)")
def update_pssr(
    pssr_id: int,
    request: UpdatePSSRRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """
    Update PSSR details, members, or annexures (draft only).

    Once submitted, only the PSSR Initiator and Area Owner can modify members/annexures.
    Details are locked after submission.
    """

    pssr = PSSRService.update_pssr(db, pssr_id, request, current_user)
    return success_response(
        data=pssr.model_dump(mode="json"),
        message="PSSR updated successfully.",
    )


@pssr_router.post("/{pssr_id}/save-draft", summary="Save PSSR as draft")
def save_draft(
    pssr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Save PSSR as draft for continued editing later."""

    pssr = PSSRService.save_draft(db, pssr_id, current_user)
    return success_response(
        data=pssr.model_dump(mode="json"),
        message="PSSR saved as draft.",
    )


@pssr_router.post("/{pssr_id}/submit", summary="Submit PSSR")
def submit_pssr(
    pssr_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """
    Submit PSSR to team members (DRAFT → TO_DO).

    After submission:
    - Details are locked and cannot be changed
    - Only PSSR Initiator and Area Owner can modify members/annexures
    - PSSR appears on team members' worklists
    """

    pssr = PSSRService.submit_pssr(db, pssr_id, current_user)
    return success_response(
        data=pssr.model_dump(mode="json"),
        message="PSSR submitted to team members.",
    )


@pssr_router.get("", summary="List initiator's PSSRs")
def list_my_pssrs(
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """List all PSSRs created by the current initiator with optional status filter."""

    pssrs, total = PSSRService.list_pssr_by_initiator(
        db, current_user, status_filter=status, page=page, per_page=per_page
    )
    return paginated_response(
        data=[p.model_dump(mode="json") for p in pssrs],
        total=total,
        page=page,
        per_page=per_page,
        message=f"Found {total} PSSR(s).",
    )


# =========================================================
# PSSR Member Management
# =========================================================


@pssr_router.post("/{pssr_id}/members", status_code=status.HTTP_201_CREATED, summary="Add team member to PSSR")
def add_member(
    pssr_id: int,
    request: AddPSSRMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Add a team member to the PSSR."""

    member = PSSRService.add_member(db, pssr_id, request, current_user)
    return success_response(
        data=member.model_dump(mode="json"),
        message="Team member added to PSSR.",
        status_code=status.HTTP_201_CREATED,
    )


@pssr_router.delete("/{pssr_id}/members/{member_id}", summary="Remove team member from PSSR")
def remove_member(
    pssr_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Remove a team member from the PSSR."""

    PSSRService.remove_member(
        db, pssr_id, RemovePSSRMemberRequest(member_id=member_id), current_user
    )
    return success_response(
        data={"member_id": member_id},
        message="Team member removed from PSSR.",
    )


# =========================================================
# PSSR Annexure Management
# =========================================================


@pssr_router.post("/{pssr_id}/annexures", status_code=status.HTTP_201_CREATED, summary="Add annexure to PSSR")
def add_annexure(
    pssr_id: int,
    request: AddPSSRAnnotureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Add a checklist annexure to the PSSR."""

    annexure = PSSRService.add_annexure(db, pssr_id, request, current_user)
    return success_response(
        data=annexure.model_dump(mode="json"),
        message="Annexure added to PSSR.",
        status_code=status.HTTP_201_CREATED,
    )


@pssr_router.delete("/{pssr_id}/annexures/{annexure_id}", summary="Remove annexure from PSSR")
def remove_annexure(
    pssr_id: int,
    annexure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Soft-delete an annexure from the PSSR (preserves history for re-addition)."""

    PSSRService.remove_annexure(
        db, pssr_id, RemovePSSRAnnotureRequest(annexure_id=annexure_id), current_user
    )
    return success_response(
        data={"annexure_id": annexure_id},
        message="Annexure removed from PSSR.",
    )
