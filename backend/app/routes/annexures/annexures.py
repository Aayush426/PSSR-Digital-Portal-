"""Enterprise annexure APIs for backend-driven PSSR checklist workflows."""

from typing import Optional

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin, require_team_member_or_admin
from app.core.responses import success_response
from app.database.session import get_db
from app.models.user import User
from app.schemas.annexures import AnnexureAssignmentIn, AnnexureCreateIn, AnnexureResponseIn, AnnexureUpdateIn
from app.services.annexures import AnnexureService

router = APIRouter(prefix="/annexures", tags=["Annexures"])


@router.get("", summary="List annexure masters")
def list_annexures(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    department: Optional[str] = Query(None, max_length=120),
    active: Optional[bool] = Query(True),
    archived: Optional[bool] = Query(False),
    revision: Optional[str] = Query(None, max_length=40),
    has_template: Optional[bool] = Query(None),
    recently_modified: bool = Query(False),
    sort_by: str = Query("number", max_length=40),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    pssr_id: Optional[str] = Query(None, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return paginated annexure master data with progress for a PSSR instance."""

    return success_response(
        data=AnnexureService.list_annexures(
            db,
            page=page,
            limit=limit,
            search=search,
            department=department,
            active=active,
            archived=archived,
            revision=revision,
            has_template=has_template,
            recently_modified=recently_modified,
            sort_by=sort_by,
            sort_dir=sort_dir,
            pssr_id=pssr_id,
        ),
        message="Annexures fetched successfully.",
    )


@router.get("/overview", summary="Get annexure master overview")
def overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return dashboard metrics for the global annexure master repository."""

    return success_response(
        data=AnnexureService.overview(db),
        message="Annexure overview fetched successfully.",
    )


@router.post("", summary="Create annexure master")
def create_annexure(
    payload: AnnexureCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a global annexure template definition."""

    return success_response(
        data=AnnexureService.create_annexure(db, payload, current_user),
        message="Annexure created successfully.",
    )


@router.put("/{annexure_id}", summary="Update annexure master")
def update_annexure(
    annexure_id: int,
    payload: AnnexureUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update annexure metadata, departments, sections, and question templates."""

    return success_response(
        data=AnnexureService.update_annexure(db, annexure_id, payload, current_user),
        message="Annexure updated successfully.",
    )


@router.delete("/{annexure_id}", summary="Archive annexure master")
def archive_annexure(
    annexure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Soft delete an annexure while retaining workflow references and audit history."""

    return success_response(
        data=AnnexureService.archive_annexure(db, annexure_id, current_user),
        message="Annexure archived successfully.",
    )


@router.post("/{annexure_id}/restore", summary="Restore archived annexure master")
def restore_annexure(
    annexure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Restore a soft-deleted annexure master without changing historical records."""

    return success_response(
        data=AnnexureService.restore_annexure(db, annexure_id, current_user),
        message="Annexure restored successfully.",
    )


@router.get("/pending-review", summary="Area owner annexure review queue")
def pending_review(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return annexure assignments waiting for area-owner review."""

    return success_response(
        data=AnnexureService.pending_review(db, current_user, limit),
        message="Pending annexure review queue fetched successfully.",
    )


@router.get("/{annexure_id}", summary="Get annexure detail")
def get_annexure(
    annexure_id: int,
    pssr_id: Optional[str] = Query(None, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one annexure with sections, questions, templates, and responses."""

    return success_response(
        data=AnnexureService.get_annexure(db, annexure_id, pssr_id),
        message="Annexure fetched successfully.",
    )


@router.get("/{annexure_id}/questions", summary="Get annexure questions")
def get_questions(
    annexure_id: int,
    pssr_id: Optional[str] = Query(None, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return dynamic checklist sections/questions for backend-driven forms."""

    return success_response(
        data=AnnexureService.get_questions(db, annexure_id, pssr_id),
        message="Annexure questions fetched successfully.",
    )


@router.post("/respond", summary="Record annexure checklist response")
def respond(
    payload: AnnexureResponseIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_member_or_admin),
):
    """Create or update a PASS/FAIL/NA/PENDING response with audit metadata."""

    return success_response(
        data=AnnexureService.record_response(db, payload, current_user),
        message="Annexure response saved successfully.",
    )


@router.post("/assign", summary="Assign annexure workflow")
def assign(
    payload: AnnexureAssignmentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Assign an annexure or specific question to a department/member."""

    return success_response(
        data=AnnexureService.assign(db, payload, current_user),
        message="Annexure assignment created successfully.",
    )


@router.post("/upload-template", summary="Upload annexure template")
async def upload_template(
    annexure_id: int = Form(...),
    version: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload a versioned PDF/DOCX/image template for an annexure."""

    return success_response(
        data=await AnnexureService.upload_template(
            db,
            annexure_id=annexure_id,
            version=version,
            file=file,
            current_user=current_user,
        ),
        message="Annexure template uploaded successfully.",
    )


@router.get("/{annexure_id}/download-template", summary="Download active annexure template")
def download_template(
    annexure_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the active Word template for an annexure master."""

    template = AnnexureService.active_template(db, annexure_id)
    path = Path(template.file_path)
    if not path.exists():
        path = Path(template.storage_path)
    return FileResponse(path, media_type=template.mime_type, filename=template.file_name)
