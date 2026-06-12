"""PSSR workflow and initiator capability routes."""

from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin, require_pssr_initiator
from app.core.responses import paginated_response, success_response
from app.database.session import get_db
from app.models.user import User
from app.repositories.pssr_repository import PSSRTaskRepository
from app.schemas.pssr import UpdateInitiatorCapabilityRequest
from app.schemas.pssr import (
    PSSRCreateRequest,
    PSSRDepartmentFinalizationRequest,
    PSSREditRequest,
    PSSRMemberCompletionRequest,
    PSSRPunchPointRequest,
    PSSRQuestionResponseRequest,
    PSSRReopenDepartmentRequest,
    PSSRTransitionRequest,
)
from app.services.department_service import DepartmentService
from app.services.initiator_service import InitiatorCapabilityService
from app.services.pssr_workflow_service import PSSRWorkflowService

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
    current_user: User = Depends(get_current_user),
):
    workflow_records, workflow_total = PSSRWorkflowService.list_workflows(
        db,
        current_user=current_user,
        search=search,
        department=department,
        page=page,
        limit=limit,
    )
    if workflow_total:
        return paginated_response(
            data=[
                {
                    "id": index + ((page - 1) * limit) + 1,
                    "pssr_id": record["pssr_id"],
                    "pssr_title": record["title"],
                    "unit": record["plant_unit"],
                    "department": department or "",
                    "status": record["workflow_state"],
                    "due_date": None,
                }
                for index, record in enumerate(workflow_records)
            ],
            total=workflow_total,
            page=page,
            per_page=limit,
            message=f"Found {workflow_total} PSSR record(s).",
        )

    records, total = PSSRTaskRepository.list_records(
        db,
        current_user=current_user,
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
    current_user: User = Depends(require_pssr_initiator),
):
    """
    Return active department orchestration data for new PSSR workflows.

    PSSR creation should consume this payload for department selection, annexure
    visibility, checklist ownership, operational units, and approval routing.
    """

    departments = DepartmentService.list_departments(db, search=search, active=True, page=1, limit=100)

    return success_response(
        data=departments,
        message="PSSR creation context fetched successfully.",
    )


@router.post("", summary="Create a live PSSR workflow")
def create_pssr(
    payload: PSSRCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pssr_initiator),
):
    """Create a normalized PSSR workflow with assignments, questions, notifications, and audit logs."""

    return success_response(
        data=PSSRWorkflowService.create(db, payload, current_user),
        message="PSSR workflow created successfully.",
    )


