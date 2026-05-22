"""
PSSR initiator assignment service.

This service protects the rule that initiator access is dynamic assignment
state, not a permanent role. That model scales to future project scopes,
shutdown packages, MOC references, and audit trails.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ResourceNotFoundError, ValidationError
from app.models.assignment import PSSRInitiatorAssignment
from app.models.user import AssignmentStatus, User, UserRole
from app.schemas.auth import (
    AssignInitiatorRequest,
    InitiatorAssignmentResponse,
    RevokeInitiatorRequest,
)


class InitiatorAssignmentService:
    """Business operations for assigning and revoking PSSR initiators."""

    @staticmethod
    def _to_response(assignment: PSSRInitiatorAssignment) -> InitiatorAssignmentResponse:
        """Convert an assignment row into an API-safe response projection."""

        return InitiatorAssignmentResponse(
            id=assignment.id,
            user_id=assignment.user_id,
            user_employee_id=assignment.user.employee_id,
            user_full_name=assignment.user.full_name,
            project_reference=assignment.project_reference,
            status=assignment.status,
            reason=assignment.reason,
            assigned_at=assignment.assigned_at,
            revoked_at=assignment.revoked_at,
        )

    @staticmethod
    def assign_initiator(
        db: Session,
        request: AssignInitiatorRequest,
        current_admin: User,
    ) -> InitiatorAssignmentResponse:
        """Assign an active TEAM_MEMBER as a temporary PSSR initiator."""

        user = db.query(User).filter(User.id == request.user_id).first()
        if not user:
            raise ResourceNotFoundError("User", request.user_id)
        if not user.active or user.role != UserRole.TEAM_MEMBER.value:
            raise ValidationError("Only active TEAM_MEMBER users can be initiators.")

        duplicate = (
            db.query(PSSRInitiatorAssignment)
            .filter(
                PSSRInitiatorAssignment.user_id == user.id,
                PSSRInitiatorAssignment.project_reference == request.project_reference,
                PSSRInitiatorAssignment.status == AssignmentStatus.ACTIVE.value,
            )
            .first()
        )
        if duplicate:
            raise ConflictError("An active initiator assignment already exists.")

        if request.project_reference:
            active_count = (
                db.query(PSSRInitiatorAssignment)
                .filter(
                    PSSRInitiatorAssignment.project_reference == request.project_reference,
                    PSSRInitiatorAssignment.status == AssignmentStatus.ACTIVE.value,
                )
                .count()
            )
            if active_count >= 5:
                raise ValidationError("Maximum active initiators reached for project.")

        assignment = PSSRInitiatorAssignment(
            user_id=user.id,
            assigned_by_id=current_admin.id,
            project_reference=request.project_reference,
            status=AssignmentStatus.ACTIVE.value,
            reason=request.reason,
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return InitiatorAssignmentService._to_response(assignment)

    @staticmethod
    def revoke_initiator(
        db: Session,
        request: RevokeInitiatorRequest,
        current_admin: User,
    ) -> InitiatorAssignmentResponse:
        """Revoke an active assignment while retaining the audit record."""

        assignment = (
            db.query(PSSRInitiatorAssignment)
            .filter(PSSRInitiatorAssignment.id == request.assignment_id)
            .first()
        )
        if not assignment:
            raise ResourceNotFoundError(
                "PSSR initiator assignment", request.assignment_id
            )
        if assignment.status != AssignmentStatus.ACTIVE.value:
            raise ConflictError("Only active assignments can be revoked.")

        assignment.status = AssignmentStatus.REVOKED.value
        assignment.revoked_by_id = current_admin.id
        assignment.revoked_at = datetime.now(timezone.utc)
        if request.reason:
            assignment.reason = request.reason
        db.commit()
        db.refresh(assignment)
        return InitiatorAssignmentService._to_response(assignment)

    @staticmethod
    def hard_delete_assignment(db: Session, assignment_id: int) -> int:
        """Hard delete an initiator assignment row while keeping the User row.

        This removes the record from `pssr_initiator_assignments` completely.
        """

        assignment = (
            db.query(PSSRInitiatorAssignment)
            .filter(PSSRInitiatorAssignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise ResourceNotFoundError("PSSR initiator assignment", assignment_id)

        db.delete(assignment)
        db.commit()
        return assignment_id

    @staticmethod
    def list_assignments(
        db: Session,
        status_filter: Optional[AssignmentStatus] = None,
        user_id: Optional[int] = None,
        project_reference: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[InitiatorAssignmentResponse], int]:
        """Return paginated assignment records for the admin console."""

        query = db.query(PSSRInitiatorAssignment)
        if status_filter:
            query = query.filter(PSSRInitiatorAssignment.status == status_filter.value)
        if user_id:
            query = query.filter(PSSRInitiatorAssignment.user_id == user_id)
        if project_reference:
            query = query.filter(
                PSSRInitiatorAssignment.project_reference == project_reference
            )

        total = query.count()
        assignments = (
            query.order_by(PSSRInitiatorAssignment.assigned_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return [
            InitiatorAssignmentService._to_response(assignment)
            for assignment in assignments
        ], total

