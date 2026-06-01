"""Business service for initiated PSSR workflows."""
from datetime import datetime
from typing import Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError, ResourceNotFoundError, ValidationError
from app.models.annexures import Annexure, AnnexurePunchPoint, AnnexureQuestion
from app.models.pssr import PSSRActivityLog
from app.models.pssr_workflow import (
    PSSRAnnexureSelection,
    PSSRAuditLog,
    PSSRNotification,
    PSSRQuestion,
    PSSRQuestionResponse,
    PSSRTeamMemberAssignment,
    PSSRWorkflow,
)
from app.models.user import User, UserRole
from app.schemas.pssr import PSSRCreateRequest, PSSRQuestionResponseRequest


UNDER_PREPARATION = "UNDER_PREPARATION"
TODO = "TODO"
IN_PROGRESS = "IN_PROGRESS"
COMPLETED_BY_TEAM = "COMPLETED_BY_TEAM"
PENDING_APPROVAL = "PENDING_APPROVAL"
APPROVED = "APPROVED"
REJECTED = "REJECTED"

TERMINAL_STATES = {APPROVED, REJECTED}
TRANSITIONS = {
    UNDER_PREPARATION: {TODO},
    TODO: {IN_PROGRESS},
    IN_PROGRESS: {COMPLETED_BY_TEAM},
    COMPLETED_BY_TEAM: {PENDING_APPROVAL},
    PENDING_APPROVAL: {APPROVED, REJECTED},
    REJECTED: {UNDER_PREPARATION},
}

LEGACY_STATE_MAP = {
    "Draft": UNDER_PREPARATION,
    "Assigned": TODO,
    "In Progress": IN_PROGRESS,
    "Completed": COMPLETED_BY_TEAM,
    "Pending Review": PENDING_APPROVAL,
    "Approved": APPROVED,
    "Closed": APPROVED,
    "Rejected": REJECTED,
}


def normalize_state(state: Optional[str]) -> str:
    return LEGACY_STATE_MAP.get(state or "", state or UNDER_PREPARATION)


def equivalent_states(state: str) -> list[str]:
    legacy = [old for old, new in LEGACY_STATE_MAP.items() if new == state]
    return [state, *legacy]


