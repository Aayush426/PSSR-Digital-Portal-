"""Repository helpers for user capability grants."""

from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.permissions import PermissionCode, UserPermission
from app.models.annexures import AnnexurePunchPoint
from app.models.pssr_workflow import PSSRTeamMemberAssignment, PSSRWorkflow
from app.services.pssr_workflow_service import APPROVED, COMPLETED_BY_TEAM, IN_PROGRESS, PENDING_APPROVAL, TODO, UNDER_PREPARATION, equivalent_states


class UserPermissionRepository:
    """Data access for active and historical RBAC capabilities."""

    @staticmethod
    def active_grant(
        db: Session,
        user_id: int,
        permission: PermissionCode | str,
    ) -> Optional[UserPermission]:
        code = permission.value if hasattr(permission, "value") else str(permission)
        return (
            db.query(UserPermission)
            .filter(
                UserPermission.user_id == user_id,
                UserPermission.permission == code,
                UserPermission.active.is_(True),
            )
            .first()
        )

    @staticmethod
    def has_permission(db: Session, user_id: int, permission: PermissionCode | str) -> bool:
        return UserPermissionRepository.active_grant(db, user_id, permission) is not None

    @staticmethod
    def active_user_ids(
        db: Session,
        user_ids: list[int],
        permission: PermissionCode | str,
    ) -> set[int]:
        if not user_ids:
            return set()
        code = permission.value if hasattr(permission, "value") else str(permission)
        rows = (
            db.query(UserPermission.user_id)
            .filter(
                UserPermission.user_id.in_(user_ids),
                UserPermission.permission == code,
                UserPermission.active.is_(True),
            )
            .group_by(UserPermission.user_id)
            .all()
        )
        return {row.user_id for row in rows}

    @staticmethod
    def stats_for_user(db: Session, user_id: int) -> dict:
        active_permissions = (
            db.query(func.count(UserPermission.id))
            .filter(UserPermission.user_id == user_id, UserPermission.active.is_(True))
            .scalar()
            or 0
        )
        created = db.query(PSSRWorkflow).filter(PSSRWorkflow.initiator_user_id == user_id)
        assigned_pssr_ids = db.query(PSSRTeamMemberAssignment.pssr_id).filter(PSSRTeamMemberAssignment.user_id == user_id)
        my_pssr_filter = or_(
            PSSRWorkflow.initiator_user_id == user_id,
            PSSRWorkflow.team_leader_user_id == user_id,
            PSSRWorkflow.pssr_id.in_(assigned_pssr_ids),
        )
        open_punch_points = (
            db.query(func.count(AnnexurePunchPoint.id))
            .filter(
                AnnexurePunchPoint.pssr_id.in_(db.query(PSSRWorkflow.pssr_id).filter(my_pssr_filter)),
                AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
            )
            .scalar()
            or 0
        )
        return {
            "active_capabilities": active_permissions,
            "under_preparation": created.filter(PSSRWorkflow.workflow_state.in_(equivalent_states(UNDER_PREPARATION))).count(),
            "draft_pssr": created.filter(PSSRWorkflow.workflow_state.in_(equivalent_states(UNDER_PREPARATION))).count(),
            "todo": db.query(PSSRWorkflow).filter(my_pssr_filter, PSSRWorkflow.workflow_state.in_(equivalent_states(TODO))).count(),
            "in_progress": db.query(PSSRWorkflow).filter(my_pssr_filter, PSSRWorkflow.workflow_state.in_(equivalent_states(IN_PROGRESS))).count(),
            "completed_by_team": db.query(PSSRWorkflow).filter(my_pssr_filter, PSSRWorkflow.workflow_state.in_(equivalent_states(COMPLETED_BY_TEAM))).count(),
            "pending_area_owner_approval": db.query(PSSRWorkflow).filter(my_pssr_filter, PSSRWorkflow.workflow_state.in_(equivalent_states(PENDING_APPROVAL))).count(),
            "approved": db.query(PSSRWorkflow).filter(my_pssr_filter, PSSRWorkflow.workflow_state.in_(equivalent_states(APPROVED))).count(),
            "open_punch_points": open_punch_points,
            "my_pssr": db.query(PSSRWorkflow).filter(my_pssr_filter).count(),
        }
