"""TEAM_MEMBER dashboard composition service."""

from sqlalchemy import or_
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.annexures import Annexure, AnnexurePunchPoint
from app.models.pssr import PSSRActivityLog
from app.models.pssr_task import PSSRTask
from app.models.pssr_workflow import PSSRQuestion, PSSRQuestionResponse, PSSRTeamMemberAssignment, PSSRWorkflow
from app.models.user import User, UserRole
from app.models.permissions import PermissionCode
from app.repositories.permission_repository import UserPermissionRepository
from app.services.pssr_workflow_service import (
    APPROVED,
    CLOSED,
    COMPLETED_BY_TEAM,
    IN_PROGRESS,
    PENDING_APPROVAL,
    TODO,
    UNDER_PREPARATION,
    PSSRWorkflowService,
    equivalent_states,
    normalize_state,
)
from app.repositories.pssr_repository import PSSRTaskRepository
from app.schemas.team import (
    TeamDashboardActivity,
    TeamDashboardResponse,
    TeamDashboardStats,
    TeamDashboardTask,
)

logger = get_logger(__name__)


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
        is_initiator = UserPermissionRepository.has_permission(
            db,
            current_user.id,
            PermissionCode.INITIATE_PSSR,
        )
        live_tasks = TeamService._live_assignment_tasks(db, current_user)
        assigned_punch_points = TeamService._assigned_punch_point_tasks(db, current_user)
        initiator_tasks = TeamService._initiator_workflow_tasks(db, current_user) if is_initiator else []
        task_query = db.query(PSSRTask)
        activity_query = db.query(PSSRActivityLog)

        if role != UserRole.ADMIN.value:
            task_query = PSSRTaskRepository.apply_visibility_scope(task_query, current_user)
            activity_query = activity_query.filter(PSSRActivityLog.user_id == current_user.id)

        under_preparation = [task for task in initiator_tasks if task.status == "Under Preparation"]
        assigned_todo = [task for task in live_tasks if task.status == "To Do"] + [
            TeamService._task_to_schema(task)
            for task in task_query.filter(PSSRTask.status == "Not Started")
            .order_by(PSSRTask.due_date.asc())
            .limit(25)
            .all()
        ]
        assigned_in_progress = [task for task in live_tasks if task.status == "In Progress"] + [
            TeamService._task_to_schema(task)
            for task in task_query.filter(PSSRTask.status == "In Progress")
            .order_by(PSSRTask.updated_at.desc())
            .limit(25)
            .all()
        ]
        assigned_completed = [task for task in live_tasks if task.status == "Completed"] + [
            TeamService._task_to_schema(task)
            for task in task_query.filter(PSSRTask.status == "Completed")
            .order_by(PSSRTask.updated_at.desc())
            .limit(25)
            .all()
        ]
        todo = assigned_todo + [task for task in initiator_tasks if task.status == "To Do"]
        in_progress = assigned_in_progress + [task for task in initiator_tasks if task.status == "In Progress"]
        completed = assigned_completed + [task for task in initiator_tasks if task.workflow_state == COMPLETED_BY_TEAM]
        pending_review = [task for task in initiator_tasks if task.workflow_state == PENDING_APPROVAL]
        approved = [task for task in initiator_tasks if task.workflow_state in {APPROVED, CLOSED, "REJECTED"}]
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
        initiator_stats = UserPermissionRepository.stats_for_user(db, current_user.id)

        under_preparation = TeamService._dedupe_tasks(under_preparation)
        todo = TeamService._dedupe_tasks(todo)
        in_progress = TeamService._dedupe_tasks(in_progress)
        completed = TeamService._dedupe_tasks(completed)
        pending_review = TeamService._dedupe_tasks(pending_review)
        approved = TeamService._dedupe_tasks(approved)

        return TeamDashboardResponse(
            draft=under_preparation,
            assigned=todo,
            todo=todo,
            in_progress=in_progress,
            completed=completed,
            pending_review=pending_review,
            approved=approved,
            assigned_punch_points=assigned_punch_points,
            activity=activity,
            stats=TeamDashboardStats(
                draft_count=len(under_preparation),
                assigned_count=len(assigned_todo),
                todo_count=len(assigned_todo),
                in_progress_count=len(assigned_in_progress),
                completed_count=len(assigned_completed),
                pending_review_count=len(pending_review),
            ),
            is_pssr_initiator=is_initiator,
            initiator_stats=initiator_stats,
        )

    @staticmethod
    def _dedupe_tasks(tasks: list[TeamDashboardTask]) -> list[TeamDashboardTask]:
        seen = set()
        deduped = []
        for task in tasks:
            key = task.id
            if key in seen:
                continue
            seen.add(key)
            deduped.append(task)
        return deduped

    @staticmethod
    def _initiator_workflow_tasks(db: Session, current_user: User) -> list[TeamDashboardTask]:
        workflows = db.query(PSSRWorkflow).filter(
            PSSRWorkflow.initiator_user_id == current_user.id,
        ).order_by(PSSRWorkflow.updated_at.desc()).limit(50).all()
        area_owner_ids = [workflow.area_owner_user_id for workflow in workflows if workflow.area_owner_user_id]
        area_owners = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(area_owner_ids)).all()
        } if area_owner_ids else {}
        tasks = []
        for workflow in workflows:
            total = db.query(PSSRQuestion.id).filter(PSSRQuestion.pssr_id == workflow.pssr_id).count()
            answered = db.query(PSSRQuestionResponse.id).join(
                PSSRQuestion,
                PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
            ).filter(
                PSSRQuestion.pssr_id == workflow.pssr_id,
                PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
            ).count()
            state = normalize_state(workflow.workflow_state)
            if state == UNDER_PREPARATION:
                status = "Under Preparation"
                department = "Initiator Monitor"
            elif state == TODO:
                status = "To Do"
                department = "Execution Queue"
            elif state == PENDING_APPROVAL:
                status = "Completed"
                department = "Area Owner Approval"
            elif state in {COMPLETED_BY_TEAM, APPROVED, CLOSED}:
                status = "Completed"
                department = "Workflow Monitor"
            else:
                status = "In Progress"
                department = "Workflow Monitor"
            tasks.append(TeamDashboardTask(
                id=workflow.pssr_id,
                pssr_title=workflow.title,
                unit=workflow.plant_unit,
                department=department,
                due_date=workflow.due_date.date().isoformat() if workflow.due_date else None,
                questions_answered=answered,
                total_questions=total,
                progress=round(answered * 100 / total) if total else 0,
                last_updated=workflow.updated_at.isoformat() if workflow.updated_at else None,
                submitted_date=workflow.submitted_at.date().isoformat() if workflow.submitted_at else None,
                reviewer_name=None,
                area_owner=PSSRWorkflowService._user_brief(area_owners.get(workflow.area_owner_user_id)),
                status=status,
                workflow_state=state,
                ownership="initiator",
                can_start=False,
            ))
        return tasks

    @staticmethod
    def _task_to_schema(task: PSSRTask) -> TeamDashboardTask:
        status = "To Do" if task.status == "Not Started" else task.status
        return TeamDashboardTask(
            id=task.pssr_id,
            pssr_title=task.pssr_title,
            unit=task.unit,
            department=task.department,
            due_date=task.due_date.date().isoformat() if task.due_date else None,
            questions_answered=task.questions_answered,
            total_questions=task.total_questions,
            progress=task.progress,
            last_updated=task.updated_at.isoformat() if task.updated_at else None,
            submitted_date=task.submitted_date.date().isoformat() if task.submitted_date else None,
            reviewer_name=task.reviewer_name,
            status=status,
            workflow_state=status,
            ownership="legacy",
            can_start=False,
        )

    @staticmethod
    def _live_assignment_tasks(db: Session, current_user: User) -> list[TeamDashboardTask]:
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        query = db.query(PSSRTeamMemberAssignment, PSSRWorkflow).join(
            PSSRWorkflow,
            PSSRWorkflow.pssr_id == PSSRTeamMemberAssignment.pssr_id,
        )
        if role != UserRole.ADMIN.value:
            query = query.filter(
                PSSRTeamMemberAssignment.user_id == current_user.id,
                PSSRWorkflow.workflow_state.notin_(equivalent_states(UNDER_PREPARATION)),
            )
        rows = query.order_by(PSSRTeamMemberAssignment.updated_at.desc()).limit(50).all()
        tasks = []
        for assignment, workflow in rows:
            questions = [
                question
                for question in db.query(PSSRQuestion).filter(
                    PSSRQuestion.pssr_id == workflow.pssr_id,
                    PSSRQuestion.assigned_user_id == assignment.user_id,
                ).all()
                if PSSRWorkflowService._department_matches(assignment.department, question.department_owner)
                or PSSRWorkflowService._department_matches(question.department_owner, assignment.department)
            ]
            total = len(questions)
            if total == 0:
                continue
            question_ids = [question.id for question in questions]
            answered = db.query(PSSRQuestionResponse.id).filter(
                PSSRQuestionResponse.pssr_question_id.in_(question_ids),
                PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
            ).count()
            logger_payload = {
                "savedDepartmentAssignments": {
                    "department": assignment.department,
                    "assignedMemberId": assignment.user_id,
                },
                "generatedCheckpointAssignments": [
                    {
                        "checkpoint.department": question.department_owner,
                        "checkpoint.assignedTo": question.assigned_user_id,
                    }
                    for question in questions
                ],
            }
            logger.info("assignmentMappingVisibility=%s", logger_payload)
            state = normalize_state(workflow.workflow_state)
            if state == PENDING_APPROVAL:
                status = "Completed"
            elif assignment.status == "COMPLETED" or state in {COMPLETED_BY_TEAM, APPROVED}:
                status = "Completed"
            elif assignment.started_at or assignment.status == "IN_PROGRESS" or answered:
                status = "In Progress"
            else:
                status = "To Do"
            tasks.append(TeamDashboardTask(
                id=workflow.pssr_id,
                pssr_title=workflow.title,
                unit=workflow.plant_unit,
                department=assignment.department,
                due_date=assignment.due_date.date().isoformat() if assignment.due_date else None,
                questions_answered=answered,
                total_questions=total,
                progress=round(answered * 100 / total) if total else 0,
                last_updated=assignment.updated_at.isoformat() if assignment.updated_at else None,
                submitted_date=workflow.submitted_at.date().isoformat() if workflow.submitted_at else None,
                reviewer_name=None,
                status=status,
                workflow_state=state,
                ownership="admin" if role == UserRole.ADMIN.value else "assigned_member",
                can_start=assignment.status == "PENDING" and role != UserRole.ADMIN.value,
            ))
        leader_rows = []
        if role != UserRole.ADMIN.value:
            leader_rows = db.query(PSSRWorkflow).filter(
                PSSRWorkflow.team_leader_user_id == current_user.id,
                PSSRWorkflow.workflow_state.notin_(equivalent_states(UNDER_PREPARATION)),
            ).order_by(PSSRWorkflow.updated_at.desc()).limit(50).all()
        for workflow in leader_rows:
            if any(task.id == workflow.pssr_id and task.ownership == "assigned_member" for task in tasks):
                continue
            tasks.append(TeamService._workflow_monitor_task(db, workflow, "team_leader", current_user))
        if role == UserRole.ADMIN.value:
            for workflow in db.query(PSSRWorkflow).order_by(PSSRWorkflow.updated_at.desc()).limit(50).all():
                tasks.append(TeamService._workflow_monitor_task(db, workflow, "admin", current_user))
        return TeamService._dedupe_tasks(tasks)

    @staticmethod
    def _assigned_punch_point_tasks(db: Session, current_user: User) -> list[TeamDashboardTask]:
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        query = db.query(AnnexurePunchPoint, PSSRWorkflow).join(
            PSSRWorkflow,
            PSSRWorkflow.pssr_id == AnnexurePunchPoint.pssr_id,
        )
        if role != UserRole.ADMIN.value:
            query = query.filter(AnnexurePunchPoint.assigned_to_user_id == current_user.id)
        rows = query.filter(AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"])).order_by(AnnexurePunchPoint.due_date.asc().nullslast(), AnnexurePunchPoint.updated_at.desc()).limit(50).all()
        actor_ids = {
            user_id
            for punch, _ in rows
            for user_id in [punch.raised_by_user_id, punch.assigned_by_user_id, punch.assigned_to_user_id]
            if user_id
        }
        actors = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(actor_ids)).all()
        } if actor_ids else {}
        tasks = []
        for punch, workflow in rows:
            question = db.query(PSSRQuestion).filter(
                PSSRQuestion.pssr_id == workflow.pssr_id,
                or_(PSSRQuestion.id == punch.question_id, PSSRQuestion.annexure_question_id == punch.question_id),
            ).first() if punch.question_id else None
            response = db.query(PSSRQuestionResponse).filter(PSSRQuestionResponse.pssr_question_id == question.id).first() if question else None
            annexure = db.query(Annexure).filter(Annexure.id == question.annexure_id).first() if question and question.annexure_id else None
            tasks.append(TeamDashboardTask(
                id=workflow.pssr_id,
                pssr_title=workflow.title,
                unit=workflow.plant_unit,
                department=punch.owning_department,
                due_date=punch.due_date.date().isoformat() if punch.due_date else None,
                questions_answered=0,
                total_questions=0,
                progress=0,
                last_updated=punch.updated_at.isoformat() if punch.updated_at else None,
                submitted_date=workflow.submitted_at.date().isoformat() if workflow.submitted_at else None,
                reviewer_name=None,
                status="In Progress" if punch.status == "IN_PROGRESS" else "To Do",
                workflow_state=normalize_state(workflow.workflow_state),
                ownership="punch_point",
                punch_point_id=punch.id,
                punch_point_title=punch.title,
                punch_point_description=punch.description,
                punch_checkpoint_question=question.question_text if question else None,
                punch_original_answer=response.response if response else None,
                punch_original_remarks=response.remarks if response else None,
                punch_annexure_name=annexure.title if annexure else ("Custom checkpoint" if question and question.custom else None),
                punch_question_number=question.sequence if question else None,
                priority=punch.severity,
                raised_by=PSSRWorkflowService._user_brief(actors.get(punch.raised_by_user_id)),
                assigned_by=PSSRWorkflowService._user_brief(actors.get(punch.assigned_by_user_id)),
                assigned_to=PSSRWorkflowService._user_brief(actors.get(punch.assigned_to_user_id)),
                can_start=False,
            ))
        return tasks

    @staticmethod
    def _workflow_monitor_task(db: Session, workflow: PSSRWorkflow, ownership: str, current_user: User) -> TeamDashboardTask:
        total = db.query(PSSRQuestion.id).filter(PSSRQuestion.pssr_id == workflow.pssr_id).count()
        answered = db.query(PSSRQuestionResponse.id).join(
            PSSRQuestion,
            PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
        ).filter(
            PSSRQuestion.pssr_id == workflow.pssr_id,
            PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
        ).count()
        state = normalize_state(workflow.workflow_state)
        status = (
            "Under Preparation" if state == UNDER_PREPARATION
            else "To Do" if state == TODO
            else "Completed" if state in {COMPLETED_BY_TEAM, PENDING_APPROVAL, APPROVED}
            else "In Progress"
        )
        return TeamDashboardTask(
            id=workflow.pssr_id,
            pssr_title=workflow.title,
            unit=workflow.plant_unit,
            department="Workflow Monitor",
            due_date=workflow.due_date.date().isoformat() if workflow.due_date else None,
            questions_answered=answered,
            total_questions=total,
            progress=round(answered * 100 / total) if total else 0,
            last_updated=workflow.updated_at.isoformat() if workflow.updated_at else None,
            submitted_date=workflow.submitted_at.date().isoformat() if workflow.submitted_at else None,
            reviewer_name=None,
            status=status,
            workflow_state=state,
            ownership=ownership,
            can_start=state == TODO and ownership == "team_leader",
        )

    @staticmethod
    def _empty_dashboard() -> TeamDashboardResponse:
        return TeamDashboardResponse(
            todo=[],
            draft=[],
            assigned=[],
            in_progress=[],
            completed=[],
            pending_review=[],
            approved=[],
            assigned_punch_points=[],
            activity=[],
            stats=TeamDashboardStats(
                draft_count=0,
                assigned_count=0,
                todo_count=0,
                in_progress_count=0,
                completed_count=0,
                pending_review_count=0,
            ),
            is_pssr_initiator=False,
            initiator_stats={},
        )