class PSSRWorkflowService:
    """Create, query, scope, and progress live PSSR workflows."""

    @staticmethod
    def create(db: Session, payload: PSSRCreateRequest, current_user: User) -> dict:
        if payload.moc_type == "MOC" and not payload.moc_number:
            raise ValidationError("MOC number is required for MOC PSSR.")
        if not payload.assignments:
            raise ValidationError("At least one department team member assignment is required.")
        if not payload.annexure_ids:
            raise ValidationError("At least one annexure template must be selected.")
        assignment_departments = [item.department.strip() for item in payload.assignments]
        if len(assignment_departments) != len(set(assignment_departments)):
            raise ValidationError("Only one PSSR team member can be assigned per department.")
        assignment_user_ids = [item.user_id for item in payload.assignments]
        if len(assignment_user_ids) != len(set(assignment_user_ids)):
            raise ValidationError("A team member can only be assigned once in a PSSR workflow.")

        users = {user.id: user for user in db.query(User).filter(User.id.in_(assignment_user_ids + ([payload.team_leader_user_id] if payload.team_leader_user_id else []))).all()}
        if payload.team_leader_user_id:
            leader = users.get(payload.team_leader_user_id)
            if not leader or not leader.active:
                raise ValidationError("Selected PSSR team leader is not active.")
        for assignment in payload.assignments:
            user = users.get(assignment.user_id)
            if not user or not user.active:
                raise ValidationError(f"Assigned user {assignment.user_id} is not active.")
            if not PSSRWorkflowService._department_matches(assignment.department, user.department):
                raise ValidationError(f"{user.full_name} is not valid for {assignment.department} assignment.")

        selected_annexure_ids = set(payload.annexure_ids)
        annexures = []
        if selected_annexure_ids:
            annexures = (
                db.query(Annexure)
                .filter(Annexure.id.in_(selected_annexure_ids), Annexure.active.is_(True), Annexure.is_deleted.is_(False))
                .all()
            )
            if len(annexures) != len(selected_annexure_ids):
                raise ValidationError("One or more selected annexures are inactive or unavailable.")

        annexure_questions = (
            db.query(AnnexureQuestion)
            .filter(AnnexureQuestion.annexure_id.in_(selected_annexure_ids), AnnexureQuestion.active.is_(True))
            .order_by(AnnexureQuestion.annexure_id.asc(), AnnexureQuestion.sort_order.asc(), AnnexureQuestion.id.asc())
            .all()
        ) if selected_annexure_ids else []
        if not annexure_questions and not payload.custom_questions:
            raise ValidationError("At least one selected annexure checkpoint or custom checkpoint is required.")

        assignment_by_department = PSSRWorkflowService._assignment_user_by_department(payload.assignments)
        missing_departments = sorted({
            PSSRWorkflowService._checkpoint_department(question.department_owner or question.checked_by_department)
            for question in annexure_questions
            if not PSSRWorkflowService._assigned_user_for_department(assignment_by_department, question.department_owner or question.checked_by_department)
        })
        if missing_departments:
            raise ValidationError(f"Assign one team member for each checkpoint-owning department: {', '.join(missing_departments)}.")
        for custom in payload.custom_questions:
            assigned_user_id = custom.assigned_user_id or PSSRWorkflowService._assigned_user_for_department(assignment_by_department, custom.department_owner)
            if not assigned_user_id:
                raise ValidationError(f"Assign one team member for custom checkpoint department {custom.department_owner}.")
            PSSRWorkflowService._ensure_checkpoint_assignment(payload.assignments, users, custom.department_owner, assigned_user_id)

        now = datetime.utcnow()
        pssr_id = PSSRWorkflowService._next_pssr_id(db, now)
        title = f"{payload.plant_unit} - {payload.equipment_system}"
        workflow = PSSRWorkflow(
            pssr_id=pssr_id,
            title=title,
            plant_unit=payload.plant_unit,
            equipment_system=payload.equipment_system,
            moc_type=payload.moc_type,
            moc_number=payload.moc_number,
            description=payload.description,
            workflow_state=payload.workflow_state,
            initiator_user_id=current_user.id,
            team_leader_user_id=payload.team_leader_user_id,
            area_owner_user_id=payload.area_owner_user_id,
            due_date=payload.due_date,
            submitted_at=now if payload.workflow_state == TODO else None,
        )
        db.add(workflow)
        db.flush()

        for item in payload.assignments:
            assignment = PSSRTeamMemberAssignment(
                pssr_id=pssr_id,
                department=item.department,
                user_id=item.user_id,
                assigned_by_user_id=current_user.id,
                status=TODO if payload.workflow_state == TODO else UNDER_PREPARATION,
                due_date=item.due_date or payload.due_date,
            )
            db.add(assignment)
            if payload.workflow_state == TODO:
                PSSRWorkflowService._notify_assignment(db, workflow, assignment, current_user)

        if payload.workflow_state == TODO and payload.team_leader_user_id:
            db.add(PSSRNotification(
                pssr_id=workflow.pssr_id,
                recipient_user_id=payload.team_leader_user_id,
                notification_type="TEAM_LEADER_ASSIGNMENT",
                title=f"PSSR assigned for leadership: {workflow.pssr_id}",
                body=f"{current_user.full_name} assigned you as team leader for {workflow.plant_unit}.",
                link=f"/team/assigned?pssr_id={workflow.pssr_id}",
            ))

        sequence = 0
        annexures_by_id = {annexure.id: annexure for annexure in annexures}
        questions_by_annexure: dict[int, list[AnnexureQuestion]] = {}
        for question in annexure_questions:
            questions_by_annexure.setdefault(question.annexure_id, []).append(question)
        for annexure_id in sorted(selected_annexure_ids):
            annexure = annexures_by_id[annexure_id]
            db.add(PSSRAnnexureSelection(
                pssr_id=pssr_id,
                annexure_id=annexure.id,
                revision=annexure.revision,
                selected_by_user_id=current_user.id,
            ))
            db.flush()
            for question in questions_by_annexure.get(annexure.id, []):
                department_owner = PSSRWorkflowService._checkpoint_department(question.department_owner or question.checked_by_department)
                assigned_user_id = PSSRWorkflowService._assigned_user_for_department(assignment_by_department, department_owner)
                sequence += 1
                frozen = PSSRQuestion(
                    pssr_id=pssr_id,
                    annexure_id=annexure.id,
                    annexure_question_id=question.id,
                    question_text=question.question_text,
                    question_description=question.help_text or question.expected_evidence or question.guidance_notes,
                    question_type=question.question_type or "FIELD",
                    response_type=question.response_type if question.response_type in {"YES_NO", "YES_NO_NA"} else "YES_NO_NA",
                    department_owner=department_owner,
                    assigned_user_id=assigned_user_id,
                    category=question.category,
                    mandatory=question.required,
                    custom=False,
                    sequence=sequence,
                    created_by_user_id=current_user.id,
                )
                db.add(frozen)

        for custom in payload.custom_questions:
            assigned_user_id = custom.assigned_user_id or PSSRWorkflowService._assigned_user_for_department(assignment_by_department, custom.department_owner)
            sequence += 1
            db.add(PSSRQuestion(
                pssr_id=pssr_id,
                question_text=custom.question_text,
                question_description=custom.description,
                question_type=custom.question_type,
                response_type="YES_NO_NA",
                department_owner=custom.department_owner,
                assigned_user_id=assigned_user_id,
                category=custom.category,
                mandatory=custom.mandatory,
                custom=True,
                remarks=custom.remarks,
                attachments=custom.attachments,
                sequence=sequence,
                created_by_user_id=current_user.id,
            ))

        db.flush()
        question_count = db.query(func.count(PSSRQuestion.id)).filter(PSSRQuestion.pssr_id == pssr_id).scalar() or 0
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "CREATE", f"PSSR {pssr_id} created.", {"questions": question_count})
        if payload.workflow_state == TODO:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_SUBMITTED", f"PSSR {pssr_id} submitted to assigned departments.", {"target_state": TODO})
        db.add(PSSRActivityLog(
            pssr_id=pssr_id,
            user_id=current_user.id,
            area_owner_user_id=payload.area_owner_user_id,
            action="PSSR Created",
            detail=f"{title} created with {len(payload.assignments)} assignment(s).",
            timestamp=now.isoformat(),
        ))
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def submit(db: Session, pssr_id: str, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        if normalize_state(workflow.workflow_state) != UNDER_PREPARATION:
            raise ValidationError(f"PSSR workflow cannot be submitted from {workflow.workflow_state}.")
        if workflow.initiator_user_id != current_user.id:
            raise AuthorizationError("Only the PSSR initiator can submit this draft.")

        now = datetime.utcnow()
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        if not assignments:
            raise ValidationError("At least one department assignment is required before submission.")

        workflow.workflow_state = TODO
        workflow.submitted_at = now
        workflow.updated_at = now
        for assignment in assignments:
            assignment.status = "TODO"
            assignment.updated_at = now
            PSSRWorkflowService._notify_assignment(db, workflow, assignment, current_user)

        if workflow.team_leader_user_id:
            db.add(PSSRNotification(
                pssr_id=workflow.pssr_id,
                recipient_user_id=workflow.team_leader_user_id,
                notification_type="TEAM_LEADER_ASSIGNMENT",
                title=f"PSSR assigned for leadership: {workflow.pssr_id}",
                body=f"{current_user.full_name} assigned you as team leader for {workflow.plant_unit}.",
                link=f"/team/assigned?pssr_id={workflow.pssr_id}",
            ))

        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_SUBMITTED", f"PSSR {pssr_id} submitted to assigned departments.", {"target_state": TODO})
        db.add(PSSRActivityLog(
            pssr_id=pssr_id,
            user_id=current_user.id,
            area_owner_user_id=workflow.area_owner_user_id,
            action="PSSR Submitted",
            detail="Under preparation workflow submitted to assigned department team members.",
            timestamp=now.isoformat(),
        ))
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def get(db: Session, pssr_id: str, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        PSSRWorkflowService._ensure_workflow_access(db, workflow, current_user)
        questions_query = db.query(PSSRQuestion).filter(PSSRQuestion.pssr_id == pssr_id)
        questions = questions_query.order_by(PSSRQuestion.sequence.asc(), PSSRQuestion.id.asc()).all()
        responses = {
            row.pssr_question_id: row
            for row in db.query(PSSRQuestionResponse).filter(PSSRQuestionResponse.pssr_id == pssr_id).all()
        }
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        question_user_ids = {item.assigned_user_id for item in questions if item.assigned_user_id}
        assignment_user_ids = list({item.user_id for item in assignments if item.user_id} | question_user_ids)
        users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(assignment_user_ids)).all()
        } if assignment_user_ids else {}
        annexures = db.query(PSSRAnnexureSelection, Annexure).join(
            Annexure,
            Annexure.id == PSSRAnnexureSelection.annexure_id,
        ).filter(PSSRAnnexureSelection.pssr_id == pssr_id).all()
        punch_points = (
    db.query(AnnexurePunchPoint)
    .filter(AnnexurePunchPoint.pssr_id == pssr_id)
    .order_by(AnnexurePunchPoint.updated_at.desc())
    .all()
        )
        audit_rows = db.query(PSSRAuditLog).filter(PSSRAuditLog.pssr_id == pssr_id).order_by(PSSRAuditLog.created_at.asc()).limit(100).all()
        audit_user_ids = list({row.actor_user_id for row in audit_rows if row.actor_user_id})
        audit_users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(audit_user_ids)).all()
        } if audit_user_ids else {}
        permissions = PSSRWorkflowService._permissions(db, workflow, current_user)
        editable_departments = set(permissions["editable_departments"])
        return {
            **PSSRWorkflowService._summary(db, workflow),
            "permissions": permissions,
            "assignments": [PSSRWorkflowService._assignment_dict(item, users.get(item.user_id)) for item in assignments],
            "questions": [
                PSSRWorkflowService._question_dict(
                    item,
                    responses.get(item.id),
                    assigned_user=users.get(item.assigned_user_id),
                    can_answer=(
                        (item.assigned_user_id == current_user.id)
                        or any(
                            PSSRWorkflowService._department_matches(department, item.department_owner)
                            or PSSRWorkflowService._department_matches(item.department_owner, department)
                            for department in editable_departments
                        )
                    ),
                )
                for item in questions
            ],
            "annexures": [
                {
                    "id": selection.annexure_id,
                    "code": annexure.code,
                    "title": annexure.title,
                    "revision": selection.revision,
                    "status": selection.status,
                    "selected_at": selection.selected_at.isoformat(),
                }
                for selection, annexure in annexures
            ],
            "punch_points": [
                {
                    "id": row.id,
                    "title": row.title,
                    "description": row.description,
                    "category": row.category,
                    "severity": row.severity,
                    "status": row.status,
                    "owning_department": row.owning_department,
                    "assigned_to_user_id": row.assigned_to_user_id,
                    "question_id": row.question_id,
                    "workflow_reference": row.pssr_id,
                    "due_date": row.due_date.isoformat() if row.due_date else None,
                    "created_at": row.raised_at.isoformat(),
                }
                for row in punch_points
            ],
            "audit_timeline": [
                {
                    "id": row.id,
                    "action": row.action,
                    "summary": row.summary,
                    "actor_user_id": row.actor_user_id,
                    "actor": PSSRWorkflowService._user_brief(audit_users.get(row.actor_user_id)),
                    "department": audit_users.get(row.actor_user_id).department if audit_users.get(row.actor_user_id) else None,
                    "metadata": row.metadata_json or {},
                    "created_at": row.created_at.isoformat(),
                }
                for row in audit_rows
            ],
        }

    @staticmethod
    def list_workflows(
        db: Session,
        *,
        current_user: User,
        search: Optional[str],
        department: Optional[str],
        page: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        query = db.query(PSSRWorkflow)
        role = PSSRWorkflowService._role(current_user)
        if role == UserRole.ADMIN.value:
            pass
        elif role == UserRole.AREA_OWNER.value:
            query = query.filter(
                PSSRWorkflow.area_owner_user_id == current_user.id,
                PSSRWorkflow.workflow_state.notin_(equivalent_states(UNDER_PREPARATION)),
            )
        else:
            assignment_ids = db.query(PSSRTeamMemberAssignment.pssr_id).filter(
                PSSRTeamMemberAssignment.user_id == current_user.id,
            )
            query = query.filter(or_(
                PSSRWorkflow.initiator_user_id == current_user.id,
                PSSRWorkflow.team_leader_user_id == current_user.id,
                and_(PSSRWorkflow.workflow_state.notin_(equivalent_states(UNDER_PREPARATION)), PSSRWorkflow.pssr_id.in_(assignment_ids)),
            ))
        if department:
            query = query.join(PSSRTeamMemberAssignment, PSSRTeamMemberAssignment.pssr_id == PSSRWorkflow.pssr_id).filter(PSSRTeamMemberAssignment.department == department)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(or_(PSSRWorkflow.pssr_id.ilike(pattern), PSSRWorkflow.title.ilike(pattern), PSSRWorkflow.plant_unit.ilike(pattern), PSSRWorkflow.equipment_system.ilike(pattern)))
        total = query.distinct().count()
        rows = query.order_by(PSSRWorkflow.updated_at.desc(), PSSRWorkflow.id.desc()).offset((page - 1) * limit).limit(limit).all()
        return [PSSRWorkflowService._summary(db, row) for row in rows], total

    @staticmethod
    def respond(db: Session, pssr_id: str, question_id: int, payload: PSSRQuestionResponseRequest, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        state = normalize_state(workflow.workflow_state)
        if state in TERMINAL_STATES:
            raise ValidationError("Closed PSSR workflows cannot be modified.")
        if state not in {TODO, IN_PROGRESS}:
            raise ValidationError("PSSR responses can only be edited after submission.")
        if PSSRWorkflowService._role(current_user) == UserRole.ADMIN.value:
            raise AuthorizationError("Admin users have supervisory read-only access and cannot answer PSSR questions.")
        question = db.query(PSSRQuestion).filter(PSSRQuestion.id == question_id, PSSRQuestion.pssr_id == pssr_id).first()
        if not question:
            raise ResourceNotFoundError("PSSR question", question_id)
        PSSRWorkflowService._ensure_question_actor(db, workflow, question, current_user)
        now = datetime.utcnow()
        if state == TODO:
            workflow.workflow_state = IN_PROGRESS
            workflow.started_at = workflow.started_at or now
            workflow.started_by_user_id = workflow.started_by_user_id or current_user.id
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_IN_PROGRESS", f"PSSR {pssr_id} moved to in-progress by first question response.", {"source": "QUESTION_RESPONSE"})
        response = db.query(PSSRQuestionResponse).filter(PSSRQuestionResponse.pssr_question_id == question.id).first()
        if not response:
            response = PSSRQuestionResponse(pssr_id=pssr_id, pssr_question_id=question.id)
            db.add(response)
        response.response = payload.response
        response.remarks = payload.remarks
        response.attachments = payload.attachments
        response.responded_by_user_id = current_user.id
        response.responded_by_department = current_user.department or question.department_owner
        response.responded_at = now
        question.status = "COMPLETED" if payload.response in {"YES", "NO", "NA"} else "PENDING"
        if payload.response == "NO":
            PSSRWorkflowService._ensure_punch_point(db, workflow, question, payload, current_user)
        PSSRWorkflowService._refresh_assignment_progress(db, pssr_id, question.department_owner, now)
        PSSRWorkflowService._refresh_department_completion(db, pssr_id, question.department_owner, now)
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "QUESTION_RESPONSE", f"Question {question.id} answered {payload.response}.", {"department": question.department_owner})
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user, now)
        db.commit()
        return PSSRWorkflowService._question_dict(question, response)

    @staticmethod
    def transition(db: Session, pssr_id: str, target_state: str, current_user: User, remarks: Optional[str] = None) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        target_state = normalize_state(target_state)
        current_state = normalize_state(workflow.workflow_state)
        PSSRWorkflowService._ensure_transition_actor(db, workflow, target_state, current_user)
        allowed = TRANSITIONS.get(current_state, set())
        if target_state not in allowed:
            raise ValidationError(f"Cannot transition from {workflow.workflow_state} to {target_state}.")
        if target_state in {IN_PROGRESS, COMPLETED_BY_TEAM}:
            raise ValidationError("Workflow execution state is controlled by question completion and punchlist status.")
        workflow.workflow_state = target_state
        now = datetime.utcnow()
        if target_state == APPROVED:
            workflow.approved_at = now
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_TRANSITION", f"Workflow moved to {target_state}.", {"remarks": remarks})
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def _next_pssr_id(db: Session, now: datetime) -> str:
        prefix = f"PSSR-{now:%Y%m%d}"
        count = db.query(func.count(PSSRWorkflow.id)).filter(PSSRWorkflow.pssr_id.like(f"{prefix}-%")).scalar() or 0
        return f"{prefix}-{count + 1:04d}"

    @staticmethod
    def _summary(db: Session, workflow: PSSRWorkflow) -> dict:
        pssr_id = workflow.pssr_id
        header_user_ids = [user_id for user_id in [workflow.initiator_user_id, workflow.team_leader_user_id] if user_id]
        header_users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(header_user_ids)).all()
        } if header_user_ids else {}
        initiator = header_users.get(workflow.initiator_user_id)
        team_leader = header_users.get(workflow.team_leader_user_id)
        total_questions = db.query(func.count(PSSRQuestion.id)).filter(PSSRQuestion.pssr_id == pssr_id).scalar() or 0
        answered_questions = db.query(func.count(PSSRQuestionResponse.id)).join(
            PSSRQuestion,
            PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
        ).filter(
            PSSRQuestion.pssr_id == pssr_id,
            PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
        ).scalar() or 0
        mandatory_questions = db.query(func.count(PSSRQuestion.id)).filter(
            PSSRQuestion.pssr_id == pssr_id,
            PSSRQuestion.mandatory.is_(True),
        ).scalar() or 0
        mandatory_answered = db.query(func.count(PSSRQuestionResponse.id)).join(
            PSSRQuestion,
            PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
        ).filter(
            PSSRQuestion.pssr_id == pssr_id,
            PSSRQuestion.mandatory.is_(True),
            PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
        ).scalar() or 0
        assignment_count = db.query(func.count(PSSRTeamMemberAssignment.id)).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).scalar() or 0
        open_punch_points = db.query(func.count(AnnexurePunchPoint.id)).filter(
            AnnexurePunchPoint.pssr_id == pssr_id,
            AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
        ).scalar() or 0
        mandatory_open_punch_points = db.query(func.count(AnnexurePunchPoint.id)).filter(
            AnnexurePunchPoint.pssr_id == pssr_id,
            AnnexurePunchPoint.category == "A",
            AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
        ).scalar() or 0
        return {
            "pssr_id": pssr_id,
            "title": workflow.title,
            "plant_unit": workflow.plant_unit,
            "equipment_system": workflow.equipment_system,
            "moc_type": workflow.moc_type,
            "moc_number": workflow.moc_number,
            "description": workflow.description,
            "workflow_state": workflow.workflow_state,
            "initiator_user_id": workflow.initiator_user_id,
            "team_leader_user_id": workflow.team_leader_user_id,
            "initiator": PSSRWorkflowService._user_brief(initiator),
            "team_leader": PSSRWorkflowService._user_brief(team_leader),
            "area_owner_user_id": workflow.area_owner_user_id,
            "started_at": workflow.started_at.isoformat() if workflow.started_at else None,
            "submitted_at": workflow.submitted_at.isoformat() if workflow.submitted_at else None,
            "started_by_user_id": workflow.started_by_user_id,
            "completed_at": workflow.completed_at.isoformat() if workflow.completed_at else None,
            "completed_by_user_id": workflow.completed_by_user_id,
            "approved_at": workflow.approved_at.isoformat() if workflow.approved_at else None,
            "created_at": workflow.created_at.isoformat(),
            "updated_at": workflow.updated_at.isoformat(),
            "annexure_count": db.query(func.count(PSSRAnnexureSelection.id)).filter(PSSRAnnexureSelection.pssr_id == pssr_id).scalar() or 0,
            "assignment_count": assignment_count,
            "question_count": total_questions,
            "questions_answered": answered_questions,
            "mandatory_question_count": mandatory_questions,
            "mandatory_questions_answered": mandatory_answered,
            "progress": round(answered_questions * 100 / total_questions) if total_questions else 0,
            "open_punch_points": open_punch_points,
            "mandatory_open_punch_points": mandatory_open_punch_points,
        }

    @staticmethod
    def _get_workflow(db: Session, pssr_id: str) -> PSSRWorkflow:
        workflow = db.query(PSSRWorkflow).filter(PSSRWorkflow.pssr_id == pssr_id).first()
        if not workflow:
            raise ResourceNotFoundError("PSSR workflow", pssr_id)
        return workflow

    @staticmethod
    def _role(user: User) -> str:
        return user.role.value if hasattr(user.role, "value") else str(user.role)

    @staticmethod
    def _ensure_workflow_access(db: Session, workflow: PSSRWorkflow, current_user: User) -> None:
        if PSSRWorkflowService._role(current_user) == UserRole.ADMIN.value:
            return
        if current_user.id in {workflow.initiator_user_id, workflow.area_owner_user_id, workflow.team_leader_user_id}:
            return
        exists = db.query(PSSRTeamMemberAssignment.id).filter(
            PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
            PSSRTeamMemberAssignment.user_id == current_user.id,
        ).first()
        if not exists:
            raise AuthorizationError("Workflow access is outside your assigned scope.")

    @staticmethod
    def _department_scope(db: Session, pssr_id: str, current_user: User) -> Optional[list[str]]:
        role = PSSRWorkflowService._role(current_user)
        workflow = db.query(PSSRWorkflow).filter(PSSRWorkflow.pssr_id == pssr_id).first()
        if not workflow:
            return None
        if role == UserRole.ADMIN.value or (workflow and current_user.id in {workflow.initiator_user_id, workflow.area_owner_user_id, workflow.team_leader_user_id}):
            return None
        departments = [
            row.department
            for row in db.query(PSSRTeamMemberAssignment.department).filter(
                PSSRTeamMemberAssignment.pssr_id == pssr_id,
                PSSRTeamMemberAssignment.user_id == current_user.id,
            ).all()
        ]
        return departments

    @staticmethod
    def _ensure_department_access(db: Session, pssr_id: str, department: str, current_user: User) -> None:
        if PSSRWorkflowService._role(current_user) == UserRole.ADMIN.value:
            return
        assignments = db.query(PSSRTeamMemberAssignment.department).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.user_id == current_user.id,
        ).all()
        assigned = any(
            PSSRWorkflowService._department_matches(row.department, department)
            or PSSRWorkflowService._department_matches(department, row.department)
            for row in assignments
        )
        if not assigned:
            raise AuthorizationError("Question access is outside your department scope.")

    @staticmethod
    def _ensure_assigned_department_member(db: Session, pssr_id: str, department: str, current_user: User) -> None:
        assignments = db.query(PSSRTeamMemberAssignment.department).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.user_id == current_user.id,
        ).all()
        assigned = any(
            PSSRWorkflowService._department_matches(row.department, department)
            or PSSRWorkflowService._department_matches(department, row.department)
            for row in assignments
        )
        if not assigned:
            raise AuthorizationError("Only assigned department members can modify this PSSR section.")

    @staticmethod
    def _ensure_checkpoint_assignment(assignments, users: dict[int, User], department: str, user_id: int) -> None:
        user = users.get(user_id)
        if not user or not user.active:
            raise ValidationError("Each selected checkpoint must have an active responsible team member.")
        assigned = any(
            assignment.user_id == user_id
            and (
                PSSRWorkflowService._department_matches(assignment.department, department)
                or PSSRWorkflowService._department_matches(department, assignment.department)
            )
            for assignment in assignments
        )
        if not assigned:
            raise ValidationError("Checkpoint responsible member must be selected in the PSSR Team Members section for the assigned department.")

    @staticmethod
    def _ensure_question_actor(db: Session, workflow: PSSRWorkflow, question: PSSRQuestion, current_user: User) -> None:
        if workflow.team_leader_user_id == current_user.id:
            if any(
                PSSRWorkflowService._department_matches(department, question.department_owner)
                or PSSRWorkflowService._department_matches(question.department_owner, department)
                for department in PSSRWorkflowService._leader_department_scope(db, workflow.pssr_id, current_user, workflow)
            ):
                return
            raise AuthorizationError("Team leader checkpoint access is limited to their assigned department scope.")
        if question.assigned_user_id:
            if question.assigned_user_id != current_user.id:
                raise AuthorizationError("Only the assigned checkpoint owner can answer this checkpoint.")
            return
        PSSRWorkflowService._ensure_assigned_department_member(db, workflow.pssr_id, question.department_owner, current_user)

    @staticmethod
    def _leader_department_scope(db: Session, pssr_id: str, current_user: User, workflow: Optional[PSSRWorkflow] = None) -> list[str]:
        workflow = workflow or db.query(PSSRWorkflow).filter(PSSRWorkflow.pssr_id == pssr_id).first()
        if not workflow or workflow.team_leader_user_id != current_user.id:
            return []
        return [
            row.department
            for row in db.query(PSSRTeamMemberAssignment.department).filter(
                PSSRTeamMemberAssignment.pssr_id == pssr_id,
            ).all()
            if PSSRWorkflowService._department_matches(row.department, current_user.department)
            or PSSRWorkflowService._department_matches(current_user.department or "", row.department)
        ]

    @staticmethod
    def _checkpoint_department(owner: Optional[str]) -> str:
        return (owner or "Others").strip() or "Others"

    @staticmethod
    def _assignment_user_by_department(assignments) -> dict[str, int]:
        return {item.department.strip(): item.user_id for item in assignments}

    @staticmethod
    def _assigned_user_for_department(assignments: dict[str, int], owner: Optional[str]) -> Optional[int]:
        for department, user_id in assignments.items():
            if PSSRWorkflowService._department_matches(department, owner) or PSSRWorkflowService._department_matches(owner or "", department):
                return user_id
        return None

    @staticmethod
    def _ensure_transition_actor(db: Session, workflow: PSSRWorkflow, target_state: str, current_user: User) -> None:
        role = PSSRWorkflowService._role(current_user)
        if role == UserRole.ADMIN.value:
            raise AuthorizationError("Admin users have supervisory read-only access and cannot modify PSSR workflows.")
        if target_state in {PENDING_APPROVAL, APPROVED, REJECTED} and current_user.id == workflow.area_owner_user_id:
            return
        raise AuthorizationError("You are not allowed to perform this workflow transition.")

    @staticmethod
    def _department_matches(expected: str, actual: Optional[str]) -> bool:
        if not actual:
            return expected == "Others"
        a = actual.lower().strip()
        e = expected.lower().strip()
        if e == "safety / psm":
            return "safety" in a or "psm" in a or "hse" in a
        if e in {"operations", "operation", "pm operation"}:
            return "operation" in a
        if e == "instrumentation":
            return "instrument" in a
        if e == "instrumental":
            return "instrument" in a
        if e == "others":
            return any(token in a for token in ["other", "it", "admin"])
        return e in a or e.rstrip("s") in a

    @staticmethod
    def _has_department_assignment(assignments: dict[str, list[PSSRTeamMemberAssignment]], owner: Optional[str]) -> bool:
        return any(PSSRWorkflowService._department_matches(department, owner) or PSSRWorkflowService._department_matches(owner or "", department) for department in assignments)

    @staticmethod
    def _assigned_department_for_owner(assignments: dict[str, list[PSSRTeamMemberAssignment]], owner: Optional[str]) -> Optional[str]:
        for department in assignments:
            if PSSRWorkflowService._department_matches(department, owner) or PSSRWorkflowService._department_matches(owner or "", department):
                return department
        return None

    @staticmethod
    def _assignment_dict(assignment: PSSRTeamMemberAssignment, user: Optional[User] = None) -> dict:
        return {
            "id": assignment.id,
            "pssr_id": assignment.pssr_id,
            "department": assignment.department,
            "user_id": assignment.user_id,
            "status": assignment.status,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "assigned_at": assignment.assigned_at.isoformat(),
            "started_at": assignment.started_at.isoformat() if assignment.started_at else None,
            "completed_at": assignment.completed_at.isoformat() if assignment.completed_at else None,
            "user": {
                "id": user.id,
                "employee_id": user.employee_id,
                "full_name": user.full_name,
                "email": user.email,
                "department": user.department,
                "designation": user.designation,
            } if user else None,
        }

    @staticmethod
    def _user_brief(user: Optional[User]) -> Optional[dict]:
        if not user:
            return None
        return {
            "id": user.id,
            "employee_id": user.employee_id,
            "full_name": user.full_name,
            "email": user.email,
            "department": user.department,
            "designation": user.designation,
        }

    @staticmethod
    def _permissions(db: Session, workflow: PSSRWorkflow, current_user: User) -> dict:
        role = PSSRWorkflowService._role(current_user)
        assignments = db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
            PSSRTeamMemberAssignment.user_id == current_user.id,
        ).all()
        is_initiator = current_user.id == workflow.initiator_user_id
        is_leader = current_user.id == workflow.team_leader_user_id
        is_assigned_member = bool(assignments)
        editable_departments = []
        state = normalize_state(workflow.workflow_state)
        if role != UserRole.ADMIN.value and state == IN_PROGRESS:
            editable_departments = [item.department for item in assignments]
            if is_leader:
                editable_departments = PSSRWorkflowService._leader_department_scope(db, workflow.pssr_id, current_user, workflow)
        return {
            "is_admin": role == UserRole.ADMIN.value,
            "is_initiator": is_initiator,
            "is_team_leader": is_leader,
            "is_assigned_member": is_assigned_member,
            "can_submit": is_initiator and state == UNDER_PREPARATION and role != UserRole.ADMIN.value,
            "can_edit_header": is_initiator and state == UNDER_PREPARATION and role != UserRole.ADMIN.value,
            "editable_departments": editable_departments,
        }

    @staticmethod
    def _question_dict(question: PSSRQuestion, response: Optional[PSSRQuestionResponse], *, assigned_user: Optional[User] = None, can_answer: bool = False) -> dict:
        return {
            "id": question.id,
            "pssr_id": question.pssr_id,
            "annexure_id": question.annexure_id,
            "annexure_question_id": question.annexure_question_id,
            "question_text": question.question_text,
            "question_description": question.question_description,
            "question_type": question.question_type or "FIELD",
            "response_type": question.response_type,
            "department_owner": question.department_owner,
            "assigned_user_id": question.assigned_user_id,
            "assigned_user": PSSRWorkflowService._user_brief(assigned_user),
            "category": question.category,
            "mandatory": question.mandatory,
            "custom": question.custom,
            "remarks": question.remarks,
            "status": question.status,
            "sequence": question.sequence,
            "can_answer": can_answer,
            "latest_response": {
                "id": response.id,
                "response": response.response,
                "remarks": response.remarks,
                "attachments": response.attachments or [],
                "responded_by_user_id": response.responded_by_user_id,
                "responded_at": response.responded_at.isoformat() if response.responded_at else None,
            } if response else None,
        }

    @staticmethod
    def _notify_assignment(db: Session, workflow: PSSRWorkflow, assignment: PSSRTeamMemberAssignment, current_user: User) -> None:
        db.add(PSSRNotification(
            pssr_id=workflow.pssr_id,
            recipient_user_id=assignment.user_id,
            notification_type="ASSIGNMENT",
            title=f"PSSR assigned: {workflow.pssr_id}",
            body=f"{current_user.full_name} assigned {assignment.department} work for {workflow.plant_unit}.",
            link=f"/team/assigned?pssr_id={workflow.pssr_id}&department={assignment.department}",
        ))

    @staticmethod
    def _audit(db: Session, pssr_id: str, actor_id: Optional[int], action: str, summary: str, metadata: Optional[dict] = None) -> None:
        db.add(PSSRAuditLog(pssr_id=pssr_id, actor_user_id=actor_id, action=action, summary=summary, metadata_json=metadata or {}))

    @staticmethod
    def _ensure_punch_point(db: Session, workflow: PSSRWorkflow, question: PSSRQuestion, payload: PSSRQuestionResponseRequest, current_user: User) -> None:
        existing = db.query(AnnexurePunchPoint).filter(
            AnnexurePunchPoint.pssr_id == workflow.pssr_id,
            AnnexurePunchPoint.question_id == question.annexure_question_id,
            AnnexurePunchPoint.title == f"PSSR question failed: {question.category}",
            AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
        ).first()
        if existing:
            return
        assignment = db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
            PSSRTeamMemberAssignment.department == question.department_owner,
        ).order_by(PSSRTeamMemberAssignment.id.asc()).first()
        db.add(AnnexurePunchPoint(
            pssr_id=workflow.pssr_id,
            annexure_id=question.annexure_id,
            question_id=question.annexure_question_id,
            title=f"PSSR question failed: {question.category}",
            description=payload.remarks or question.question_text,
            category="A" if question.mandatory else "B",
            severity="HIGH" if question.mandatory else "LOW",
            status="OPEN",
            owning_department=question.department_owner,
            assigned_to_user_id=assignment.user_id if assignment else None,
            raised_by_user_id=current_user.id,
        ))
        PSSRWorkflowService._audit(db, workflow.pssr_id, current_user.id, "PUNCH_CREATED", f"Punch list entry created for question {question.id}.", {"department": question.department_owner})

    @staticmethod
    def _refresh_assignment_progress(db: Session, pssr_id: str, department: str, now: Optional[datetime] = None) -> None:
        now = now or datetime.utcnow()
        total = db.query(func.count(PSSRQuestion.id)).filter(PSSRQuestion.pssr_id == pssr_id, PSSRQuestion.department_owner == department).scalar() or 0
        answered = db.query(func.count(PSSRQuestionResponse.id)).join(PSSRQuestion, PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id).filter(
            PSSRQuestion.pssr_id == pssr_id,
            PSSRQuestion.department_owner == department,
            PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
        ).scalar() or 0
        values = {"status": "IN_PROGRESS" if answered else "TODO"}
        if answered:
            values["started_at"] = now
        db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.department == department,
        ).update(
            values,
            synchronize_session=False,
        )

    @staticmethod
    def _refresh_department_completion(db: Session, pssr_id: str, department: str, now: Optional[datetime] = None) -> None:
        now = now or datetime.utcnow()
        pending = db.query(func.count(PSSRQuestion.id)).outerjoin(
            PSSRQuestionResponse,
            PSSRQuestionResponse.pssr_question_id == PSSRQuestion.id,
        ).filter(
            PSSRQuestion.pssr_id == pssr_id,
            PSSRQuestion.department_owner == department,
            PSSRQuestion.mandatory.is_(True),
            or_(PSSRQuestionResponse.response.is_(None), PSSRQuestionResponse.response == "PENDING"),
        ).scalar() or 0
        if pending:
            return
        db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.department == department,
        ).update(
            {"status": "COMPLETED", "completed_at": now, "updated_at": now},
            synchronize_session=False,
        )

    @staticmethod
    def _refresh_workflow_state(db: Session, workflow: PSSRWorkflow, current_user: User, now: Optional[datetime] = None) -> None:
        state = normalize_state(workflow.workflow_state)
        if state in TERMINAL_STATES or state in {UNDER_PREPARATION, TODO}:
            return
        now = now or datetime.utcnow()
        answered = db.query(func.count(PSSRQuestionResponse.id)).join(
            PSSRQuestion,
            PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
        ).filter(
            PSSRQuestion.pssr_id == workflow.pssr_id,
            PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
        ).scalar() or 0
        total_questions = db.query(func.count(PSSRQuestion.id)).filter(
            PSSRQuestion.pssr_id == workflow.pssr_id,
        ).scalar() or 0
        mandatory_total = db.query(func.count(PSSRQuestion.id)).filter(
            PSSRQuestion.pssr_id == workflow.pssr_id,
            PSSRQuestion.mandatory.is_(True),
        ).scalar() or 0
        mandatory_answered = db.query(func.count(PSSRQuestionResponse.id)).join(
            PSSRQuestion,
            PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
        ).filter(
            PSSRQuestion.pssr_id == workflow.pssr_id,
            PSSRQuestion.mandatory.is_(True),
            PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
        ).scalar() or 0
        mandatory_punches = db.query(func.count(AnnexurePunchPoint.id)).filter(
            AnnexurePunchPoint.pssr_id == workflow.pssr_id,
            AnnexurePunchPoint.category == "A",
            AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
        ).scalar() or 0

        target_state = workflow.workflow_state
        incomplete_required_evidence = db.query(func.count(PSSRQuestionResponse.id)).join(
            PSSRQuestion,
            PSSRQuestion.id == PSSRQuestionResponse.pssr_question_id,
        ).filter(
            PSSRQuestion.pssr_id == workflow.pssr_id,
            PSSRQuestionResponse.response == "NO",
            or_(PSSRQuestionResponse.remarks.is_(None), PSSRQuestionResponse.remarks == ""),
        ).scalar() or 0

        if total_questions and answered == total_questions and mandatory_answered == mandatory_total and mandatory_punches == 0 and incomplete_required_evidence == 0:
            target_state = COMPLETED_BY_TEAM

        if target_state != workflow.workflow_state:
            previous = workflow.workflow_state
            workflow.workflow_state = target_state
            workflow.updated_at = now
            if target_state == COMPLETED_BY_TEAM:
                workflow.completed_at = now
                workflow.completed_by_user_id = current_user.id
            PSSRWorkflowService._audit(
                db,
                workflow.pssr_id,
                current_user.id,
                "WORKFLOW_AUTO_TRANSITION",
                f"Workflow moved from {previous} to {target_state}.",
                {"previous_state": previous, "target_state": target_state},
            )
            db.add(PSSRActivityLog(
                pssr_id=workflow.pssr_id,
                user_id=current_user.id,
                area_owner_user_id=workflow.area_owner_user_id,
                action="Workflow Updated",
                detail=f"State changed from {previous} to {target_state}.",
                timestamp=now.isoformat(),
            ))
