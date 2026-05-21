"""TEAM_MEMBER dashboard composition service."""

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.models.pssr import PSSRActivityLog
from app.models.pssr_task import PSSRTask
from app.models.user import User, UserRole
from app.schemas.team import (
    TeamDashboardActivity,
    TeamDashboardResponse,
    TeamDashboardStats,
    TeamDashboardTask,
)


class TeamService:
    """Build backend-owned TEAM_MEMBER dashboard payloads."""

    @staticmethod
    def get_dashboard(db: Session, current_user: User) -> TeamDashboardResponse:
        """Return assigned PSSR work for the authenticated team member."""

        try:
            return TeamService._get_dashboard(db, current_user)
        except ProgrammingError as exc:
            db.rollback()
            if "UndefinedTable" in str(exc) or "does not exist" in str(exc):
                return TeamService._empty_dashboard()
            raise

    @staticmethod
    def _get_dashboard(db: Session, current_user: User) -> TeamDashboardResponse:
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        task_query = db.query(PSSRTask)
        activity_query = db.query(PSSRActivityLog)

        if role != UserRole.ADMIN.value:
            task_query = task_query.filter(PSSRTask.assigned_to_user_id == current_user.id)
            activity_query = activity_query.filter(PSSRActivityLog.user_id == current_user.id)

        todo = [
            TeamService._task_to_schema(task)
            for task in task_query.filter(PSSRTask.status == "Not Started")
            .order_by(PSSRTask.due_date.asc(), PSSRTask.priority.desc())
            .limit(25)
            .all()
        ]
        in_progress = [
            TeamService._task_to_schema(task)
            for task in task_query.filter(PSSRTask.status == "In Progress")
            .order_by(PSSRTask.updated_at.desc())
            .limit(25)
            .all()
        ]
        completed = [
            TeamService._task_to_schema(task)
            for task in task_query.filter(PSSRTask.status.in_(["Completed", "Pending Review"]))
            .order_by(PSSRTask.updated_at.desc())
            .limit(25)
            .all()
        ]
        activity = [
            TeamDashboardActivity(
                id=str(item.id),
                timestamp=item.timestamp,
                action=item.action,
                pssr_id=item.pssr_id,
                detail=item.detail,
            )
            for item in activity_query.order_by(PSSRActivityLog.created_at.desc()).limit(12).all()
        ]

        return TeamDashboardResponse(
            todo=todo,
            in_progress=in_progress,
            completed=completed,
            activity=activity,
            stats=TeamDashboardStats(
                todo_count=len(todo),
                in_progress_count=len(in_progress),
                completed_count=len(completed),
                pending_review_count=sum(1 for task in completed if task.status == "Pending Review"),
            ),
        )

    @staticmethod
    def _task_to_schema(task: PSSRTask) -> TeamDashboardTask:
        return TeamDashboardTask(
            id=task.pssr_id,
            pssr_title=task.pssr_title,
            unit=task.unit,
            priority=task.priority,
            due_date=task.due_date.date().isoformat() if task.due_date else None,
            questions_answered=task.questions_answered,
            total_questions=task.total_questions,
            progress=task.progress,
            last_updated=task.updated_at.isoformat() if task.updated_at else None,
            submitted_date=task.submitted_date.date().isoformat() if task.submitted_date else None,
            reviewer_name=task.reviewer_name,
            status=task.status,
        )

    @staticmethod
    def _empty_dashboard() -> TeamDashboardResponse:
        return TeamDashboardResponse(
            todo=[],
            in_progress=[],
            completed=[],
            activity=[],
            stats=TeamDashboardStats(
                todo_count=0,
                in_progress_count=0,
                completed_count=0,
                pending_review_count=0,
            ),
        )