@router.get("/{pssr_id}", summary="Get scoped PSSR workflow detail")
def get_pssr(
    pssr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one PSSR workflow with department-scoped assignments and questions."""

    return success_response(
        data=PSSRWorkflowService.get(db, pssr_id, current_user),
        message="PSSR workflow fetched successfully.",
    )


@router.patch("/{pssr_id}", summary="Edit initiated PSSR workflow")
def update_pssr(
    pssr_id: str,
    payload: PSSREditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update initiator-controlled PSSR header, assignments, annexures, and checkpoints."""

    return success_response(
        data=PSSRWorkflowService.update(db, pssr_id, payload, current_user),
        message="PSSR workflow updated successfully.",
    )


@router.post("/{pssr_id}/submit", summary="Submit draft PSSR workflow")
def submit_pssr(
    pssr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move an initiator-owned draft into the To Do workflow."""

    return success_response(
        data=PSSRWorkflowService.submit(db, pssr_id, current_user),
        message="PSSR workflow submitted to assigned users.",
    )


@router.post("/{pssr_id}/questions/{question_id}/respond", summary="Respond to scoped PSSR question")
def respond_to_pssr_question(
    pssr_id: str,
    question_id: int,
    payload: PSSRQuestionResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a Yes/No/NA response and generate department punch points on No."""

    return success_response(
        data=PSSRWorkflowService.respond(db, pssr_id, question_id, payload, current_user),
        message="PSSR question response saved successfully.",
    )


@router.post("/{pssr_id}/questions/{question_id}/attachment", summary="Upload checkpoint attachment")
def upload_checkpoint_attachment(
    pssr_id: str,
    question_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload or replace the attachment for one checkpoint response."""

    return success_response(
        data=PSSRWorkflowService.upload_checkpoint_attachment(db, pssr_id, question_id, file, current_user),
        message="Checkpoint attachment uploaded successfully.",
    )


@router.get("/{pssr_id}/attachments/{attachment_id}/download", summary="Download checkpoint attachment")
def download_checkpoint_attachment(
    pssr_id: str,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow every PSSR participant to download checkpoint attachments."""

    attachment = PSSRWorkflowService.get_checkpoint_attachment(db, pssr_id, attachment_id, current_user)
    return FileResponse(
        attachment.storage_path,
        media_type=attachment.content_type,
        filename=attachment.file_name,
        content_disposition_type="attachment",
    )


@router.get("/{pssr_id}/attachments/{attachment_id}/view", summary="View checkpoint attachment")
def view_checkpoint_attachment(
    pssr_id: str,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow every PSSR participant to view checkpoint attachments inline."""

    attachment = PSSRWorkflowService.get_checkpoint_attachment(db, pssr_id, attachment_id, current_user)
    return FileResponse(
        attachment.storage_path,
        media_type=attachment.content_type,
        filename=attachment.file_name,
        content_disposition_type="inline",
    )


@router.post("/{pssr_id}/complete-my-side", summary="Complete assigned PSSR work for current user")
def complete_my_side(
    pssr_id: str,
    payload: PSSRMemberCompletionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lock the current user's assigned checkpoint responses and update workflow progress."""

    return success_response(
        data=PSSRWorkflowService.complete_my_side(db, pssr_id, payload.confirm, current_user),
        message="Your PSSR assignment is completed and locked.",
    )


@router.post("/{pssr_id}/finalize-department-work", summary="Finalize department work after member completion")
def finalize_department_work(
    pssr_id: str,
    payload: PSSRDepartmentFinalizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Let the team leader or initiator finalize member-completed department work."""

    return success_response(
        data=PSSRWorkflowService.finalize_department_work(db, pssr_id, payload.department, payload.confirm, current_user),
        message="Department work finalized successfully.",
    )


@router.post("/{pssr_id}/reopen-department-work", summary="Reopen department work")
def reopen_department_work(
    pssr_id: str,
    payload: PSSRReopenDepartmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reopen selected department work so assigned members can edit again."""

    return success_response(
        data=PSSRWorkflowService.reopen_department_work(db, pssr_id, payload.departments, payload.confirm, current_user),
        message="Department work reopened successfully.",
    )


@router.post("/{pssr_id}/punch-points", summary="Create a PSSR punchlist item")
def create_punch_point(
    pssr_id: str,
    payload: PSSRPunchPointRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a manually tracked punchlist item. Editable by PSSR initiator only."""

    return success_response(
        data=PSSRWorkflowService.create_punch_point(db, pssr_id, payload, current_user),
        message="Punchlist item created successfully.",
    )


@router.patch("/{pssr_id}/punch-points/{punch_point_id}", summary="Update a PSSR punchlist item")
def update_punch_point(
    pssr_id: str,
    punch_point_id: int,
    payload: PSSRPunchPointRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a punchlist item. Editable by PSSR initiator only before completion."""

    return success_response(
        data=PSSRWorkflowService.update_punch_point(db, pssr_id, punch_point_id, payload, current_user),
        message="Punchlist item updated successfully.",
    )


@router.post("/{pssr_id}/punch-points/{punch_point_id}/evidence", summary="Upload punch point closure evidence")
def upload_punch_point_evidence(
    pssr_id: str,
    punch_point_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return success_response(
        data=PSSRWorkflowService.upload_punch_evidence(db, pssr_id, punch_point_id, file, current_user),
        message="Punch point evidence uploaded successfully.",
    )


@router.get("/{pssr_id}/punch-points/{punch_point_id}/evidence/{evidence_id}/download", summary="Download punch point evidence")
def download_punch_point_evidence(
    pssr_id: str,
    punch_point_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    evidence = PSSRWorkflowService.get_punch_evidence(db, pssr_id, punch_point_id, evidence_id, current_user)
    return FileResponse(evidence.storage_path, media_type=evidence.content_type, filename=evidence.file_name, content_disposition_type="attachment")


@router.get("/{pssr_id}/punch-points/{punch_point_id}/evidence/{evidence_id}/view", summary="View punch point evidence")
def view_punch_point_evidence(
    pssr_id: str,
    punch_point_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    evidence = PSSRWorkflowService.get_punch_evidence(db, pssr_id, punch_point_id, evidence_id, current_user)
    return FileResponse(evidence.storage_path, media_type=evidence.content_type, filename=evidence.file_name, content_disposition_type="inline")


@router.post("/{pssr_id}/transition", summary="Transition PSSR workflow state")
def transition_pssr(
    pssr_id: str,
    payload: PSSRTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validate and persist a server-side workflow state transition."""

    return success_response(
        data=PSSRWorkflowService.transition(db, pssr_id, payload.target_state, current_user, payload.remarks, payload.area_owner_user_id),
        message="PSSR workflow transitioned successfully.",
    )
