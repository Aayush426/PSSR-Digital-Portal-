"""AREA_OWNER dashboard composition service."""

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.models.pssr import PSSRActivityLog, PSSRMocReview
from app.models.pssr_task import PSSRTask
from app.models.pssr_workflow import PSSRWorkflow
from app.models.user import User
from app.schemas.area_owner import (
    AreaOwnerApprovedRecord,
    AreaOwnerDashboardResponse,
    AreaOwnerDashboardStats,
    AreaOwnerDecisionLog,
    AreaOwnerMocRecord,
    AreaOwnerPendingRecord,
)
from app.services.pssr_workflow_service import APPROVED, PENDING_APPROVAL, equivalent_states


class AreaOwnerService:
    """Build backend-owned AREA_OWNER dashboard payloads."""

    @staticmethod
    def get_dashboard(db: Session, current_user: User) -> AreaOwnerDashboardResponse:
        """Return area-scoped PSSR approval records for the authenticated owner."""

        try:
            return AreaOwnerService._get_dashboard(db, current_user)
        except ProgrammingError as exc:
            db.rollback()
            if "UndefinedTable" in str(exc) or "does not exist" in str(exc):
                return AreaOwnerService._empty_dashboard()
            raise

    @staticmethod
    def _get_dashboard(db: Session, current_user: User) -> AreaOwnerDashboardResponse:
        pending_tasks = (
            db.query(PSSRTask)
            .filter(
                PSSRTask.area_owner_user_id == current_user.id,
                PSSRTask.status == "Pending Review",
            )
            .order_by(PSSRTask.updated_at.desc())
            .limit(25)
            .all()
        )
        pending_workflows = (
            db.query(PSSRWorkflow)
            .filter(
                PSSRWorkflow.area_owner_user_id == current_user.id,
                PSSRWorkflow.workflow_state.in_(equivalent_states(PENDING_APPROVAL)),
            )
            .order_by(PSSRWorkflow.updated_at.desc())
            .limit(25)
            .all()
        )
        approved_tasks = (
            db.query(PSSRTask)
            .filter(
                PSSRTask.area_owner_user_id == current_user.id,
                PSSRTask.status == "Completed",
            )
            .order_by(PSSRTask.updated_at.desc())
            .limit(25)
            .all()
        )
        approved_workflows = (
            db.query(PSSRWorkflow)
            .filter(
                PSSRWorkflow.area_owner_user_id == current_user.id,
                PSSRWorkflow.workflow_state.in_(equivalent_states(APPROVED)),
            )
            .order_by(PSSRWorkflow.updated_at.desc())
            .limit(25)
            .all()
        )
        moc_reviews = (
            db.query(PSSRMocReview)
            .filter(
                PSSRMocReview.area_owner_user_id == current_user.id,
                PSSRMocReview.status == "Pending",
            )
            .order_by(PSSRMocReview.created_at.desc())
            .limit(25)
            .all()
        )
        decision_rows = (
            db.query(PSSRActivityLog)
            .filter(PSSRActivityLog.area_owner_user_id == current_user.id)
            .order_by(PSSRActivityLog.created_at.desc())
            .limit(12)
            .all()
        )
        submitter_ids = {task.assigned_to_user_id for task in pending_tasks}
        submitters = {
            user.id: user.full_name
            for user in db.query(User.id, User.full_name).filter(User.id.in_(submitter_ids)).all()
        } if submitter_ids else {}

        pending_records = [
            AreaOwnerPendingRecord(
                id=workflow.pssr_id,
                pssr_id=workflow.pssr_id,
                submitted_by="PSSR Initiator",
                unit=workflow.plant_unit,
                department="Multi Department",
                submitted_at=workflow.submitted_at.date().isoformat() if workflow.submitted_at else None,
            )
            for workflow in pending_workflows
        ] + [
            AreaOwnerPendingRecord(
                id=str(task.id),
                pssr_id=task.pssr_id,
                submitted_by=submitters.get(task.assigned_to_user_id, "Assigned Team Member"),
                unit=task.unit,
                department=task.department,
                submitted_at=task.submitted_date.date().isoformat() if task.submitted_date else None,
            )
            for task in pending_tasks
        ]
        approved_records = [
            AreaOwnerApprovedRecord(
                id=workflow.pssr_id,
                pssr_id=workflow.pssr_id,
                approved_by=current_user.full_name,
                unit=workflow.plant_unit,
                approved_at=workflow.approved_at.date().isoformat() if workflow.approved_at else None,
            )
            for workflow in approved_workflows
        ] + [
            AreaOwnerApprovedRecord(
                id=str(task.id),
                pssr_id=task.pssr_id,
                approved_by=task.reviewer_name or current_user.full_name,
                unit=task.unit,
                approved_at=task.submitted_date.date().isoformat() if task.submitted_date else None,
            )
            for task in approved_tasks
        ]
        moc_pending_records = [
            AreaOwnerMocRecord(
                id=str(item.id),
                moc_id=item.moc_id,
                due_date=item.due_date,
            )
            for item in moc_reviews
        ]
        decision_logs = [
            AreaOwnerDecisionLog(
                id=str(item.id),
                timestamp=item.timestamp,
                action=item.action,
                detail=item.detail,
            )
            for item in decision_rows
        ]
        total_decisions = len(pending_records) + len(approved_records)
        approval_rate = (
            round((len(approved_records) / total_decisions) * 100)
            if total_decisions
            else 0
        )

        return AreaOwnerDashboardResponse(
            pending_records=pending_records,
            approved_records=approved_records,
            moc_pending_records=moc_pending_records,
            decision_logs=decision_logs,
            stats=AreaOwnerDashboardStats(
                pending_count=len(pending_records),
                approved_count=len(approved_records),
                moc_pending_count=len(moc_pending_records),
                approval_rate=approval_rate,
            ),
        )

    @staticmethod
    def _empty_dashboard() -> AreaOwnerDashboardResponse:
        return AreaOwnerDashboardResponse(
            pending_records=[],
            approved_records=[],
            moc_pending_records=[],
            decision_logs=[],
            stats=AreaOwnerDashboardStats(
                pending_count=0,
                approved_count=0,
                moc_pending_count=0,
                approval_rate=0,
            ),
        )
