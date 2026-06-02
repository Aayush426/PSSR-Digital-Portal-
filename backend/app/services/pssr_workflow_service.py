"""Business service for initiated PSSR workflows."""
from datetime import datetime
from typing import Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import AuthorizationError, ResourceNotFoundError, ValidationError
from app.core.logging import get_logger
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
from app.schemas.pssr import PSSRCreateRequest, PSSREditRequest, PSSRPunchPointRequest, PSSRQuestionResponseRequest

logger = get_logger(__name__)


UNDER_PREPARATION = "UNDER_PREPARATION"
TODO = "SUBMITTED"
IN_PROGRESS = "IN_PROGRESS"
COMPLETED_BY_TEAM = "COMPLETED_BY_DEPARTMENT"
PENDING_APPROVAL = "PENDING_AREA_OWNER_APPROVAL"
APPROVED = "APPROVED"
REJECTED = "REJECTED"
CLOSED = "CLOSED"

TERMINAL_STATES = {APPROVED, CLOSED}
TRANSITIONS = {
    UNDER_PREPARATION: {IN_PROGRESS},
    TODO: {IN_PROGRESS},
    IN_PROGRESS: {COMPLETED_BY_TEAM},
    COMPLETED_BY_TEAM: {PENDING_APPROVAL},
    PENDING_APPROVAL: {APPROVED, REJECTED},
    APPROVED: {CLOSED},
    REJECTED: {IN_PROGRESS},
}

