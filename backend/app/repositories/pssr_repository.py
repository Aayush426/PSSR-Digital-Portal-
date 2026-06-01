"""Repository layer for PSSR workflow record queries."""

from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.pssr_task import PSSRTask
from app.models.pssr_workflow import PSSRTeamMemberAssignment, PSSRWorkflow
from app.models.user import User, UserRole


class PSSRTaskRepository:
    """Encapsulates PSSR record lookup for workflow screens."""

    @staticmethod
    def get_by_id(db: Session, pssr_id: int) -> Optional[PSSRTask]:
        return db.query(PSSRTask).filter(PSSRTask.id == pssr_id).first()

    @staticmethod
    def apply_visibility_scope(query, current_user: User):
        """
        Restrict workflow visibility to the user's permanent role and scope.

        INITIATE_PSSR is deliberately absent from this policy because that
        capability allows creation only. Visibility comes from ownership,
        assignment, area ownership, or department involvement.
        """

        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if role == UserRole.ADMIN.value:
            return query

        visibility = [
            PSSRTask.assigned_to_user_id == current_user.id,
            PSSRTask.created_by_user_id == current_user.id,
        ]

        if role == UserRole.AREA_OWNER.value:
            visibility.append(PSSRTask.area_owner_user_id == current_user.id)

        return query.filter(or_(*visibility))

    @staticmethod
    def can_view_record(db: Session, current_user: User, record_id: int) -> bool:
        query = PSSRTaskRepository.apply_visibility_scope(db.query(PSSRTask.id), current_user)
        return query.filter(PSSRTask.id == record_id).first() is not None

    @staticmethod
    def can_view_pssr(db: Session, current_user: User, pssr_id: str) -> bool:
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        workflow = db.query(PSSRWorkflow).filter(PSSRWorkflow.pssr_id == pssr_id).first()
        if workflow:
            if role == UserRole.ADMIN.value:
                return True
            if current_user.id in {workflow.initiator_user_id, workflow.team_leader_user_id, workflow.area_owner_user_id}:
                return True
            return db.query(PSSRTeamMemberAssignment.id).filter(
                PSSRTeamMemberAssignment.pssr_id == pssr_id,
                PSSRTeamMemberAssignment.user_id == current_user.id,
            ).first() is not None
        query = PSSRTaskRepository.apply_visibility_scope(db.query(PSSRTask.id), current_user)
        return query.filter(PSSRTask.pssr_id == pssr_id).first() is not None

    @staticmethod
    def list_records(
        db: Session,
        *,
        current_user: Optional[User] = None,
        search: Optional[str] = None,
        department: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[PSSRTask], int]:
        query = db.query(PSSRTask)
        if current_user is not None:
            query = PSSRTaskRepository.apply_visibility_scope(query, current_user)
        if department:
            query = query.filter(PSSRTask.department == department)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    PSSRTask.pssr_id.ilike(pattern),
                    PSSRTask.pssr_title.ilike(pattern),
                    PSSRTask.unit.ilike(pattern),
                )
            )

        total = query.count()
        records = (
            query.order_by(PSSRTask.updated_at.desc(), PSSRTask.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return records, total
