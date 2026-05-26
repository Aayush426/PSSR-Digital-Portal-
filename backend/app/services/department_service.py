"""Department and refinery structure business service."""

from datetime import datetime, timezone
from math import ceil
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ResourceNotFoundError
from app.models.annexures.annexure import Annexure, AnnexureDepartment
from app.models.annexures.punch_point import AnnexurePunchPoint
from app.models.department import (
    DepartmentActivityLog,
    DepartmentAnnexureMapping,
    DepartmentAreaOwnerMapping,
    DepartmentPermissionConfig,
    DepartmentRecord,
    DepartmentUnitMapping,
    DepartmentWorkflowResponsibility,
    RefineryUnit,
)
from app.models.permissions import PermissionCode, UserPermission
from app.models.pssr_task import PSSRTask
from app.models.user import User
from app.schemas.department import (
    DepartmentAnnexureMappingRequest,
    DepartmentAreaOwnerMappingRequest,
    DepartmentCreateRequest,
    DepartmentPermissionConfigRequest,
    DepartmentUnitMappingRequest,
    DepartmentUpdateRequest,
    DepartmentWorkflowResponsibilityRequest,
)


REQUIRED_DEPARTMENTS = [
    ("SAF", "Safety", "Safety, HSE readiness, and statutory compliance."),
    ("PMO", "PM Operation", "Operations preparedness for project and maintenance handover."),
    ("PRO", "Process", "Process engineering verification and operating envelopes."),
    ("MEC", "Mechanical", "Static and rotating equipment readiness."),
    ("INS", "Inspection", "Inspection, test records, and integrity assurance."),
    ("CIV", "Civil", "Civil, structural, and access readiness."),
    ("ELE", "Electrical", "Electrical systems, energization, and isolation readiness."),
    ("INT", "Instrumental", "Instrumentation, controls, and interlock readiness."),
    ("FIR", "Fire", "Fire protection and emergency response readiness."),
    ("IT", "IT", "IT, OT, network, and digital handover readiness."),
]

DEFAULT_UNITS = [
    ("CDU", "Crude Distillation Unit", "Primary Processing"),
    ("VDU", "Vacuum Distillation Unit", "Primary Processing"),
    ("HCU", "Hydrocracker", "Conversion"),
    ("SRU", "Sulfur Recovery Unit", "Environmental"),
    ("UTL", "Utilities", "Utilities"),
    ("TNK", "Tank Farm", "Storage"),
    ("HYD", "Hydrogen Unit", "Utilities"),
]

DEFAULT_WORKFLOW_RESPONSIBILITIES = [
    ("PSSR Creation", "Supports PSSR scope, department applicability, team assignment, and due-date inputs.", "TEAM_MEMBER", False),
    ("Checklist Execution", "Owns assigned department checklist completion and evidence readiness.", "TEAM_MEMBER", False),
    ("Punch Point Resolution", "Routes department punch points to responsible discipline members.", "TEAM_MEMBER", False),
    ("Pending Area Owner Approval", "Supplies completed department evidence for area-owner approval.", "AREA_OWNER", True),
]

DEFAULT_PERMISSION_MATRIX = [
    ("VIEW_PSSR", "TEAM_MEMBER", True),
    ("EDIT_ASSIGNED_CHECKLIST", "TEAM_MEMBER", True),
    ("CREATE_PUNCH_POINT", "TEAM_MEMBER", True),
    ("UPLOAD_EVIDENCE", "TEAM_MEMBER", True),
    ("CLOSE_CHECKLIST", "TEAM_MEMBER", True),
    ("CREATE_PSSR", "TEAM_MEMBER", False),
    ("APPROVE_PSSR", "AREA_OWNER", True),
    ("MANAGE_DEPARTMENT_USERS", "ADMIN", True),
]


