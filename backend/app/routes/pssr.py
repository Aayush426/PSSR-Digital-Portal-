"""PSSR workflow and initiator capability routes."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_pssr_initiator
from app.core.responses import paginated_response, success_response
from app.database.session import get_db
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
