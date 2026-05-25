"""
PSSR domain service.

Handles creation, workflow management, member/annexure manipulation, and history
tracking for Process Safety System Reviews.

All business rules are implemented here; routes delegate to this layer.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ResourceNotFoundError, ValidationError
from app.core.logging import get_logger
from app.models.pssr import PSSR, PSSRAnnoture, PSSRHistory, PSSRMember, PSSRStatus
from app.models.user import User
from app.schemas.pssr import (
    AddPSSRAnnotureRequest,
    AddPSSRMemberRequest,
    CreatePSSRRequest,
    CreatePSSRTypeRequest,
    PSSRAnnotureResponse,
    PSSRHistoryEventResponse,
    PSSRListItemResponse,
    PSSRMemberResponse,
    PSSRResponse,
    RemovePSSRAnnotureRequest,
    RemovePSSRMemberRequest,
    UpdatePSSRRequest,
)

logger = get_logger(__name__)


class PSSRService:
    """Business logic for PSSR lifecycle and operations."""

    @staticmethod
    def _generate_pssr_number(db: Session, base_number: str) -> str:
        """
        Generate a unique PSSR number.

        Supports suffixes for multiple PSSR on same area (e.g., XXXXX-a, XXXXX-b).
        """
        candidate = base_number
        counter = 1

        while (
            db.query(PSSR).filter(PSSR.pssr_number == candidate).first()
        ):
            suffix = chr(96 + counter)  # a, b, c, ...
            candidate = f"{base_number}-{suffix}"
            counter += 1

        return candidate

    @staticmethod
    def _log_history(
        db: Session,
        pssr: PSSR,
        action: str,
        performed_by: User,
        previous_status: Optional[str] = None,
        new_status: Optional[str] = None,
        details: Optional[str] = None,
    ) -> None:
        """Record an event in PSSR history."""

        history = PSSRHistory(
            pssr_id=pssr.id,
            action=action,
            previous_status=previous_status,
            new_status=new_status,
            details=details,
            performed_by_id=performed_by.id,
            performed_at=datetime.now(timezone.utc),
        )
        db.add(history)

    @staticmethod
    def create_pssr(
        db: Session,
        request: CreatePSSRRequest,
        initiator: User,
    ) -> PSSRResponse:
        """
        Create a new PSSR (DRAFT state).

        Business rules:
        - PSSR number must be unique
        - Area is pre-filled with initiator's assigned area
        - For Non-MOC, MOC fields are ignored
        - Initial members/annexures are optional
        """

        if not request.details.pssr_number or not request.details.pssr_number.strip():
            raise ValidationError("PSSR number is required.")

        # Generate unique PSSR number
        pssr_number = PSSRService._generate_pssr_number(
            db, request.details.pssr_number
        )

        # Validate MOC vs Non-MOC
        if request.details.is_moc and not request.details.moc_number:
            raise ValidationError(
                "MOC PSSR requires MOC number."
            )

        # Create PSSR record
        pssr = PSSR(
            pssr_number=pssr_number,
            moc_number=request.details.moc_number if request.details.is_moc else None,
            moc_description=request.details.moc_description if request.details.is_moc else None,
            is_moc=request.details.is_moc,
            area=request.details.area or initiator.department,
            sub_area=request.details.sub_area,
            description=request.details.description,
            status=PSSRStatus.DRAFT.value,
            created_by_id=initiator.id,
        )
        db.add(pssr)
        db.flush()

        # Add team members
        for member_req in request.members:
            user = db.query(User).filter(User.id == member_req.user_id).first()
            if not user:
                raise ResourceNotFoundError("User", member_req.user_id)

            member = PSSRMember(
                pssr_id=pssr.id,
                user_id=user.id,
                department=member_req.department,
                designation=member_req.designation,
                status="ASSIGNED",
                added_by_id=initiator.id,
            )
            db.add(member)

        # Add annexures
        for annexure_req in request.annexures:
            annexure = PSSRAnnoture(
                pssr_id=pssr.id,
                annexure_code=annexure_req.annexure_code,
                annexure_name=annexure_req.annexure_name,
                annexure_category=annexure_req.annexure_category,
                added_by_id=initiator.id,
            )
            db.add(annexure)

        db.commit()
        db.refresh(pssr)

        # Log creation
        PSSRService._log_history(
            db,
            pssr,
            "CREATED",
            initiator,
            new_status=PSSRStatus.DRAFT.value,
            details=f"PSSR created: {pssr_number}",
        )
        db.commit()

        logger.info(
            f"request_id={getattr(initiator, 'id', '-')} PSSR created: {pssr_number} by {initiator.full_name}"
        )

        return PSSRService.get_pssr_detail(db, pssr.id)

    @staticmethod
    def get_pssr_detail(db: Session, pssr_id: int) -> PSSRResponse:
        """Fetch complete PSSR with all relationships."""

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        return PSSRResponse.model_validate(pssr)

    @staticmethod
    def update_pssr(
        db: Session,
        pssr_id: int,
        request: UpdatePSSRRequest,
        current_user: User,
    ) -> PSSRResponse:
        """
        Update PSSR details (draft only).

        Restrictions:
        - Only DRAFT PSSRs can be edited
        - Only creator or Area Owner can edit
        """

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        if pssr.status != PSSRStatus.DRAFT.value:
            raise ConflictError("Only DRAFT PSSRs can be edited.")

        if pssr.created_by_id != current_user.id and current_user.role != "AREA_OWNER":
            raise ValidationError("Insufficient permission to edit this PSSR.")

        # Update details
        if request.details:
            pssr.moc_number = (
                request.details.moc_number if request.details.is_moc else None
            )
            pssr.moc_description = (
                request.details.moc_description if request.details.is_moc else None
            )
            pssr.is_moc = request.details.is_moc
            pssr.area = request.details.area
            pssr.sub_area = request.details.sub_area
            pssr.description = request.details.description
            pssr.updated_at = datetime.now(timezone.utc)

        # Replace members if provided
        if request.members is not None:
            db.query(PSSRMember).filter(PSSRMember.pssr_id == pssr.id).delete()
            for member_req in request.members:
                user = db.query(User).filter(User.id == member_req.user_id).first()
                if not user:
                    raise ResourceNotFoundError("User", member_req.user_id)
                member = PSSRMember(
                    pssr_id=pssr.id,
                    user_id=user.id,
                    department=member_req.department,
                    designation=member_req.designation,
                    status="ASSIGNED",
                    added_by_id=current_user.id,
                )
                db.add(member)

        # Replace annexures if provided
        if request.annexures is not None:
            db.query(PSSRAnnoture).filter(
                and_(
                    PSSRAnnoture.pssr_id == pssr.id,
                    PSSRAnnoture.is_soft_deleted.is_(False),
                )
            ).update(
                {
                    PSSRAnnoture.is_soft_deleted: True,
                    PSSRAnnoture.deleted_at: datetime.now(timezone.utc),
                    PSSRAnnoture.deleted_by_id: current_user.id,
                }
            )
            for annexure_req in request.annexures:
                annexure = PSSRAnnoture(
                    pssr_id=pssr.id,
                    annexure_code=annexure_req.annexure_code,
                    annexure_name=annexure_req.annexure_name,
                    annexure_category=annexure_req.annexure_category,
                    added_by_id=current_user.id,
                )
                db.add(annexure)

        db.commit()
        db.refresh(pssr)

        PSSRService._log_history(
            db,
            pssr,
            "UPDATED",
            current_user,
            details="PSSR details updated",
        )
        db.commit()

        return PSSRService.get_pssr_detail(db, pssr.id)

    @staticmethod
    def add_member(
        db: Session,
        pssr_id: int,
        request: AddPSSRMemberRequest,
        current_user: User,
    ) -> PSSRMemberResponse:
        """Add a member to PSSR (editable after submission by initiator/area owner)."""

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            raise ResourceNotFoundError("User", request.user_id)

        # Check duplicate
        duplicate = (
            db.query(PSSRMember)
            .filter(
                and_(
                    PSSRMember.pssr_id == pssr.id,
                    PSSRMember.user_id == request.user_id,
                )
            )
            .first()
        )
        if duplicate:
            raise ConflictError("Member already added to this PSSR.")

        member = PSSRMember(
            pssr_id=pssr.id,
            user_id=user.id,
            department=request.department,
            designation=request.designation,
            status="ASSIGNED",
            added_by_id=current_user.id,
        )
        db.add(member)
        db.commit()
        db.refresh(member)

        PSSRService._log_history(
            db,
            pssr,
            "MEMBER_ADDED",
            current_user,
            details=f"Member added: {user.full_name}",
        )
        db.commit()

        return PSSRMemberResponse.model_validate(member)

    @staticmethod
    def remove_member(
        db: Session,
        pssr_id: int,
        request: RemovePSSRMemberRequest,
        current_user: User,
    ) -> None:
        """Remove a member from PSSR."""

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        member = (
            db.query(PSSRMember)
            .filter(
                and_(
                    PSSRMember.id == request.member_id,
                    PSSRMember.pssr_id == pssr.id,
                )
            )
            .first()
        )
        if not member:
            raise ResourceNotFoundError("PSSR Member", request.member_id)

        user_name = member.user.full_name
        db.delete(member)
        db.commit()

        PSSRService._log_history(
            db,
            pssr,
            "MEMBER_REMOVED",
            current_user,
            details=f"Member removed: {user_name}",
        )
        db.commit()

    @staticmethod
    def add_annexure(
        db: Session,
        pssr_id: int,
        request: AddPSSRAnnotureRequest,
        current_user: User,
    ) -> PSSRAnnotureResponse:
        """Add an annexure to PSSR."""

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        # Check duplicate (not soft-deleted)
        duplicate = (
            db.query(PSSRAnnoture)
            .filter(
                and_(
                    PSSRAnnoture.pssr_id == pssr.id,
                    PSSRAnnoture.annexure_code == request.annexure_code,
                    PSSRAnnoture.is_soft_deleted.is_(False),
                )
            )
            .first()
        )
        if duplicate:
            raise ConflictError("Annexure already added to this PSSR.")

        annexure = PSSRAnnoture(
            pssr_id=pssr.id,
            annexure_code=request.annexure_code,
            annexure_name=request.annexure_name,
            annexure_category=request.annexure_category,
            added_by_id=current_user.id,
        )
        db.add(annexure)
        db.commit()
        db.refresh(annexure)

        PSSRService._log_history(
            db,
            pssr,
            "ANNEXURE_ADDED",
            current_user,
            details=f"Annexure added: {request.annexure_name}",
        )
        db.commit()

        return PSSRAnnotureResponse.model_validate(annexure)

    @staticmethod
    def remove_annexure(
        db: Session,
        pssr_id: int,
        request: RemovePSSRAnnotureRequest,
        current_user: User,
    ) -> None:
        """Soft-delete an annexure from PSSR."""

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        annexure = (
            db.query(PSSRAnnoture)
            .filter(
                and_(
                    PSSRAnnoture.id == request.annexure_id,
                    PSSRAnnoture.pssr_id == pssr.id,
                    PSSRAnnoture.is_soft_deleted.is_(False),
                )
            )
            .first()
        )
        if not annexure:
            raise ResourceNotFoundError("PSSR Annexure", request.annexure_id)

        annexure_name = annexure.annexure_name
        annexure.is_soft_deleted = True
        annexure.deleted_at = datetime.now(timezone.utc)
        annexure.deleted_by_id = current_user.id
        db.commit()

        PSSRService._log_history(
            db,
            pssr,
            "ANNEXURE_REMOVED",
            current_user,
            details=f"Annexure soft-deleted: {annexure_name}",
        )
        db.commit()

    @staticmethod
    def save_draft(
        db: Session,
        pssr_id: int,
        current_user: User,
    ) -> PSSRResponse:
        """Save PSSR as draft (no state change)."""

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        if pssr.status != PSSRStatus.DRAFT.value:
            raise ConflictError("Only DRAFT PSSRs can be saved as draft.")

        pssr.updated_at = datetime.now(timezone.utc)
        db.commit()

        PSSRService._log_history(
            db,
            pssr,
            "DRAFT_SAVED",
            current_user,
            details="PSSR saved as draft",
        )
        db.commit()

        logger.info(f"PSSR {pssr.pssr_number} saved as draft by {current_user.full_name}")

        return PSSRService.get_pssr_detail(db, pssr.id)

    @staticmethod
    def submit_pssr(
        db: Session,
        pssr_id: int,
        current_user: User,
    ) -> PSSRResponse:
        """
        Submit PSSR (DRAFT → TEAM_REVIEW).

        Business rules:
        - Must be in DRAFT state
        - Must have at least one member
        - Locks details and initiator-only changes apply thereafter
        """

        pssr = db.query(PSSR).filter(PSSR.id == pssr_id).first()
        if not pssr:
            raise ResourceNotFoundError("PSSR", pssr_id)

        if pssr.status != PSSRStatus.DRAFT.value:
            raise ConflictError("Only DRAFT PSSRs can be submitted.")

        members_count = (
            db.query(func.count(PSSRMember.id))
            .filter(PSSRMember.pssr_id == pssr.id)
            .scalar()
        )
        if members_count == 0:
            raise ValidationError("PSSR must have at least one team member before submission.")

        previous_status = pssr.status
        pssr.status = PSSRStatus.TEAM_REVIEW.value
        pssr.submitted_at = datetime.now(timezone.utc)
        db.commit()

        PSSRService._log_history(
            db,
            pssr,
            "SUBMITTED",
            current_user,
            previous_status=previous_status,
            new_status=PSSRStatus.TEAM_REVIEW.value,
            details=f"PSSR submitted for team review",
        )
        db.commit()

        logger.info(
            f"PSSR {pssr.pssr_number} submitted by {current_user.full_name}. Status: {previous_status} → {pssr.status}"
        )

        return PSSRService.get_pssr_detail(db, pssr.id)

    @staticmethod
    def list_pssr_by_initiator(
        db: Session,
        initiator: User,
        status_filter: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PSSRListItemResponse], int]:
        """List PSSRs created by initiator."""

        query = db.query(PSSR).filter(PSSR.created_by_id == initiator.id)

        if status_filter:
            query = query.filter(PSSR.status == status_filter)

        total = query.count()
        pssrs = (
            query.order_by(PSSR.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        items = []
        for pssr in pssrs:
            member_count = db.query(func.count(PSSRMember.id)).filter(
                PSSRMember.pssr_id == pssr.id
            ).scalar()
            annexure_count = db.query(func.count(PSSRAnnoture.id)).filter(
                and_(
                    PSSRAnnoture.pssr_id == pssr.id,
                    PSSRAnnoture.is_soft_deleted.is_(False),
                )
            ).scalar()

            item = PSSRListItemResponse(
                id=pssr.id,
                pssr_number=pssr.pssr_number,
                moc_number=pssr.moc_number,
                area=pssr.area,
                status=pssr.status,
                created_at=pssr.created_at,
                submitted_at=pssr.submitted_at,
                member_count=member_count,
                annexure_count=annexure_count,
            )
            items.append(item)

        return items, total