class DepartmentService:
    """Backend-owned refinery structure operations."""

    @staticmethod
    def seed_defaults(db: Session) -> None:
        """Create required department and unit masters if they are missing."""

        existing_departments = {
            row.code: row for row in db.query(DepartmentRecord).all()
        }
        for code, name, description in REQUIRED_DEPARTMENTS:
            if code not in existing_departments:
                db.add(DepartmentRecord(code=code, name=name, description=description, active=True))

        existing_units = {row.code: row for row in db.query(RefineryUnit).all()}
        for code, name, zone in DEFAULT_UNITS:
            if code not in existing_units:
                db.add(RefineryUnit(code=code, name=name, zone=zone, active=True))
        db.commit()

        departments = db.query(DepartmentRecord).filter(DepartmentRecord.active.is_(True)).all()
        units = db.query(RefineryUnit).filter(RefineryUnit.active.is_(True)).all()
        existing_mappings = {
            (row.department_id, row.unit_id)
            for row in db.query(DepartmentUnitMapping.department_id, DepartmentUnitMapping.unit_id).all()
        }
        for department in departments:
            for unit in units:
                if (department.id, unit.id) not in existing_mappings:
                    db.add(DepartmentUnitMapping(department_id=department.id, unit_id=unit.id))
        db.commit()
        for department in departments:
            DepartmentService._seed_department_configuration(db, department)
        db.commit()

    @staticmethod
    def list_departments(
        db: Session,
        *,
        search: Optional[str] = None,
        active: Optional[bool] = None,
        page: int = 1,
        limit: int = 50,
    ) -> dict:
        page = max(page, 1)
        limit = min(max(limit, 1), 100)
        query = db.query(DepartmentRecord)
        if active is not None:
            query = query.filter(DepartmentRecord.active.is_(active))
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    DepartmentRecord.code.ilike(pattern),
                    DepartmentRecord.name.ilike(pattern),
                    DepartmentRecord.description.ilike(pattern),
                )
            )

        total = query.count()
        records = (
            query.order_by(DepartmentRecord.active.desc(), DepartmentRecord.name.asc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return {
            "records": [DepartmentService._department_payload(db, department) for department in records],
            "pagination": {
                "page": page,
                "limit": limit,
                "total_records": total,
                "total_pages": ceil(total / limit) if limit else 0,
            },
        }

    @staticmethod
    def get_department_by_id(db: Session, department_id: int) -> DepartmentRecord:
        """Return one department master or raise a 404-compatible domain error."""

        department = db.query(DepartmentRecord).filter(DepartmentRecord.id == department_id).first()
        if not department:
            raise ResourceNotFoundError("Department", department_id)
        return department

    @staticmethod
    def create_department(
        db: Session,
        request: DepartmentCreateRequest,
        current_admin: User,
    ) -> dict:
        existing = (
            db.query(DepartmentRecord)
            .filter(or_(DepartmentRecord.code == request.code.upper(), DepartmentRecord.name == request.name))
            .first()
        )
        if existing:
            raise ConflictError("Department code or name already exists.")
        department = DepartmentRecord(
            code=request.code.upper(),
            name=request.name,
            description=request.description,
            active=True,
            created_by_user_id=current_admin.id,
            updated_by_user_id=current_admin.id,
        )
        db.add(department)
        db.commit()
        db.refresh(department)
        DepartmentService._sync_unit_mappings(db, department, request.unit_ids)
        DepartmentService._seed_department_configuration(db, department)
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def update_department(
        db: Session,
        department_id: int,
        request: DepartmentUpdateRequest,
        current_admin: User,
    ) -> dict:
        department = db.query(DepartmentRecord).filter(DepartmentRecord.id == department_id).first()
        if not department:
            raise ResourceNotFoundError("Department", department_id)
        payload = request.model_dump(exclude_unset=True)
        if "code" in payload and payload["code"]:
            department.code = payload["code"].upper()
        if "name" in payload and payload["name"]:
            department.name = payload["name"]
        if "description" in payload:
            department.description = payload["description"]
        if "active" in payload and payload["active"] is not None:
            department.active = payload["active"]
            if payload["active"]:
                department.deleted_at = None
                department.deleted_by_user_id = None
        department.updated_by_user_id = current_admin.id
        department.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(department)
        if request.unit_ids is not None:
            DepartmentService._sync_unit_mappings(db, department, request.unit_ids)
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def soft_delete_department(db: Session, department_id: int, current_admin: User) -> dict:
        department = db.query(DepartmentRecord).filter(DepartmentRecord.id == department_id).first()
        if not department:
            raise ResourceNotFoundError("Department", department_id)
        department.active = False
        department.deleted_at = datetime.now(timezone.utc)
        department.deleted_by_user_id = current_admin.id
        department.updated_by_user_id = current_admin.id
        db.commit()
        db.refresh(department)
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def upsert_annexure_mapping(
        db: Session,
        department_id: int,
        request: DepartmentAnnexureMappingRequest,
        current_admin: User,
    ) -> dict:
        """Configure department-specific annexure visibility and checklist ownership."""

        department = DepartmentService.get_department_by_id(db, department_id)
        annexure = db.query(Annexure).filter(Annexure.id == request.annexure_id).first()
        if not annexure:
            raise ResourceNotFoundError("Annexure", request.annexure_id)
        mapping = (
            db.query(DepartmentAnnexureMapping)
            .filter(
                DepartmentAnnexureMapping.department_id == department.id,
                DepartmentAnnexureMapping.annexure_id == annexure.id,
            )
            .first()
        )
        if not mapping:
            mapping = DepartmentAnnexureMapping(
                department_id=department.id,
                annexure_id=annexure.id,
                created_by_user_id=current_admin.id,
            )
            db.add(mapping)
        mapping.requirement_type = request.requirement_type
        mapping.visibility_scope = request.visibility_scope
        mapping.checklist_owner_role = request.checklist_owner_role
        mapping.workflow_stage = request.workflow_stage
        mapping.priority = request.priority
        mapping.active = request.active
        mapping.deleted_at = None if request.active else datetime.now(timezone.utc)
        mapping.deleted_by_user_id = None if request.active else current_admin.id
        mapping.updated_by_user_id = current_admin.id
        DepartmentService._log_activity(db, department.id, current_admin.id, "ANNEXURE_MAPPED", f"{annexure.code} mapped as {request.requirement_type}.")
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def remove_annexure_mapping(db: Session, department_id: int, mapping_id: int, current_admin: User) -> dict:
        department = DepartmentService.get_department_by_id(db, department_id)
        mapping = (
            db.query(DepartmentAnnexureMapping)
            .filter(DepartmentAnnexureMapping.id == mapping_id, DepartmentAnnexureMapping.department_id == department.id)
            .first()
        )
        if not mapping:
            raise ResourceNotFoundError("Department annexure mapping", mapping_id)
        mapping.active = False
        mapping.deleted_at = datetime.now(timezone.utc)
        mapping.deleted_by_user_id = current_admin.id
        mapping.updated_by_user_id = current_admin.id
        DepartmentService._log_activity(db, department.id, current_admin.id, "ANNEXURE_UNMAPPED", "Annexure mapping deactivated.")
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def upsert_unit_mapping(db: Session, department_id: int, request: DepartmentUnitMappingRequest, current_admin: User) -> dict:
        """Configure department operational visibility and unit-level routing."""

        department = DepartmentService.get_department_by_id(db, department_id)
        unit = db.query(RefineryUnit).filter(RefineryUnit.id == request.unit_id).first()
        if not unit:
            raise ResourceNotFoundError("Refinery unit", request.unit_id)
        mapping = (
            db.query(DepartmentUnitMapping)
            .filter(DepartmentUnitMapping.department_id == department.id, DepartmentUnitMapping.unit_id == unit.id)
            .first()
        )
        if not mapping:
            mapping = DepartmentUnitMapping(department_id=department.id, unit_id=unit.id)
            db.add(mapping)
        mapping.visibility = request.visibility
        mapping.workflow_scope = request.workflow_scope
        mapping.area_owner_user_id = request.area_owner_user_id
        mapping.active = request.active
        mapping.deleted_at = None if request.active else datetime.now(timezone.utc)
        mapping.deleted_by_user_id = None if request.active else current_admin.id
        DepartmentService._log_activity(db, department.id, current_admin.id, "OPERATIONAL_UNIT_UPDATED", f"{unit.code} visibility set to {request.visibility}.")
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def upsert_workflow_responsibility(
        db: Session,
        department_id: int,
        request: DepartmentWorkflowResponsibilityRequest,
        current_admin: User,
        responsibility_id: int | None = None,
    ) -> dict:
        """Maintain the department workflow routing and escalation matrix."""

        department = DepartmentService.get_department_by_id(db, department_id)
        row = db.query(DepartmentWorkflowResponsibility).filter(
            DepartmentWorkflowResponsibility.id == responsibility_id,
            DepartmentWorkflowResponsibility.department_id == department.id,
        ).first() if responsibility_id else None
        if not row:
            row = DepartmentWorkflowResponsibility(department_id=department.id, created_by_user_id=current_admin.id)
            db.add(row)
        for field, value in request.model_dump().items():
            setattr(row, field, value)
        row.deleted_at = None if request.active else datetime.now(timezone.utc)
        row.deleted_by_user_id = None if request.active else current_admin.id
        row.updated_by_user_id = current_admin.id
        DepartmentService._log_activity(db, department.id, current_admin.id, "WORKFLOW_RESPONSIBILITY_CHANGED", f"{request.stage} responsibility updated.")
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def upsert_permission_config(
        db: Session,
        department_id: int,
        request: DepartmentPermissionConfigRequest,
        current_admin: User,
    ) -> dict:
        """Maintain department-level RBAC switches consumed by workflow visibility."""

        department = DepartmentService.get_department_by_id(db, department_id)
        row = (
            db.query(DepartmentPermissionConfig)
            .filter(
                DepartmentPermissionConfig.department_id == department.id,
                DepartmentPermissionConfig.capability == request.capability,
                DepartmentPermissionConfig.role == request.role,
            )
            .first()
        )
        if not row:
            row = DepartmentPermissionConfig(
                department_id=department.id,
                capability=request.capability,
                role=request.role,
                created_by_user_id=current_admin.id,
            )
            db.add(row)
        row.allowed = request.allowed
        row.scope = request.scope
        row.active = request.active
        row.deleted_at = None if request.active else datetime.now(timezone.utc)
        row.deleted_by_user_id = None if request.active else current_admin.id
        row.updated_by_user_id = current_admin.id
        DepartmentService._log_activity(db, department.id, current_admin.id, "PERMISSION_CHANGED", f"{request.capability} for {request.role} set to {request.allowed}.")
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def upsert_area_owner_mapping(
        db: Session,
        department_id: int,
        request: DepartmentAreaOwnerMappingRequest,
        current_admin: User,
        mapping_id: int | None = None,
    ) -> dict:
        """Configure area-owner approval routing for department/unit scopes."""

        department = DepartmentService.get_department_by_id(db, department_id)
        owner = db.query(User).filter(User.id == request.area_owner_user_id).first()
        if not owner:
            raise ResourceNotFoundError("Area owner user", request.area_owner_user_id)
        row = db.query(DepartmentAreaOwnerMapping).filter(
            DepartmentAreaOwnerMapping.id == mapping_id,
            DepartmentAreaOwnerMapping.department_id == department.id,
        ).first() if mapping_id else None
        if not row:
            row = DepartmentAreaOwnerMapping(department_id=department.id, created_by_user_id=current_admin.id)
            db.add(row)
        for field, value in request.model_dump().items():
            setattr(row, field, value)
        row.deleted_at = None if request.active else datetime.now(timezone.utc)
        row.deleted_by_user_id = None if request.active else current_admin.id
        row.updated_by_user_id = current_admin.id
        DepartmentService._log_activity(db, department.id, current_admin.id, "AREA_OWNER_CHANGED", f"{owner.full_name} assigned approval scope {request.approval_scope}.")
        db.commit()
        return DepartmentService._department_payload(db, department)

    @staticmethod
    def _sync_unit_mappings(db: Session, department: DepartmentRecord, unit_ids: list[int] | None) -> None:
        if unit_ids is None:
            return
        now = datetime.now(timezone.utc)
        db.query(DepartmentUnitMapping).filter(
            DepartmentUnitMapping.department_id == department.id,
            DepartmentUnitMapping.unit_id.notin_(unit_ids) if unit_ids else True,
        ).update({"active": False, "deleted_at": now}, synchronize_session=False)
        valid_units = db.query(RefineryUnit.id).filter(RefineryUnit.id.in_(unit_ids)).all()
        for row in valid_units:
            existing = db.query(DepartmentUnitMapping).filter(
                DepartmentUnitMapping.department_id == department.id,
                DepartmentUnitMapping.unit_id == row.id,
            ).first()
            if existing:
                existing.active = True
                existing.deleted_at = None
                existing.deleted_by_user_id = None
            else:
                db.add(DepartmentUnitMapping(department_id=department.id, unit_id=row.id))
        db.commit()

    @staticmethod
    def _department_payload(db: Session, department: DepartmentRecord) -> dict:
        DepartmentService._seed_department_configuration(db, department)
        department_values = [item for item in [department.name, department.code] if item]
        personnel_count = (
            db.query(func.count(User.id))
            .filter(User.department.in_(department_values), User.active.is_(True))
            .scalar()
            or 0
        )
        initiator_count = (
            db.query(func.count(UserPermission.id))
            .join(User, User.id == UserPermission.user_id)
            .filter(
                User.department.in_(department_values),
                User.active.is_(True),
                UserPermission.permission == PermissionCode.INITIATE_PSSR.value,
                UserPermission.active.is_(True),
            )
            .scalar()
            or 0
        )
        area_owner_count = (
            db.query(func.count(User.id))
            .filter(User.department.in_(department_values), User.role == "AREA_OWNER", User.active.is_(True))
            .scalar()
            or 0
        )
        annexure_rows = (
            db.query(DepartmentAnnexureMapping, Annexure)
            .join(Annexure, Annexure.id == DepartmentAnnexureMapping.annexure_id)
            .filter(
                DepartmentAnnexureMapping.department_id == department.id,
                DepartmentAnnexureMapping.active.is_(True),
                Annexure.active.is_(True),
                Annexure.is_deleted.is_(False),
            )
            .order_by(DepartmentAnnexureMapping.priority.asc(), Annexure.number.asc())
            .all()
        )
        units = (
            db.query(DepartmentUnitMapping, RefineryUnit)
            .join(RefineryUnit, DepartmentUnitMapping.unit_id == RefineryUnit.id)
            .filter(
                DepartmentUnitMapping.department_id == department.id,
                DepartmentUnitMapping.active.is_(True),
                RefineryUnit.active.is_(True),
            )
            .order_by(RefineryUnit.zone.asc(), RefineryUnit.name.asc())
            .all()
        )
        workflow_rows = db.query(DepartmentWorkflowResponsibility).filter(
            DepartmentWorkflowResponsibility.department_id == department.id,
            DepartmentWorkflowResponsibility.active.is_(True),
        ).order_by(DepartmentWorkflowResponsibility.stage.asc()).all()
        permission_rows = db.query(DepartmentPermissionConfig).filter(
            DepartmentPermissionConfig.department_id == department.id,
            DepartmentPermissionConfig.active.is_(True),
        ).order_by(DepartmentPermissionConfig.capability.asc(), DepartmentPermissionConfig.role.asc()).all()
        area_owner_rows = db.query(DepartmentAreaOwnerMapping).filter(
            DepartmentAreaOwnerMapping.department_id == department.id,
            DepartmentAreaOwnerMapping.active.is_(True),
        ).order_by(DepartmentAreaOwnerMapping.approval_scope.asc()).all()
        activity_rows = db.query(DepartmentActivityLog).filter(
            DepartmentActivityLog.department_id == department.id
        ).order_by(DepartmentActivityLog.created_at.desc()).limit(12).all()
        status_counts = dict(
            db.query(PSSRTask.status, func.count(PSSRTask.id))
            .filter(PSSRTask.department == department.name)
            .group_by(PSSRTask.status)
            .all()
        )
        # Workflow ownership metrics make department edits visible in global
        # dashboards instead of leaving structure configuration as isolated CRUD.
        active_pssr_count = sum(status_counts.get(status, 0) for status in ["To Do", "In Progress", "Pending Review", "Pending Area Owner Approval"])
        completed_pssr_count = sum(status_counts.get(status, 0) for status in ["Completed", "Approved"])
        total_pssr_count = active_pssr_count + completed_pssr_count
        pending_approvals = status_counts.get("Pending Area Owner Approval", 0) + status_counts.get("Pending Review", 0)
        assigned_checklist_total = db.query(func.count(PSSRTask.id)).filter(PSSRTask.department == department.name).scalar() or 0
        punch_point_count = (
            db.query(func.count(AnnexurePunchPoint.id))
            .filter(
                AnnexurePunchPoint.owning_department.in_([department.name, department.code]),
                AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
            )
            .scalar()
            or 0
        )
        activity_payload = [
            {
                "id": row.id,
                "action": row.action,
                "summary": row.summary,
                "actor_name": row.actor.full_name if row.actor else None,
                "created_at": row.created_at,
            }
            for row in activity_rows
        ]
        return {
            "id": department.id,
            "code": department.code,
            "name": department.name,
            "description": department.description,
            "active": department.active,
            "personnel_count": personnel_count,
            "initiator_count": initiator_count,
            "area_owner_count": area_owner_count,
            "workflow_impact": {
                "active_pssr_count": active_pssr_count,
                "pending_approvals": pending_approvals,
                "punch_point_count": punch_point_count,
                "completed_pssr_count": completed_pssr_count,
                "completion_rate": int((completed_pssr_count / total_pssr_count) * 100) if total_pssr_count else 0,
                "assigned_checklist_total": assigned_checklist_total,
                "department_workload": assigned_checklist_total + punch_point_count + pending_approvals,
                "recent_workflow_activity": activity_payload[:5],
            },
            "annexures": [
                {
                    "id": annexure.id,
                    "mapping_id": mapping.id,
                    "code": annexure.code,
                    "title": annexure.title,
                    "requirement_type": mapping.requirement_type,
                    "visibility_scope": mapping.visibility_scope,
                    "checklist_owner_role": mapping.checklist_owner_role,
                    "workflow_stage": mapping.workflow_stage,
                    "priority": mapping.priority,
                    "active": mapping.active,
                }
                for mapping, annexure in annexure_rows
            ],
            "operational_units": [
                {
                    "id": unit.id,
                    "code": unit.code,
                    "name": unit.name,
                    "zone": unit.zone,
                    "visibility": mapping.visibility,
                    "workflow_scope": mapping.workflow_scope,
                    "area_owner_user_id": mapping.area_owner_user_id,
                    "active": mapping.active,
                }
                for mapping, unit in units
            ],
            "workflow_responsibilities": [
                {
                    "id": row.id,
                    "stage": row.stage,
                    "responsibility": row.responsibility,
                    "owner_role": row.owner_role,
                    "escalation_owner_role": row.escalation_owner_role,
                    "due_days": row.due_days,
                    "punch_point_owner": row.punch_point_owner,
                    "approval_required": row.approval_required,
                    "active": row.active,
                }
                for row in workflow_rows
            ],
            "permission_configs": [
                {
                    "id": row.id,
                    "capability": row.capability,
                    "role": row.role,
                    "allowed": row.allowed,
                    "scope": row.scope,
                    "active": row.active,
                }
                for row in permission_rows
            ],
            "area_owners": [
                {
                    "id": row.id,
                    "area_owner_user_id": row.area_owner_user_id,
                    "area_owner_name": row.area_owner.full_name if row.area_owner else "Unknown area owner",
                    "unit_id": row.unit_id,
                    "unit_name": row.unit.name if row.unit else None,
                    "approval_scope": row.approval_scope,
                    "escalation_user_id": row.escalation_user_id,
                    "escalation_owner_name": row.escalation_owner.full_name if row.escalation_owner else None,
                    "active": row.active,
                }
                for row in area_owner_rows
            ],
            "activity_history": activity_payload,
            "created_at": department.created_at,
            "updated_at": department.updated_at,
        }

    @staticmethod
    def _seed_department_configuration(db: Session, department: DepartmentRecord) -> None:
        """Create missing default routing rows so global workflows have a baseline matrix."""

        for stage, responsibility, owner_role, approval_required in DEFAULT_WORKFLOW_RESPONSIBILITIES:
            exists_row = db.query(DepartmentWorkflowResponsibility.id).filter(
                DepartmentWorkflowResponsibility.department_id == department.id,
                DepartmentWorkflowResponsibility.stage == stage,
            ).first()
            if not exists_row:
                db.add(DepartmentWorkflowResponsibility(
                    department_id=department.id,
                    stage=stage,
                    responsibility=responsibility,
                    owner_role=owner_role,
                    approval_required=approval_required,
                ))
        for capability, role, allowed in DEFAULT_PERMISSION_MATRIX:
            # Permission rows are department-scoped RBAC defaults; user-specific
            # grants such as INITIATE_PSSR remain in user_permissions.
            exists_row = db.query(DepartmentPermissionConfig.id).filter(
                DepartmentPermissionConfig.department_id == department.id,
                DepartmentPermissionConfig.capability == capability,
                DepartmentPermissionConfig.role == role,
            ).first()
            if not exists_row:
                db.add(DepartmentPermissionConfig(
                    department_id=department.id,
                    capability=capability,
                    role=role,
                    allowed=allowed,
                ))
        legacy_annexures = (
            db.query(Annexure)
            .join(AnnexureDepartment, AnnexureDepartment.annexure_id == Annexure.id)
            .filter(
                AnnexureDepartment.department_id.in_([department.code, department.name]),
                Annexure.active.is_(True),
                Annexure.is_deleted.is_(False),
            )
            .all()
        )
        for index, annexure in enumerate(legacy_annexures, start=1):
            exists_row = db.query(DepartmentAnnexureMapping.id).filter(
                DepartmentAnnexureMapping.department_id == department.id,
                DepartmentAnnexureMapping.annexure_id == annexure.id,
            ).first()
            if not exists_row:
                db.add(DepartmentAnnexureMapping(
                    department_id=department.id,
                    annexure_id=annexure.id,
                    priority=index,
                    requirement_type="MANDATORY",
                    visibility_scope="DEPARTMENT",
                    checklist_owner_role="TEAM_MEMBER",
                    workflow_stage="IN_PROGRESS",
                ))
        db.flush()

    @staticmethod
    def _log_activity(db: Session, department_id: int, actor_id: int | None, action: str, summary: str) -> None:
        db.add(DepartmentActivityLog(
            department_id=department_id,
            actor_user_id=actor_id,
            action=action,
            summary=summary,
        ))