LEGACY_STATE_MAP = {
    "Draft": UNDER_PREPARATION,
    "Assigned": TODO,
    "TODO": TODO,
    "In Progress": IN_PROGRESS,
    "Completed": COMPLETED_BY_TEAM,
    "COMPLETED": COMPLETED_BY_TEAM,
    "COMPLETED_BY_TEAM": COMPLETED_BY_TEAM,
    "PENDING_APPROVAL": PENDING_APPROVAL,
    "Pending Review": PENDING_APPROVAL,
    "AREA_OWNER_PENDING": PENDING_APPROVAL,
    "AREA_OWNER_APPROVED": APPROVED,
    "FINAL_APPROVED": APPROVED,
    "Approved": APPROVED,
    "Closed": CLOSED,
    "Rejected": REJECTED,
    "CLOSED": CLOSED,
    "REOPENED": IN_PROGRESS,
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

        selected_question_keys = {(item.annexure_id, item.question_id) for item in payload.selected_questions}
        if selected_annexure_ids and not selected_question_keys:
            selected_question_keys = {
                (row.annexure_id, row.id)
                for row in db.query(AnnexureQuestion.annexure_id, AnnexureQuestion.id)
                .filter(AnnexureQuestion.annexure_id.in_(selected_annexure_ids), AnnexureQuestion.active.is_(True))
                .all()
            }
        if not selected_question_keys and not payload.custom_questions:
            raise ValidationError("At least one selected annexure checkpoint or custom checkpoint is required.")
        invalid_annexure_ids = {annexure_id for annexure_id, _ in selected_question_keys if annexure_id not in selected_annexure_ids}
        if invalid_annexure_ids:
            raise ValidationError("Selected checkpoints must belong to selected annexure templates.")

        selected_question_rows = (
            db.query(AnnexureQuestion)
            .filter(
                AnnexureQuestion.annexure_id.in_({annexure_id for annexure_id, _ in selected_question_keys}),
                AnnexureQuestion.id.in_({question_id for _, question_id in selected_question_keys}),
                AnnexureQuestion.active.is_(True),
            )
            .order_by(AnnexureQuestion.annexure_id.asc(), AnnexureQuestion.sort_order.asc(), AnnexureQuestion.id.asc())
            .all()
        ) if selected_question_keys else []
        annexure_questions = [row for row in selected_question_rows if (row.annexure_id, row.id) in selected_question_keys]
        if len(annexure_questions) != len(selected_question_keys):
            raise ValidationError("One or more selected checkpoints are inactive or unavailable.")

        assignment_by_department = PSSRWorkflowService._assignment_user_by_department(payload.assignments)
        logger.info(
            "selectedTeamMembers=%s",
            [
                {
                    "department": item.department,
                    "assignedMemberId": item.user_id,
                    "assignedMemberName": users.get(item.user_id).full_name if users.get(item.user_id) else None,
                    "email": users.get(item.user_id).email if users.get(item.user_id) else None,
                }
                for item in payload.assignments
            ],
        )
        selected_question_payloads = {
            (item.annexure_id, item.question_id): item
            for item in payload.selected_questions
        }
        for question in annexure_questions:
            selected = selected_question_payloads.get((question.annexure_id, question.id))
            selected_department = selected.department_owner if selected else (question.department_owner or question.checked_by_department)
            department_owner = PSSRWorkflowService._checkpoint_department(selected_department)
            assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                assignment_by_department,
                department_owner,
                selected.assigned_user_id if selected else None,
            )
            if not assigned_user_id:
                raise ValidationError(f"{department_owner} department has checkpoints assigned but no team member selected.")
            PSSRWorkflowService._ensure_checkpoint_assignment(payload.assignments, users, department_owner, assigned_user_id)
        for custom in payload.custom_questions:
            assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                assignment_by_department,
                custom.department_owner,
                custom.assigned_user_id,
            )
            if not assigned_user_id:
                raise ValidationError(f"{custom.department_owner} department has checkpoints assigned but no team member selected.")
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
            workflow_state=IN_PROGRESS if payload.workflow_state == "TODO" else UNDER_PREPARATION,
            initiator_user_id=current_user.id,
            team_leader_user_id=payload.team_leader_user_id,
            area_owner_user_id=None,
            due_date=payload.due_date,
            submitted_at=now if payload.workflow_state == "TODO" else None,
        )
        db.add(workflow)
        db.flush()

        for item in payload.assignments:
            assignment = PSSRTeamMemberAssignment(
                pssr_id=pssr_id,
                department=item.department,
                user_id=item.user_id,
                assigned_by_user_id=current_user.id,
                status=UNDER_PREPARATION,
                due_date=item.due_date or payload.due_date,
            )
            db.add(assignment)
        db.flush()
        saved_assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        logger.info(
            "savedDepartmentAssignments=%s",
            [
                {
                    "department": assignment.department,
                    "assignedMemberId": assignment.user_id,
                    "assignedMemberName": users.get(assignment.user_id).full_name if users.get(assignment.user_id) else None,
                }
                for assignment in saved_assignments
            ],
        )

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
                selected = selected_question_payloads.get((question.annexure_id, question.id))
                selected_department = selected.department_owner if selected else (question.department_owner or question.checked_by_department)
                department_owner = PSSRWorkflowService._checkpoint_department(selected_department)
                assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                    assignment_by_department,
                    department_owner,
                    selected.assigned_user_id if selected else None,
                )
                persisted_department = assigned_department or department_owner
                sequence += 1
                frozen = PSSRQuestion(
                    pssr_id=pssr_id,
                    annexure_id=annexure.id,
                    annexure_question_id=question.id,
                    question_text=question.question_text,
                    question_description=question.help_text or question.expected_evidence or question.guidance_notes,
                    question_type=(selected.question_type if selected else None) or question.question_type or "FIELD",
                    response_type=question.response_type if question.response_type in {"YES_NO", "YES_NO_NA"} else "YES_NO_NA",
                    department_owner=persisted_department,
                    assigned_user_id=assigned_user_id,
                    category=question.category,
                    mandatory=question.required,
                    custom=False,
                    sequence=sequence,
                    created_by_user_id=current_user.id,
                )
                db.add(frozen)
                logger.info(
                    "generatedCheckpointAssignments checkpoint.department=%s checkpoint.assignedTo=%s sourceDepartment=%s questionId=%s",
                    persisted_department,
                    assigned_user_id,
                    department_owner,
                    question.id,
                )

        for custom in payload.custom_questions:
            assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                assignment_by_department,
                custom.department_owner,
                custom.assigned_user_id,
            )
            persisted_department = assigned_department or custom.department_owner
            sequence += 1
            db.add(PSSRQuestion(
                pssr_id=pssr_id,
                question_text=custom.question_text,
                question_description=custom.description,
                question_type=custom.question_type,
                response_type="YES_NO_NA",
                department_owner=persisted_department,
                assigned_user_id=assigned_user_id,
                category=custom.category,
                mandatory=custom.mandatory,
                custom=True,
                remarks=custom.remarks,
                attachments=custom.attachments,
                sequence=sequence,
                created_by_user_id=current_user.id,
            ))
            logger.info(
                "generatedCheckpointAssignments checkpoint.department=%s checkpoint.assignedTo=%s sourceDepartment=%s questionId=%s",
                persisted_department,
                assigned_user_id,
                custom.department_owner,
                "custom",
            )

        db.flush()
        question_count = db.query(func.count(PSSRQuestion.id)).filter(PSSRQuestion.pssr_id == pssr_id).scalar() or 0
        if payload.workflow_state == "TODO":
            PSSRWorkflowService._validate_checkpoint_assignments(db, pssr_id)
            active_assignment_ids = set(PSSRWorkflowService._active_assignment_ids(db, pssr_id))
            submitted_assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
            for assignment in submitted_assignments:
                assignment.status = "PENDING" if assignment.id in active_assignment_ids else "NOT_APPLICABLE"
                assignment.updated_at = now
                if assignment.id in active_assignment_ids:
                    PSSRWorkflowService._notify_assignment(db, workflow, assignment, current_user)
            if payload.team_leader_user_id:
                db.add(PSSRNotification(
                    pssr_id=workflow.pssr_id,
                    recipient_user_id=payload.team_leader_user_id,
                    notification_type="TEAM_LEADER_ASSIGNMENT",
                    title=f"PSSR assigned for leadership: {workflow.pssr_id}",
                    body=f"{current_user.full_name} assigned you as team leader for {workflow.plant_unit}.",
                    link=f"/team/assigned?pssr_id={workflow.pssr_id}",
                ))
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "CREATE", f"PSSR {pssr_id} created.", {"questions": question_count})
        if payload.workflow_state == "TODO":
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_SUBMITTED", f"PSSR {pssr_id} submitted to assigned departments.", {"target_state": IN_PROGRESS})
        else:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "SAVE_DRAFT", f"PSSR {pssr_id} saved as draft.", {"target_state": UNDER_PREPARATION})
        db.add(PSSRActivityLog(
            pssr_id=pssr_id,
            user_id=current_user.id,
            area_owner_user_id=None,
            action="PSSR Created",
            detail=f"{title} created with {len(payload.assignments)} assignment(s).",
            timestamp=now.isoformat(),
        ))
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def submit(db: Session, pssr_id: str, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        if normalize_state(workflow.workflow_state) not in {UNDER_PREPARATION, REJECTED}:
            raise ValidationError(f"PSSR workflow cannot be submitted from {workflow.workflow_state}.")
        if workflow.initiator_user_id != current_user.id:
            raise AuthorizationError("Only the PSSR initiator can submit this draft.")

        now = datetime.utcnow()
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        if not assignments:
            raise ValidationError("At least one department assignment is required before submission.")
        PSSRWorkflowService._validate_checkpoint_assignments(db, pssr_id)
        active_assignment_ids = set(PSSRWorkflowService._active_assignment_ids(db, pssr_id))

        workflow.workflow_state = IN_PROGRESS
        workflow.started_at = workflow.started_at or now
        workflow.started_by_user_id = workflow.started_by_user_id or current_user.id
        workflow.submitted_at = now
        workflow.updated_at = now
        for assignment in assignments:
            assignment.status = "PENDING" if assignment.id in active_assignment_ids else "NOT_APPLICABLE"
            assignment.updated_at = now
            if assignment.id in active_assignment_ids:
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

        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_SUBMITTED", f"PSSR {pssr_id} submitted to assigned departments.", {"target_state": IN_PROGRESS})
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
    def update(db: Session, pssr_id: str, payload: PSSREditRequest, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        state = normalize_state(workflow.workflow_state)
        if state in TERMINAL_STATES:
            raise ValidationError("Closed PSSR workflows cannot be edited.")
        if workflow.initiator_user_id != current_user.id:
            raise AuthorizationError("Only the PSSR initiator can edit this workflow.")
        if payload.moc_type == "MOC" and not payload.moc_number:
            raise ValidationError("MOC number is required for MOC PSSR.")
        if not payload.assignments:
            raise ValidationError("At least one department team member assignment is required.")
        if not payload.questions:
            raise ValidationError("At least one checkpoint is required.")

        assignment_departments = [item.department.strip() for item in payload.assignments]
        if len(assignment_departments) != len(set(assignment_departments)):
            raise ValidationError("Only one PSSR team member can be assigned per department.")
        assignment_user_ids = [item.user_id for item in payload.assignments]
        user_ids = set(assignment_user_ids)
        if payload.team_leader_user_id:
            user_ids.add(payload.team_leader_user_id)
        if payload.area_owner_user_id:
            user_ids.add(payload.area_owner_user_id)
        for question in payload.questions:
            if question.assigned_user_id:
                user_ids.add(question.assigned_user_id)
        users = {user.id: user for user in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

        for assignment in payload.assignments:
            user = users.get(assignment.user_id)
            if not user or not user.active:
                raise ValidationError(f"Assigned user {assignment.user_id} is not active.")
            if not PSSRWorkflowService._department_matches(assignment.department, user.department):
                raise ValidationError(f"{user.full_name} is not valid for {assignment.department} assignment.")
        if payload.team_leader_user_id and (not users.get(payload.team_leader_user_id) or not users[payload.team_leader_user_id].active):
            raise ValidationError("Selected PSSR team leader is not active.")
        if payload.area_owner_user_id:
            area_owner = users.get(payload.area_owner_user_id)
            if not area_owner or not area_owner.active or PSSRWorkflowService._role(area_owner) != UserRole.AREA_OWNER.value:
                raise ValidationError("Selected Area Owner is not an active AREA_OWNER user.")

        assignment_by_department = PSSRWorkflowService._assignment_user_by_department(payload.assignments)
        for question in payload.questions:
            assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                assignment_by_department,
                question.department_owner,
                question.assigned_user_id,
            )
            if not assigned_user_id:
                raise ValidationError(f"{question.department_owner} department has checkpoints assigned but no team member selected.")
            PSSRWorkflowService._ensure_checkpoint_assignment(payload.assignments, users, question.department_owner, assigned_user_id)

        selected_annexure_ids = set(payload.annexure_ids)
        if selected_annexure_ids:
            annexure_count = db.query(func.count(Annexure.id)).filter(
                Annexure.id.in_(selected_annexure_ids),
                Annexure.active.is_(True),
                Annexure.is_deleted.is_(False),
            ).scalar() or 0
            if annexure_count != len(selected_annexure_ids):
                raise ValidationError("One or more selected annexures are inactive or unavailable.")

        now = datetime.utcnow()
        header_changes = {}
        for field, value in {
            "plant_unit": payload.plant_unit,
            "equipment_system": payload.equipment_system,
            "moc_type": payload.moc_type,
            "moc_number": payload.moc_number,
            "description": payload.description,
            "team_leader_user_id": payload.team_leader_user_id,
            "area_owner_user_id": payload.area_owner_user_id,
        }.items():
            old_value = getattr(workflow, field)
            if old_value != value:
                header_changes[field] = {"old": old_value, "new": value}
                setattr(workflow, field, value)
        workflow.title = f"{payload.plant_unit} - {payload.equipment_system}"
        workflow.updated_at = now

        if "area_owner_user_id" in header_changes:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "AREA_OWNER_CHANGED", "Area owner assignment changed.", header_changes["area_owner_user_id"])
        if header_changes:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "PSSR_EDITED", "PSSR header edited by initiator.", header_changes)

        existing_assignments = {
            assignment.department: assignment
            for assignment in db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        }
        requested_departments = set()
        for item in payload.assignments:
            requested_departments.add(item.department)
            assignment = existing_assignments.get(item.department)
            if assignment:
                changes = {}
                if assignment.user_id != item.user_id:
                    if assignment.status == "COMPLETED":
                        raise ValidationError(f"{item.department} is completed. Reopen the department before reassigning its member.")
                    changes["user_id"] = {"old": assignment.user_id, "new": item.user_id}
                    assignment.user_id = item.user_id
                    assignment.status = "PENDING" if state != UNDER_PREPARATION else UNDER_PREPARATION
                    assignment.started_at = None
                    assignment.completed_at = None
                if assignment.due_date != item.due_date:
                    changes["due_date"] = {"old": assignment.due_date.isoformat() if assignment.due_date else None, "new": item.due_date.isoformat() if item.due_date else None}
                    assignment.due_date = item.due_date
                if changes:
                    assignment.updated_at = now
                    PSSRWorkflowService._audit(db, pssr_id, current_user.id, "TEAM_MEMBER_CHANGED", f"Team member assignment changed for {item.department}.", {"department": item.department, **changes})
            else:
                db.add(PSSRTeamMemberAssignment(
                    pssr_id=pssr_id,
                    department=item.department,
                    user_id=item.user_id,
                    assigned_by_user_id=current_user.id,
                    status="PENDING" if state != UNDER_PREPARATION else UNDER_PREPARATION,
                    due_date=item.due_date,
                ))
                PSSRWorkflowService._audit(db, pssr_id, current_user.id, "TEAM_MEMBER_CHANGED", f"Team member assignment added for {item.department}.", {"department": item.department, "user_id": item.user_id})
        for department, assignment in existing_assignments.items():
            if department not in requested_departments:
                question_count = len(PSSRWorkflowService._questions_for_assignment(db, pssr_id, department))
                if question_count:
                    raise ValidationError(f"Cannot remove {department} assignment while checkpoints still belong to that department.")
                db.delete(assignment)
                PSSRWorkflowService._audit(db, pssr_id, current_user.id, "TEAM_MEMBER_CHANGED", f"Team member assignment removed for {department}.", {"department": department, "user_id": assignment.user_id})

        existing_annexures = {
            selection.annexure_id: selection
            for selection in db.query(PSSRAnnexureSelection).filter(PSSRAnnexureSelection.pssr_id == pssr_id).all()
        }
        added_annexure_ids = selected_annexure_ids - set(existing_annexures)
        for annexure_id in added_annexure_ids:
            annexure = db.query(Annexure).filter(Annexure.id == annexure_id).first()
            db.add(PSSRAnnexureSelection(
                pssr_id=pssr_id,
                annexure_id=annexure_id,
                revision=annexure.revision if annexure else "current",
                selected_by_user_id=current_user.id,
            ))
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "ANNEXURE_UPDATED", "Annexure added to workflow.", {"annexure_id": annexure_id})
        for annexure_id, selection in existing_annexures.items():
            if annexure_id not in selected_annexure_ids:
                db.delete(selection)
                PSSRWorkflowService._audit(db, pssr_id, current_user.id, "ANNEXURE_UPDATED", "Annexure removed from workflow.", {"annexure_id": annexure_id})

        existing_questions = {
            question.id: question
            for question in db.query(PSSRQuestion).filter(PSSRQuestion.pssr_id == pssr_id).all()
        }
        payload_question_ids = {question.id for question in payload.questions if question.id}
        for question_id, question in existing_questions.items():
            annexure_removed = question.annexure_id is not None and question.annexure_id not in selected_annexure_ids
            if question_id not in payload_question_ids or annexure_removed:
                db.query(PSSRQuestionResponse).filter(PSSRQuestionResponse.pssr_question_id == question_id).delete(synchronize_session=False)
                db.delete(question)
                PSSRWorkflowService._audit(db, pssr_id, current_user.id, "CHECKPOINT_REASSIGNED", "Checkpoint removed from workflow.", {"question_id": question_id, "department": question.department_owner, "annexure_removed": annexure_removed})

        next_sequence = 0
        for item in payload.questions:
            next_sequence += 1
            assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                assignment_by_department,
                item.department_owner,
                item.assigned_user_id,
            )
            persisted_department = assigned_department or item.department_owner
            if item.id and item.id in existing_questions:
                question = existing_questions[item.id]
                changes = {}
                for field, value in {
                    "question_text": item.question_text,
                    "question_description": item.description,
                    "question_type": item.question_type,
                    "department_owner": persisted_department,
                    "assigned_user_id": assigned_user_id,
                    "category": item.category,
                    "mandatory": item.mandatory,
                    "remarks": item.remarks,
                    "sequence": next_sequence,
                }.items():
                    old_value = getattr(question, field)
                    if old_value != value:
                        changes[field] = {"old": old_value, "new": value}
                        setattr(question, field, value)
                if changes:
                    question.status = "PENDING" if {"department_owner", "assigned_user_id"} & set(changes) else question.status
                    question.updated_at = now
                    PSSRWorkflowService._audit(db, pssr_id, current_user.id, "CHECKPOINT_REASSIGNED", f"Checkpoint {question.id} updated.", {"question_id": question.id, **changes})
            else:
                db.add(PSSRQuestion(
                    pssr_id=pssr_id,
                    annexure_id=item.annexure_id,
                    annexure_question_id=item.annexure_question_id,
                    question_text=item.question_text,
                    question_description=item.description,
                    question_type=item.question_type,
                    response_type="YES_NO_NA",
                    department_owner=persisted_department,
                    assigned_user_id=assigned_user_id,
                    category=item.category,
                    mandatory=item.mandatory,
                    custom=True,
                    remarks=item.remarks,
                    attachments=item.attachments,
                    sequence=next_sequence,
                    created_by_user_id=current_user.id,
                ))
                PSSRWorkflowService._audit(db, pssr_id, current_user.id, "CHECKPOINT_REASSIGNED", "Checkpoint added to workflow.", {"department": persisted_department, "source_department": item.department_owner, "assigned_user_id": assigned_user_id})
                logger.info(
                    "generatedCheckpointAssignments checkpoint.department=%s checkpoint.assignedTo=%s sourceDepartment=%s questionId=%s",
                    persisted_department,
                    assigned_user_id,
                    item.department_owner,
                    item.id or "new",
                )

        retained_source_keys = {
            (item.annexure_id, item.annexure_question_id)
            for item in payload.questions
            if item.annexure_id and item.annexure_question_id
        }
        existing_source_keys = {
            (question.annexure_id, question.annexure_question_id)
            for question in existing_questions.values()
            if question.annexure_id in selected_annexure_ids and question.annexure_question_id
        } | retained_source_keys
        annexure_questions = (
            db.query(AnnexureQuestion)
            .filter(AnnexureQuestion.annexure_id.in_(added_annexure_ids), AnnexureQuestion.active.is_(True))
            .order_by(AnnexureQuestion.annexure_id.asc(), AnnexureQuestion.sort_order.asc(), AnnexureQuestion.id.asc())
            .all()
        ) if added_annexure_ids else []
        for annexure_question in annexure_questions:
            source_key = (annexure_question.annexure_id, annexure_question.id)
            if source_key in existing_source_keys:
                continue
            department_owner = PSSRWorkflowService._checkpoint_department(annexure_question.department_owner or annexure_question.checked_by_department)
            assigned_department, assigned_user_id = PSSRWorkflowService._resolved_assignment_for_department(
                assignment_by_department,
                department_owner,
            )
            if not assigned_user_id:
                raise ValidationError(f"{department_owner} department has checkpoints assigned but no team member selected.")
            persisted_department = assigned_department or department_owner
            next_sequence += 1
            db.add(PSSRQuestion(
                pssr_id=pssr_id,
                annexure_id=annexure_question.annexure_id,
                annexure_question_id=annexure_question.id,
                question_text=annexure_question.question_text,
                question_description=annexure_question.help_text or annexure_question.expected_evidence or annexure_question.guidance_notes,
                question_type=annexure_question.question_type or "FIELD",
                response_type=annexure_question.response_type if annexure_question.response_type in {"YES_NO", "YES_NO_NA"} else "YES_NO_NA",
                department_owner=persisted_department,
                assigned_user_id=assigned_user_id,
                category=annexure_question.category,
                mandatory=annexure_question.required,
                custom=False,
                sequence=next_sequence,
                created_by_user_id=current_user.id,
            ))
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "ANNEXURE_UPDATED", "Annexure checkpoint added to workflow.", {"annexure_id": annexure_question.annexure_id, "annexure_question_id": annexure_question.id, "department": persisted_department, "source_department": department_owner})
            logger.info(
                "generatedCheckpointAssignments checkpoint.department=%s checkpoint.assignedTo=%s sourceDepartment=%s questionId=%s",
                persisted_department,
                assigned_user_id,
                department_owner,
                annexure_question.id,
            )

        db.flush()
        active_assignment_ids = set(PSSRWorkflowService._active_assignment_ids(db, pssr_id))
        for assignment in db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all():
            if assignment.id not in active_assignment_ids and assignment.status != "NOT_APPLICABLE":
                assignment.status = "NOT_APPLICABLE"
                assignment.updated_at = now
            elif assignment.id in active_assignment_ids and assignment.status == "NOT_APPLICABLE":
                assignment.status = "PENDING" if state != UNDER_PREPARATION else UNDER_PREPARATION
                assignment.updated_at = now
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "PSSR_EDITED", "PSSR workflow edit saved.", {"question_count": len(payload.questions), "assignment_count": len(payload.assignments)})
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user, now)
        db.add(PSSRActivityLog(
            pssr_id=pssr_id,
            user_id=current_user.id,
            area_owner_user_id=workflow.area_owner_user_id,
            action="PSSR Edited",
            detail="Initiator updated workflow assignments, checkpoints, or ownership.",
            timestamp=now.isoformat(),
        ))
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def reopen_department_work(db: Session, pssr_id: str, departments: list[str], confirmed: bool, current_user: User) -> dict:
        if not confirmed:
            raise ValidationError("Confirmation is required to reopen department work.")
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        if normalize_state(workflow.workflow_state) in TERMINAL_STATES:
            raise ValidationError("Closed PSSR workflows cannot be reopened.")
        if workflow.initiator_user_id != current_user.id:
            raise AuthorizationError("Only the PSSR initiator can reopen department work.")
        now = datetime.utcnow()
        reopened = []
        for department in departments:
            assignment = db.query(PSSRTeamMemberAssignment).filter(
                PSSRTeamMemberAssignment.pssr_id == pssr_id,
                PSSRTeamMemberAssignment.department == department,
            ).first()
            if not assignment:
                continue
            assignment.status = "REOPENED" if normalize_state(workflow.workflow_state) != UNDER_PREPARATION else UNDER_PREPARATION
            assignment.completed_at = None
            assignment.updated_at = now
            for question in PSSRWorkflowService._questions_for_assignment(db, pssr_id, department):
                question.status = "PENDING"
                question.updated_at = now
            reopened.append(department)
        if not reopened:
            raise ValidationError("No matching department work was found to reopen.")
        workflow.workflow_state = IN_PROGRESS
        workflow.updated_at = now
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "DEPARTMENT_REOPENED", "Department work reopened by initiator.", {"departments": reopened})
        db.add(PSSRActivityLog(
            pssr_id=pssr_id,
            user_id=current_user.id,
            area_owner_user_id=workflow.area_owner_user_id,
            action="Department Reopened",
            detail=f"Reopened department work: {', '.join(reopened)}.",
            timestamp=now.isoformat(),
        ))
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def get(db: Session, pssr_id: str, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        PSSRWorkflowService._ensure_workflow_access(db, workflow, current_user)
        questions_query = db.query(PSSRQuestion).filter(PSSRQuestion.pssr_id == pssr_id)
        permissions = PSSRWorkflowService._permissions(db, workflow, current_user)
        if (
            permissions["is_assigned_member"]
            and not permissions["is_initiator"]
            and not permissions["is_team_leader"]
            and not permissions["is_admin"]
        ):
            questions_query = questions_query.filter(PSSRQuestion.assigned_user_id == current_user.id)
        questions = questions_query.order_by(PSSRQuestion.sequence.asc(), PSSRQuestion.id.asc()).all()
        responses = {
            row.pssr_question_id: row
            for row in db.query(PSSRQuestionResponse).filter(PSSRQuestionResponse.pssr_id == pssr_id).all()
        }
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        question_user_ids = {item.assigned_user_id for item in questions if item.assigned_user_id}
        punch_points = (
            db.query(AnnexurePunchPoint)
            .filter(AnnexurePunchPoint.pssr_id == pssr_id)
            .order_by(AnnexurePunchPoint.updated_at.desc())
            .all()
        )
        punch_user_ids = {item.assigned_to_user_id for item in punch_points if item.assigned_to_user_id}
        assignment_user_ids = list({item.user_id for item in assignments if item.user_id} | question_user_ids | punch_user_ids)
        users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(assignment_user_ids)).all()
        } if assignment_user_ids else {}
        annexures = db.query(PSSRAnnexureSelection, Annexure).join(
            Annexure,
            Annexure.id == PSSRAnnexureSelection.annexure_id,
        ).filter(PSSRAnnexureSelection.pssr_id == pssr_id).all()
        audit_rows = db.query(PSSRAuditLog).filter(PSSRAuditLog.pssr_id == pssr_id).order_by(PSSRAuditLog.created_at.asc()).limit(100).all()
        audit_user_ids = list({row.actor_user_id for row in audit_rows if row.actor_user_id})
        audit_users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(audit_user_ids)).all()
        } if audit_user_ids else {}
        editable_departments = set(permissions["editable_departments"])
        active_assignment_ids = set(PSSRWorkflowService._active_assignment_ids(db, pssr_id))
        return {
            **PSSRWorkflowService._summary(db, workflow),
            "permissions": permissions,
            "assignments": [
                PSSRWorkflowService._assignment_dict(
                    item,
                    users.get(item.user_id),
                    effective_status=item.status if item.id in active_assignment_ids else "NOT_APPLICABLE",
                )
                for item in assignments
            ],
            "questions": [
                PSSRWorkflowService._question_dict(
                    item,
                    responses.get(item.id),
                    assigned_user=users.get(item.assigned_user_id),
                    can_answer=(
                        PSSRWorkflowService._answers_editable(workflow)
                        and (
                            (item.assigned_user_id == current_user.id)
                            or any(
                                PSSRWorkflowService._department_matches(department, item.department_owner)
                                or PSSRWorkflowService._department_matches(item.department_owner, department)
                                for department in editable_departments
                            )
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
                    "assigned_to_user": PSSRWorkflowService._user_brief(users.get(row.assigned_to_user_id)),
                    "question_id": row.question_id,
                    "workflow_reference": row.pssr_id,
                    "due_date": row.due_date.isoformat() if row.due_date else None,
                    "remarks": row.closure_remarks,
                    "created_at": row.raised_at.isoformat(),
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
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
        if not PSSRWorkflowService._answers_editable(workflow):
            raise ValidationError("PSSR responses are locked after Area Owner Approval routing.")
        if PSSRWorkflowService._role(current_user) == UserRole.ADMIN.value:
            raise AuthorizationError("Admin users have supervisory read-only access and cannot answer PSSR questions.")
        question = db.query(PSSRQuestion).filter(PSSRQuestion.id == question_id, PSSRQuestion.pssr_id == pssr_id).first()
        if not question:
            raise ResourceNotFoundError("PSSR question", question_id)
        PSSRWorkflowService._ensure_question_actor(db, workflow, question, current_user)
        now = datetime.utcnow()
        if state in {TODO, REJECTED, COMPLETED_BY_TEAM}:
            workflow.workflow_state = IN_PROGRESS
            workflow.started_at = workflow.started_at or now
            workflow.started_by_user_id = workflow.started_by_user_id or current_user.id
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_IN_PROGRESS", f"PSSR {pssr_id} moved to in-progress by first question response.", {"source": "QUESTION_RESPONSE"})
        db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.user_id == current_user.id,
            PSSRTeamMemberAssignment.status.in_(["PENDING", "REOPENED"]),
        ).update({"status": "IN_PROGRESS", "started_at": now, "updated_at": now}, synchronize_session=False)
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
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "QUESTION_RESPONSE", f"Question {question.id} answered {payload.response}.", {"department": question.department_owner})
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user, now)
        db.commit()
        return PSSRWorkflowService._question_dict(question, response)

    @staticmethod
    def complete_my_side(db: Session, pssr_id: str, confirmed: bool, current_user: User) -> dict:
        if not confirmed:
            raise ValidationError("Confirmation is required to complete your side.")
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        state = normalize_state(workflow.workflow_state)
        if state not in {TODO, IN_PROGRESS}:
            raise ValidationError("Only submitted or in-progress PSSR work can be completed from your side.")
        active_assignment_ids = PSSRWorkflowService._active_assignment_ids(db, pssr_id)
        assignments = db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.user_id == current_user.id,
            PSSRTeamMemberAssignment.id.in_(active_assignment_ids),
            PSSRTeamMemberAssignment.status.notin_(["MEMBER_COMPLETED", "COMPLETED", "NOT_APPLICABLE"]),
        ).all()
        if not assignments:
            raise AuthorizationError("No editable assigned PSSR work remains for your user.")

        now = datetime.utcnow()
        completed_departments = []
        for assignment in assignments:
            pending = PSSRWorkflowService._pending_required_question_count_for_assignment(
                db,
                pssr_id,
                assignment.department,
                current_user.id,
            )
            if pending:
                raise ValidationError(f"Answer all mandatory checkpoints for {assignment.department} before completing your side.")
            assignment.status = "MEMBER_COMPLETED"
            assignment.updated_at = now
            if not assignment.started_at:
                assignment.started_at = now
            completed_departments.append(assignment.department)

        if state == TODO:
            workflow.workflow_state = IN_PROGRESS
            workflow.started_at = workflow.started_at or now
            workflow.started_by_user_id = workflow.started_by_user_id or current_user.id
        PSSRWorkflowService._audit(
            db,
            pssr_id,
            current_user.id,
            "MEMBER_COMPLETED",
            f"{current_user.full_name} completed assigned PSSR work. Leader finalization is pending.",
            {"departments": completed_departments},
        )
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user, now)
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def finalize_department_work(db: Session, pssr_id: str, department: Optional[str], confirmed: bool, current_user: User) -> dict:
        if not confirmed:
            raise ValidationError("Confirmation is required to finalize department work.")
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        state = normalize_state(workflow.workflow_state)
        if state not in {TODO, IN_PROGRESS, COMPLETED_BY_TEAM}:
            raise ValidationError("Department work can only be finalized during execution.")
        if current_user.id not in {workflow.team_leader_user_id, workflow.initiator_user_id}:
            raise AuthorizationError("Only the team leader can complete work from the department side.")

        query = db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.status == "MEMBER_COMPLETED",
        )
        if department:
            query = query.filter(PSSRTeamMemberAssignment.department == department)
        assignments = query.all()
        if not assignments:
            raise ValidationError("No member-completed department work is ready for leader finalization.")

        now = datetime.utcnow()
        finalized_departments = []
        for assignment in assignments:
            if not PSSRWorkflowService._assignment_required_questions_answered(db, pssr_id, assignment.department, assignment.user_id):
                raise ValidationError(f"Mandatory checkpoints are still pending for {assignment.department}.")
            if PSSRWorkflowService._open_punch_point_count(db, pssr_id, assignment.department):
                raise ValidationError(f"Open punchlist items must be closed for {assignment.department} before department completion.")
            assignment.status = "COMPLETED"
            assignment.completed_at = now
            assignment.updated_at = now
            finalized_departments.append(assignment.department)

        if state == TODO:
            workflow.workflow_state = IN_PROGRESS
            workflow.started_at = workflow.started_at or now
            workflow.started_by_user_id = workflow.started_by_user_id or current_user.id
        PSSRWorkflowService._audit(
            db,
            pssr_id,
            current_user.id,
            "LEADER_FINALIZED",
            "Department work finalized by leader/initiator.",
            {"departments": finalized_departments},
        )
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user, now)
        db.commit()
        return PSSRWorkflowService.get(db, pssr_id, current_user)

    @staticmethod
    def create_punch_point(db: Session, pssr_id: str, payload: PSSRPunchPointRequest, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        PSSRWorkflowService._ensure_punch_editor(workflow, current_user)
        PSSRWorkflowService._ensure_punch_assignment_scope(db, pssr_id, payload)
        punch = AnnexurePunchPoint(
            pssr_id=pssr_id,
            question_id=payload.question_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            severity=PSSRWorkflowService._severity_for_category(payload.category),
            status=payload.status,
            owning_department=payload.owning_department,
            assigned_to_user_id=payload.assigned_to_user_id,
            due_date=payload.due_date,
            closure_remarks=payload.closure_remarks,
            raised_by_user_id=current_user.id,
        )
        db.add(punch)
        db.flush()
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "PUNCH_CREATED", f"Punchlist item created: {payload.title}.", {"department": payload.owning_department})
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user)
        db.commit()
        return PSSRWorkflowService._punch_dict(punch)

    @staticmethod
    def update_punch_point(db: Session, pssr_id: str, punch_point_id: int, payload: PSSRPunchPointRequest, current_user: User) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        PSSRWorkflowService._ensure_punch_editor(workflow, current_user)
        punch = db.query(AnnexurePunchPoint).filter(
            AnnexurePunchPoint.id == punch_point_id,
            AnnexurePunchPoint.pssr_id == pssr_id,
        ).first()
        if not punch:
            raise ResourceNotFoundError("Punchlist item", punch_point_id)
        PSSRWorkflowService._ensure_punch_assignment_scope(db, pssr_id, payload)
        punch.title = payload.title
        punch.description = payload.description
        punch.category = payload.category
        punch.severity = PSSRWorkflowService._severity_for_category(payload.category)
        punch.status = payload.status
        punch.owning_department = payload.owning_department
        punch.assigned_to_user_id = payload.assigned_to_user_id
        punch.due_date = payload.due_date
        punch.closure_remarks = payload.closure_remarks
        punch.updated_at = datetime.utcnow()
        PSSRWorkflowService._audit(db, pssr_id, current_user.id, "PUNCH_UPDATED", f"Punchlist item updated: {payload.title}.", {"department": payload.owning_department, "status": payload.status})
        PSSRWorkflowService._refresh_workflow_state(db, workflow, current_user)
        db.commit()
        return PSSRWorkflowService._punch_dict(punch)

    @staticmethod
    def transition(db: Session, pssr_id: str, target_state: str, current_user: User, remarks: Optional[str] = None, area_owner_user_id: Optional[int] = None) -> dict:
        workflow = PSSRWorkflowService._get_workflow(db, pssr_id)
        target_state = normalize_state(target_state)
        current_state = normalize_state(workflow.workflow_state)
        PSSRWorkflowService._ensure_transition_actor(db, workflow, target_state, current_user)
        allowed = TRANSITIONS.get(current_state, set())
        if target_state not in allowed:
            raise ValidationError(f"Cannot transition from {workflow.workflow_state} to {target_state}.")
        if target_state == PENDING_APPROVAL and area_owner_user_id:
            area_owner = db.query(User).filter(User.id == area_owner_user_id).first()
            if not area_owner or not area_owner.active or PSSRWorkflowService._role(area_owner) != UserRole.AREA_OWNER.value:
                raise ValidationError("Selected Area Owner is not an active AREA_OWNER user.")
            workflow.area_owner_user_id = area_owner_user_id
        if target_state == PENDING_APPROVAL and not PSSRWorkflowService._area_owner_ready(db, workflow):
            raise ValidationError("Cannot send to Area Owner until all active departments are leader-finalized and an Area Owner is assigned.")
        if target_state == REJECTED:
            workflow.workflow_state = REJECTED
            workflow.updated_at = datetime.utcnow()
            active_assignment_ids = PSSRWorkflowService._active_assignment_ids(db, workflow.pssr_id)
            if active_assignment_ids:
                db.query(PSSRTeamMemberAssignment).filter(
                    PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
                    PSSRTeamMemberAssignment.id.in_(active_assignment_ids),
                    PSSRTeamMemberAssignment.status == "COMPLETED",
                ).update({"status": "IN_PROGRESS", "updated_at": workflow.updated_at}, synchronize_session=False)
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "AREA_OWNER_REJECTED", "Area owner requested rework.", {"remarks": remarks})
            db.add(PSSRActivityLog(
                pssr_id=workflow.pssr_id,
                user_id=current_user.id,
                area_owner_user_id=workflow.area_owner_user_id,
                action="Area Owner Rework",
                detail="Area owner rejected the workflow and sent it back to the initiator.",
                timestamp=workflow.updated_at.isoformat(),
            ))
            db.commit()
            return PSSRWorkflowService.get(db, pssr_id, current_user)
        if target_state in {IN_PROGRESS, COMPLETED_BY_TEAM}:
            raise ValidationError("Workflow execution state is controlled by question completion and punchlist status.")
        workflow.workflow_state = target_state
        now = datetime.utcnow()
        workflow.updated_at = now
        if target_state == APPROVED:
            workflow.approved_at = now
        if target_state == CLOSED:
            if current_state != APPROVED:
                raise ValidationError("Cannot close workflow before Area Owner approval.")
            workflow.closed_at = now
        if target_state == PENDING_APPROVAL:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "SUBMITTED_TO_AREA_OWNER", f"Workflow submitted to area owner for approval.", {"remarks": remarks})
            if workflow.area_owner_user_id:
                db.add(PSSRNotification(
                    pssr_id=workflow.pssr_id,
                    recipient_user_id=workflow.area_owner_user_id,
                    notification_type="AREA_OWNER_APPROVAL",
                    title=f"PSSR awaiting approval: {workflow.pssr_id}",
                    body=f"{current_user.full_name} routed {workflow.plant_unit} PSSR for area owner approval.",
                    link=f"/area-owner/dashboard?pssr_id={workflow.pssr_id}",
                ))
        elif target_state == APPROVED:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "AREA_OWNER_APPROVED", f"Area owner approved workflow.", {"remarks": remarks})
        elif target_state == REJECTED:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "AREA_OWNER_REJECTED", f"Area owner rejected workflow.", {"remarks": remarks})
        elif target_state == CLOSED:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_CLOSED", "Workflow closed by initiator.", {"remarks": remarks})
        else:
            PSSRWorkflowService._audit(db, pssr_id, current_user.id, "WORKFLOW_TRANSITION", f"Workflow moved to {target_state}.", {"remarks": remarks})
        db.add(PSSRActivityLog(
            pssr_id=workflow.pssr_id,
            user_id=current_user.id,
            area_owner_user_id=workflow.area_owner_user_id,
            action="Workflow Updated",
            detail=f"State changed from {current_state} to {target_state}.",
            timestamp=now.isoformat(),
        ))
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
        header_user_ids = [user_id for user_id in [workflow.initiator_user_id, workflow.team_leader_user_id, workflow.area_owner_user_id] if user_id]
        header_users = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(header_user_ids)).all()
        } if header_user_ids else {}
        initiator = header_users.get(workflow.initiator_user_id)
        team_leader = header_users.get(workflow.team_leader_user_id)
        area_owner = header_users.get(workflow.area_owner_user_id)
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
            "workflow_state": normalize_state(workflow.workflow_state),
            "initiator_user_id": workflow.initiator_user_id,
            "team_leader_user_id": workflow.team_leader_user_id,
            "initiator": PSSRWorkflowService._user_brief(initiator),
            "team_leader": PSSRWorkflowService._user_brief(team_leader),
            "area_owner_user_id": workflow.area_owner_user_id,
            "area_owner": PSSRWorkflowService._user_brief(area_owner),
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
            raise AuthorizationError("Team leaders have read-only workflow visibility and cannot answer checkpoints.")
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
    def _resolved_assignment_for_department(assignments: dict[str, int], owner: Optional[str], preferred_user_id: Optional[int] = None) -> tuple[Optional[str], Optional[int]]:
        for department, user_id in assignments.items():
            if preferred_user_id and user_id == preferred_user_id:
                return department, user_id
        for department, user_id in assignments.items():
            if PSSRWorkflowService._department_matches(department, owner) or PSSRWorkflowService._department_matches(owner or "", department):
                return department, user_id
        return None, preferred_user_id

    @staticmethod
    def _ensure_transition_actor(db: Session, workflow: PSSRWorkflow, target_state: str, current_user: User) -> None:
        role = PSSRWorkflowService._role(current_user)
        if role == UserRole.ADMIN.value:
            raise AuthorizationError("Admin users have supervisory read-only access and cannot modify PSSR workflows.")
        if target_state in {PENDING_APPROVAL, CLOSED} and current_user.id == workflow.initiator_user_id:
            return
        if target_state in {APPROVED, REJECTED} and current_user.id == workflow.area_owner_user_id:
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
        if e in {"operations", "operation", "pm operation"} or "pm" in e:
            return "operation" in a or "pm" in a
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
    def _assignment_dict(assignment: PSSRTeamMemberAssignment, user: Optional[User] = None, effective_status: Optional[str] = None) -> dict:
        return {
            "id": assignment.id,
            "pssr_id": assignment.pssr_id,
            "department": assignment.department,
            "user_id": assignment.user_id,
            "status": effective_status or assignment.status,
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
    def _punch_dict(row: AnnexurePunchPoint) -> dict:
        return {
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
            "remarks": row.closure_remarks,
            "created_at": row.raised_at.isoformat(),
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
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
        active_assignment_ids = set(PSSRWorkflowService._active_assignment_ids(db, workflow.pssr_id))
        if role != UserRole.ADMIN.value and PSSRWorkflowService._answers_editable(workflow):
            editable_departments = [item.department for item in assignments if item.id in active_assignment_ids]
        can_complete_my_side = False
        if assignments and state in {TODO, IN_PROGRESS} and role != UserRole.ADMIN.value:
            can_complete_my_side = any(
                item.status not in {"MEMBER_COMPLETED", "COMPLETED", "NOT_APPLICABLE"}
                and item.id in active_assignment_ids
                and PSSRWorkflowService._assignment_required_questions_answered(db, workflow.pssr_id, item.department, current_user.id)
                for item in assignments
            )
        can_finalize_department_work = (
            role != UserRole.ADMIN.value
            and state in {TODO, IN_PROGRESS, COMPLETED_BY_TEAM}
            and is_leader
            and db.query(PSSRTeamMemberAssignment.id).filter(
                PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
                PSSRTeamMemberAssignment.status == "MEMBER_COMPLETED",
            ).first() is not None
        )
        can_send_to_area_owner = (
            is_initiator
            and role != UserRole.ADMIN.value
            and state == COMPLETED_BY_TEAM
            and PSSRWorkflowService._department_work_ready_for_area_owner(db, workflow)
        )
        return {
            "is_admin": role == UserRole.ADMIN.value,
            "is_initiator": is_initiator,
            "is_team_leader": is_leader,
            "is_assigned_member": is_assigned_member,
            "can_submit": is_initiator and state in {UNDER_PREPARATION, REJECTED} and role != UserRole.ADMIN.value,
            "can_edit_header": is_initiator and state not in TERMINAL_STATES and role != UserRole.ADMIN.value,
            "can_edit_punchlist": is_initiator and PSSRWorkflowService._answers_editable(workflow) and role != UserRole.ADMIN.value,
            "can_complete_my_side": can_complete_my_side,
            "can_finalize_department_work": can_finalize_department_work,
            "can_send_to_area_owner": can_send_to_area_owner,
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
    def _ensure_punch_editor(workflow: PSSRWorkflow, current_user: User) -> None:
        if current_user.id != workflow.initiator_user_id:
            raise AuthorizationError("Only the PSSR Initiator can edit the punchlist.")
        if not PSSRWorkflowService._answers_editable(workflow):
            raise ValidationError("Closed PSSR workflows cannot be modified.")

    @staticmethod
    def _ensure_punch_assignment_scope(db: Session, pssr_id: str, payload: PSSRPunchPointRequest) -> None:
        if not payload.assigned_to_user_id:
            return
        assignment = db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.user_id == payload.assigned_to_user_id,
        ).all()
        if not any(
            PSSRWorkflowService._department_matches(item.department, payload.owning_department)
            or PSSRWorkflowService._department_matches(payload.owning_department, item.department)
            for item in assignment
        ):
            raise ValidationError("Punchlist responsible member must belong to the owning department.")

    @staticmethod
    def _severity_for_category(category: str) -> str:
        return "HIGH" if category == "A" else "MEDIUM" if category == "B" else "LOW"

    @staticmethod
    def _assignment_required_questions_answered(db: Session, pssr_id: str, department: str, user_id: int) -> bool:
        return PSSRWorkflowService._pending_required_question_count_for_assignment(db, pssr_id, department, user_id) == 0

    @staticmethod
    def _questions_for_assignment(db: Session, pssr_id: str, department: str, user_id: Optional[int] = None, *, mandatory_only: bool = False) -> list[PSSRQuestion]:
        query = db.query(PSSRQuestion).filter(PSSRQuestion.pssr_id == pssr_id)
        if user_id:
            query = query.filter(PSSRQuestion.assigned_user_id == user_id)
        if mandatory_only:
            query = query.filter(PSSRQuestion.mandatory.is_(True))
        return [
            question
            for question in query.all()
            if PSSRWorkflowService._department_matches(department, question.department_owner)
            or PSSRWorkflowService._department_matches(question.department_owner, department)
        ]

    @staticmethod
    def _pending_required_question_count_for_assignment(db: Session, pssr_id: str, department: str, user_id: int) -> int:
        questions = PSSRWorkflowService._questions_for_assignment(db, pssr_id, department, user_id, mandatory_only=True)
        if not questions:
            return 0
        question_ids = [question.id for question in questions]
        answered_ids = {
            row.pssr_question_id
            for row in db.query(PSSRQuestionResponse.pssr_question_id).filter(
                PSSRQuestionResponse.pssr_question_id.in_(question_ids),
                PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
            ).all()
        }
        return len([question for question in questions if question.id not in answered_ids])

    @staticmethod
    def _validate_checkpoint_assignments(db: Session, pssr_id: str) -> None:
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        assignment_by_department = {
            assignment.department.strip(): assignment.user_id
            for assignment in assignments
        }
        questions = db.query(PSSRQuestion).filter(PSSRQuestion.pssr_id == pssr_id).all()
        if not questions:
            raise ValidationError("At least one checkpoint is required before submission.")
        for question in questions:
            department = PSSRWorkflowService._checkpoint_department(question.department_owner)
            assigned_user_id = question.assigned_user_id or PSSRWorkflowService._assigned_user_for_department(assignment_by_department, department)
            if not assigned_user_id:
                raise ValidationError(f"{department} department has checkpoints assigned but no team member selected.")

    @staticmethod
    def _active_assignment_ids(db: Session, pssr_id: str) -> list[int]:
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        questions = db.query(PSSRQuestion.department_owner, PSSRQuestion.assigned_user_id).filter(PSSRQuestion.pssr_id == pssr_id).all()
        punch_departments = [
            row.owning_department
            for row in db.query(AnnexurePunchPoint.owning_department).filter(AnnexurePunchPoint.pssr_id == pssr_id).all()
            if row.owning_department
        ]
        active_ids = []
        for assignment in assignments:
            owns_checkpoint = any(
                question.assigned_user_id == assignment.user_id
                and (
                    PSSRWorkflowService._department_matches(assignment.department, question.department_owner)
                    or PSSRWorkflowService._department_matches(question.department_owner, assignment.department)
                )
                for question in questions
            )
            owns_punch = any(
                PSSRWorkflowService._department_matches(assignment.department, department)
                or PSSRWorkflowService._department_matches(department, assignment.department)
                for department in punch_departments
            )
            if owns_checkpoint or owns_punch:
                active_ids.append(assignment.id)
        return active_ids

    @staticmethod
    def _answers_editable(workflow: PSSRWorkflow) -> bool:
        state = normalize_state(workflow.workflow_state)
        return state not in {UNDER_PREPARATION, PENDING_APPROVAL, APPROVED, CLOSED}

    @staticmethod
    def _open_punch_point_count(db: Session, pssr_id: str, department: Optional[str] = None) -> int:
        query = db.query(func.count(AnnexurePunchPoint.id)).filter(
            AnnexurePunchPoint.pssr_id == pssr_id,
            AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
        )
        if department:
            rows = db.query(AnnexurePunchPoint.id, AnnexurePunchPoint.owning_department).filter(
                AnnexurePunchPoint.pssr_id == pssr_id,
                AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
            ).all()
            return sum(
                1
                for row in rows
                if PSSRWorkflowService._department_matches(department, row.owning_department)
                or PSSRWorkflowService._department_matches(row.owning_department or "", department)
            )
        return query.scalar() or 0

    @staticmethod
    def _area_owner_ready(db: Session, workflow: PSSRWorkflow) -> bool:
        if not workflow.area_owner_user_id:
            return False
        return PSSRWorkflowService._department_work_ready_for_area_owner(db, workflow)

    @staticmethod
    def _department_work_ready_for_area_owner(db: Session, workflow: PSSRWorkflow) -> bool:
        active_assignment_ids = PSSRWorkflowService._active_assignment_ids(db, workflow.pssr_id)
        if not active_assignment_ids:
            return False
        incomplete_assignments = db.query(func.count(PSSRTeamMemberAssignment.id)).filter(
            PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
            PSSRTeamMemberAssignment.id.in_(active_assignment_ids),
            PSSRTeamMemberAssignment.status != "COMPLETED",
        ).scalar() or 0
        if incomplete_assignments:
            return False
        if PSSRWorkflowService._open_punch_point_count(db, workflow.pssr_id):
            return False
        for assignment in db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
            PSSRTeamMemberAssignment.id.in_(active_assignment_ids),
        ).all():
            if PSSRWorkflowService._pending_required_question_count_for_assignment(db, workflow.pssr_id, assignment.department, assignment.user_id):
                return False
        return True

    @staticmethod
    def _refresh_assignment_progress(db: Session, pssr_id: str, department: str, now: Optional[datetime] = None) -> None:
        now = now or datetime.utcnow()
        assignments = db.query(PSSRTeamMemberAssignment).filter(
            PSSRTeamMemberAssignment.pssr_id == pssr_id,
            PSSRTeamMemberAssignment.status.notin_(["COMPLETED", "NOT_APPLICABLE"]),
        ).all()
        for assignment in assignments:
            if not (
                PSSRWorkflowService._department_matches(assignment.department, department)
                or PSSRWorkflowService._department_matches(department, assignment.department)
            ):
                continue
            questions = PSSRWorkflowService._questions_for_assignment(db, pssr_id, assignment.department, assignment.user_id)
            if not questions:
                continue
            question_ids = [question.id for question in questions]
            answered = db.query(func.count(PSSRQuestionResponse.id)).filter(
                PSSRQuestionResponse.pssr_question_id.in_(question_ids),
                PSSRQuestionResponse.response.in_(["YES", "NO", "NA"]),
            ).scalar() or 0
            assignment.status = "IN_PROGRESS" if answered else "PENDING"
            if answered and not assignment.started_at:
                assignment.started_at = now
            assignment.updated_at = now

    @staticmethod
    def _refresh_department_completion(db: Session, pssr_id: str, department: str, now: Optional[datetime] = None) -> None:
        now = now or datetime.utcnow()
        assignments = db.query(PSSRTeamMemberAssignment).filter(PSSRTeamMemberAssignment.pssr_id == pssr_id).all()
        for assignment in assignments:
            if not (
                PSSRWorkflowService._department_matches(assignment.department, department)
                or PSSRWorkflowService._department_matches(department, assignment.department)
            ):
                continue
            if PSSRWorkflowService._pending_required_question_count_for_assignment(db, pssr_id, assignment.department, assignment.user_id):
                continue
            assignment.status = "COMPLETED"
            assignment.completed_at = now
            assignment.updated_at = now

    @staticmethod
    def _refresh_workflow_state(db: Session, workflow: PSSRWorkflow, current_user: User, now: Optional[datetime] = None) -> None:
        state = normalize_state(workflow.workflow_state)
        if state in TERMINAL_STATES or state in {UNDER_PREPARATION}:
            return
        now = now or datetime.utcnow()
        target_state = workflow.workflow_state
        active_assignment_ids = PSSRWorkflowService._active_assignment_ids(db, workflow.pssr_id)
        assignment_total = len(active_assignment_ids)
        assignment_completed = 0
        if active_assignment_ids:
            assignment_completed = db.query(func.count(PSSRTeamMemberAssignment.id)).filter(
                PSSRTeamMemberAssignment.pssr_id == workflow.pssr_id,
                PSSRTeamMemberAssignment.id.in_(active_assignment_ids),
                PSSRTeamMemberAssignment.status == "COMPLETED",
            ).scalar() or 0

        open_punch_points = PSSRWorkflowService._open_punch_point_count(db, workflow.pssr_id)
        if state == COMPLETED_BY_TEAM and (not assignment_total or assignment_completed != assignment_total or open_punch_points):
            target_state = IN_PROGRESS
            workflow.completed_at = None
            workflow.completed_by_user_id = None

        if (
            assignment_total
            and assignment_completed == assignment_total
            and not open_punch_points
            and state != PENDING_APPROVAL
        ):
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
