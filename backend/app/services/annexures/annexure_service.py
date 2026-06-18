"""Business service for the domain-driven annexure checklist engine."""

import hashlib
import html
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ResourceNotFoundError, ValidationError
from app.models.annexures import (
    Annexure,
    AnnexureAuditLog,
    AnnexureAssignment,
    AnnexureDepartment,
    AnnexurePunchPoint,
    AnnexureQuestion,
    AnnexureRevision,
    AnnexureResponse,
    AnnexureSection,
    AnnexureTemplate,
)
from app.models.user import User, UserRole
from app.repositories.annexures import AnnexureRepository
from app.schemas.annexures import AnnexureAssignmentIn, AnnexureCreateIn, AnnexureResponseIn, AnnexureUpdateIn


class AnnexureService:
    """Coordinates annexure master data, workflow state, and audit records."""

    @staticmethod
    def list_annexures(
        db: Session,
        *,
        page: int,
        limit: int,
        search: Optional[str] = None,
        department: Optional[str] = None,
        active: Optional[bool] = True,
        archived: Optional[bool] = False,
        revision: Optional[str] = None,
        has_template: Optional[bool] = None,
        recently_modified: bool = False,
        sort_by: str = "number",
        sort_dir: str = "asc",
        pssr_id: Optional[str] = None,
    ) -> dict:
        records, total = AnnexureRepository.list(
            db,
            page=page,
            limit=limit,
            search=search,
            department=department,
            active=active,
            archived=archived,
            revision=revision,
            has_template=has_template,
            recently_modified=recently_modified,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

        return {
            "records": [AnnexureService._summary(db, annexure, pssr_id) for annexure in records],
            "pagination": {
                "page": page,
                "limit": limit,
                "total_records": total,
                "total_pages": (total + limit - 1) // limit if limit else 0,
            },
        }

    @staticmethod
    def overview(db: Session) -> dict:
        return AnnexureRepository.overview(db)

    @staticmethod
    def create_annexure(db: Session, payload: AnnexureCreateIn, current_user: User) -> dict:
        if db.query(Annexure).filter(Annexure.number == payload.number, Annexure.is_deleted.is_(False)).first():
            raise ValidationError(f"Annexure number {payload.number} already exists.")
        annexure = Annexure(
            number=payload.number,
            code=f"ANNEXURE-{payload.number:02d}",
            title=payload.title,
            description=payload.description,
            revision=payload.revision,
            active=payload.active,
            sort_order=payload.number,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
        )
        db.add(annexure)
        db.flush()
        AnnexureService._replace_departments(db, annexure, payload.department_visibility)
        AnnexureService._replace_sections(db, annexure, payload.sections)
        AnnexureService._audit(db, annexure, "CREATE", current_user, "Annexure master created.")
        AnnexureService._revision(db, annexure, current_user, "Initial annexure master revision.")
        db.commit()
        return AnnexureService.get_annexure(db, annexure.id)

    @staticmethod
    def update_annexure(db: Session, annexure_id: int, payload: AnnexureUpdateIn, current_user: User) -> dict:
        annexure = AnnexureService._get_annexure_model(db, annexure_id)
        if payload.number is not None and payload.number != annexure.number:
            duplicate = (
                db.query(Annexure)
                .filter(
                    Annexure.number == payload.number,
                    Annexure.id != annexure.id,
                    Annexure.is_deleted.is_(False),
                )
                .first()
            )
            if duplicate:
                raise ValidationError(f"Annexure number {payload.number} already exists.")
            annexure.number = payload.number
            annexure.code = f"ANNEXURE-{payload.number:02d}"
            annexure.sort_order = payload.number
        if payload.title is not None:
            annexure.title = payload.title
        if payload.description is not None:
            annexure.description = payload.description
        if payload.revision is not None:
            annexure.revision = payload.revision
        if payload.active is not None:
            annexure.active = payload.active
        if payload.department_visibility is not None:
            AnnexureService._replace_departments(db, annexure, payload.department_visibility)
        if payload.sections is not None:
            AnnexureService._replace_sections(db, annexure, payload.sections)
        annexure.updated_by_user_id = current_user.id
        annexure.updated_at = datetime.utcnow()
        summary = payload.change_summary or "Annexure master updated."
        AnnexureService._audit(db, annexure, "UPDATE", current_user, summary)
        AnnexureService._revision(db, annexure, current_user, summary)
        db.commit()
        return AnnexureService.get_annexure(db, annexure.id)

    @staticmethod
    def archive_annexure(db: Session, annexure_id: int, current_user: User) -> dict:
        annexure = AnnexureService._get_annexure_model(db, annexure_id)
        annexure.is_deleted = True
        annexure.active = False
        annexure.deleted_at = datetime.utcnow()
        annexure.deleted_by_user_id = current_user.id
        annexure.updated_by_user_id = current_user.id
        AnnexureService._audit(db, annexure, "ARCHIVE", current_user, "Annexure master soft deleted.")
        db.commit()
        return {"id": annexure.id, "archived": True}

    @staticmethod
    def restore_annexure(db: Session, annexure_id: int, current_user: User) -> dict:
        annexure = AnnexureRepository.get(db, annexure_id, include_deleted=True)
        if not annexure:
            raise ResourceNotFoundError("Annexure", annexure_id)
        annexure.is_deleted = False
        annexure.active = True
        annexure.deleted_at = None
        annexure.deleted_by_user_id = None
        annexure.updated_by_user_id = current_user.id
        annexure.updated_at = datetime.utcnow()
        AnnexureService._audit(db, annexure, "RESTORE", current_user, "Annexure master restored from archive.")
        db.commit()
        return {"id": annexure.id, "archived": False}

    @staticmethod
    def active_template(db: Session, annexure_id: int) -> AnnexureTemplate:
        annexure = AnnexureService._get_annexure_model(db, annexure_id)
        template = AnnexureRepository.active_template(db, annexure_id)
        template_path = Path(template.file_path) if template else None
        invalid_generated_docx = (
            template_path is not None
            and template_path.suffix.lower() == ".docx"
            and template_path.exists()
            and not zipfile.is_zipfile(template_path)
        )
        if not template or not template_path.exists() or invalid_generated_docx:
            template = AnnexureService._generate_template(db, annexure)
        return template

    @staticmethod
    def get_annexure(db: Session, annexure_id: int, pssr_id: Optional[str] = None) -> dict:
        annexure = AnnexureService._get_annexure_model(db, annexure_id)
        summary = AnnexureService._summary(db, annexure, pssr_id)
        responses = AnnexureService._responses_by_question(db, annexure.id, pssr_id)
        return {
            **summary,
            "sections": [
                {
                    "id": section.id,
                    "title": section.title,
                    "section_type": section.section_type,
                    "description": section.description,
                    "responsible_department": section.responsible_department,
                    "sort_order": section.sort_order,
                    "questions": [
                        AnnexureService._question_dict(question, responses.get(question.id))
                        for question in section.questions
                        if question.active
                    ],
                }
                for section in annexure.sections
            ],
            "templates": [
                {
                    "id": template.id,
                    "version": template.version,
                    "file_name": template.file_name,
                    "file_type": template.file_type,
                    "storage_path": template.storage_path,
                    "uploaded_at": template.uploaded_at.isoformat(),
                    "active": template.active,
                }
                for template in sorted(annexure.templates, key=lambda item: item.uploaded_at, reverse=True)
            ],
            "revisions": [
                {
                    "id": revision.id,
                    "revision": revision.revision,
                    "change_summary": revision.change_summary,
                    "created_by_user_id": revision.created_by_user_id,
                    "created_at": revision.created_at.isoformat(),
                }
                for revision in sorted(annexure.revisions, key=lambda item: item.created_at, reverse=True)
            ],
        }

    @staticmethod
    def get_questions(db: Session, annexure_id: int, pssr_id: Optional[str] = None) -> list[dict]:
        return AnnexureService.get_annexure(db, annexure_id, pssr_id)["sections"]

    @staticmethod
    def record_response(db: Session, payload: AnnexureResponseIn, current_user: User) -> dict:
        AnnexureService._get_annexure_model(db, payload.annexure_id)
        question = db.query(AnnexureQuestion).filter(AnnexureQuestion.id == payload.question_id).first()
        if not question:
            raise ResourceNotFoundError("Annexure question", payload.question_id)

        response = (
            db.query(AnnexureResponse)
            .filter(
                AnnexureResponse.pssr_id == payload.pssr_id,
                AnnexureResponse.question_id == payload.question_id,
            )
            .first()
        )
        now = datetime.utcnow()
        if not response:
            response = AnnexureResponse(
                pssr_id=payload.pssr_id,
                annexure_id=payload.annexure_id,
                question_id=payload.question_id,
                created_at=now,
            )
            db.add(response)

        response.response = payload.response
        response.remarks = payload.remarks
        response.attachments = payload.attachments
        response.checked_by_user_id = current_user.id
        response.checked_by_department = current_user.department or question.checked_by_department
        response.checked_at = now
        response.modified_by_user_id = current_user.id
        response.modified_at = now

        if payload.response == "FAIL":
            AnnexureService._ensure_punch_point(db, payload, question, current_user)

        db.commit()
        db.refresh(response)
        return AnnexureService._response_dict(response)

    @staticmethod
    def assign(db: Session, payload: AnnexureAssignmentIn, current_user: User) -> dict:
        AnnexureService._get_annexure_model(db, payload.annexure_id)
        assignment = AnnexureAssignment(
            pssr_id=payload.pssr_id,
            annexure_id=payload.annexure_id,
            question_id=payload.question_id,
            assigned_department=payload.assigned_department,
            assigned_to_user_id=payload.assigned_to_user_id,
            area_owner_user_id=payload.area_owner_user_id,
            assigned_by_user_id=current_user.id,
            priority=payload.priority,
            due_date=payload.due_date,
            remarks=payload.remarks,
            status="ASSIGNED",
            review_status="PENDING",
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return AnnexureService._assignment_dict(assignment)

    @staticmethod
    async def upload_template(
        db: Session,
        *,
        annexure_id: int,
        version: str,
        file: UploadFile,
        current_user: User,
    ) -> dict:
        annexure = AnnexureService._get_annexure_model(db, annexure_id)
        suffix = Path(file.filename or "").suffix.lower()
        allowed = {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        }
        if file.content_type not in allowed and suffix not in {".doc", ".docx"}:
            raise ValidationError("Only DOC and DOCX annexure templates are supported.")
        if suffix not in {".doc", ".docx"}:
            raise ValidationError("Template file name must end with .doc or .docx.")

        content = await file.read()
        if not content:
            raise ValidationError("Uploaded template is empty.")
        checksum = hashlib.sha256(content).hexdigest()
        storage_dir = Path("storage/annexure_templates") / f"annexure_{annexure_id}"
        storage_dir.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", file.filename or f"annexure-{annexure.number:02d}{suffix}")
        storage_path = storage_dir / f"v{version}_{safe_name}"
        if db.query(AnnexureTemplate).filter(AnnexureTemplate.annexure_id == annexure_id, AnnexureTemplate.version == version).first():
            version = f"{version}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            storage_path = storage_dir / f"v{version}_{safe_name}"
        storage_path.write_bytes(content)

        db.query(AnnexureTemplate).filter(AnnexureTemplate.annexure_id == annexure_id).update(
            {"active": False, "is_active": False},
            synchronize_session=False,
        )
        template = AnnexureTemplate(
            annexure_id=annexure_id,
            version=version,
            file_name=file.filename,
            file_path=str(storage_path),
            file_size=len(content),
            mime_type=file.content_type,
            file_type=file.content_type,
            storage_path=str(storage_path),
            checksum=checksum,
            uploaded_by_user_id=current_user.id,
            uploaded_by=current_user.id,
            active=True,
            is_active=True,
        )
        db.add(template)
        AnnexureService._audit(db, annexure, "TEMPLATE_UPLOAD", current_user, f"Template {file.filename} uploaded.")
        db.commit()
        db.refresh(template)
        return {
            "id": template.id,
            "annexure_id": template.annexure_id,
            "version": template.version,
            "file_name": template.file_name,
            "mime_type": template.mime_type,
            "file_path": template.file_path,
            "file_size": template.file_size,
            "uploaded_at": template.uploaded_at.isoformat(),
            "download_url": f"/api/v1/annexures/{annexure.id}/download-template",
        }

    @staticmethod
    def pending_review(db: Session, current_user: User, limit: int = 50) -> list[dict]:
        query = db.query(AnnexureAssignment).filter(
            AnnexureAssignment.review_status == "PENDING",
            AnnexureAssignment.status.in_(["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]),
        )
        if current_user.role == UserRole.AREA_OWNER.value:
            query = query.filter(AnnexureAssignment.area_owner_user_id == current_user.id)

        assignments = (
            query.options(joinedload(AnnexureAssignment.annexure))
            .order_by(AnnexureAssignment.due_date.asc().nullslast(), AnnexureAssignment.updated_at.desc())
            .limit(limit)
            .all()
        )
        rows = []
        for assignment in assignments:
            progress, failed_count = AnnexureService._progress_for_annexure(db, assignment.annexure_id, assignment.pssr_id)
            rows.append(
                {
                    "assignment_id": assignment.id,
                    "pssr_id": assignment.pssr_id,
                    "annexure_id": assignment.annexure_id,
                    "annexure_title": assignment.annexure.title,
                    "assigned_department": assignment.assigned_department,
                    "assigned_to_user_id": assignment.assigned_to_user_id,
                    "priority": assignment.priority,
                    "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                    "review_status": assignment.review_status,
                    "progress": progress,
                    "failed_count": failed_count,
                }
            )
        return rows

    @staticmethod
    def _get_annexure_model(db: Session, annexure_id: int) -> Annexure:
        annexure = (
            db.query(Annexure)
            .options(
                joinedload(Annexure.sections).joinedload(AnnexureSection.questions),
                joinedload(Annexure.templates),
                joinedload(Annexure.departments),
                joinedload(Annexure.revisions),
            )
            .filter(Annexure.id == annexure_id)
            .first()
        )
        if not annexure or annexure.is_deleted:
            raise ResourceNotFoundError("Annexure", annexure_id)
        return annexure

    @staticmethod
    def _summary(db: Session, annexure: Annexure, pssr_id: Optional[str]) -> dict:
        questions = [question for section in annexure.sections for question in section.questions if question.active]
        mapped_departments = sorted({department.department_id for department in annexure.departments})
        departments = mapped_departments or sorted({question.department_owner or question.checked_by_department for question in questions})
        active_template = next((template for template in sorted(annexure.templates, key=lambda item: item.uploaded_at, reverse=True) if template.is_active), None)
        return {
            "id": annexure.id,
            "number": annexure.number,
            "code": annexure.code,
            "title": annexure.title,
            "description": annexure.description,
            "revision": annexure.revision,
            "active": annexure.active,
            "status": "ARCHIVED" if annexure.is_deleted else ("ACTIVE" if annexure.active else "INACTIVE"),
            "is_archived": annexure.is_deleted,
            "archived_at": annexure.deleted_at.isoformat() if annexure.deleted_at else None,
            "archived_by": annexure.deleted_by_user_id,
            "modified_by": annexure.updated_by_user_id,
            "modified_at": annexure.updated_at.isoformat(),
            "latest_revision": annexure.revision,
            "sections_count": len(annexure.sections),
            "questions_count": len(questions),
            "departments": departments,
            "uploaded_template": {
                "id": active_template.id,
                "file_name": active_template.file_name,
                "version": active_template.version,
                "uploaded_at": active_template.uploaded_at.isoformat(),
                "download_url": f"/api/v1/annexures/{annexure.id}/download-template",
            } if active_template else None,
            "updated_at": annexure.updated_at.isoformat(),
        }

    @staticmethod
    def _progress_for_annexure(db: Session, annexure_id: int, pssr_id: Optional[str]) -> tuple[int, int]:
        if not pssr_id:
            return 0, 0
        total = db.query(func.count(AnnexureQuestion.id)).filter(
            AnnexureQuestion.annexure_id == annexure_id,
            AnnexureQuestion.active.is_(True),
        ).scalar() or 0
        if total == 0:
            return 0, 0
        answered = db.query(func.count(AnnexureResponse.id)).filter(
            AnnexureResponse.annexure_id == annexure_id,
            AnnexureResponse.pssr_id == pssr_id,
            AnnexureResponse.response.in_(["PASS", "FAIL", "NA"]),
        ).scalar() or 0
        failed = db.query(func.count(AnnexureResponse.id)).filter(
            AnnexureResponse.annexure_id == annexure_id,
            AnnexureResponse.pssr_id == pssr_id,
            AnnexureResponse.response == "FAIL",
        ).scalar() or 0
        return round(answered * 100 / total), failed

    @staticmethod
    def _responses_by_question(db: Session, annexure_id: int, pssr_id: Optional[str]) -> dict[int, dict]:
        if not pssr_id:
            return {}
        responses = db.query(AnnexureResponse).filter(
            AnnexureResponse.annexure_id == annexure_id,
            AnnexureResponse.pssr_id == pssr_id,
        ).all()
        return {response.question_id: AnnexureService._response_dict(response) for response in responses}

    @staticmethod
    def _question_dict(question: AnnexureQuestion, latest_response: Optional[dict] = None) -> dict:
        return {
            "id": question.id,
            "question_text": question.question_text,
            "question_type": question.question_type or "FIELD",
            "checked_by_department": question.checked_by_department,
            "response_type": question.response_type,
            "department_owner": question.department_owner,
            "category": question.category,
            "expected_evidence": question.expected_evidence,
            "help_text": question.help_text,
            "guidance_notes": question.guidance_notes,
            "evidence_required": question.evidence_required,
            "regulatory_reference": question.regulatory_reference,
            "remarks_allowed": True,
            "attachment_allowed": question.evidence_required,
            "punch_point_enabled": True,
            "severity": "HIGH" if question.required and question.evidence_required else "MEDIUM",
            "required": question.required,
            "sequence": question.sequence,
            "sort_order": question.sort_order,
            "latest_response": latest_response,
        }

    @staticmethod
    def _replace_departments(db: Session, annexure: Annexure, departments: list[str]) -> None:
        db.query(AnnexureDepartment).filter(AnnexureDepartment.annexure_id == annexure.id).delete()
        for department in dict.fromkeys(item.strip() for item in departments if item.strip()):
            db.add(AnnexureDepartment(annexure_id=annexure.id, department_id=department))

    @staticmethod
    def _replace_sections(db: Session, annexure: Annexure, sections_payload) -> None:
        existing_sections = {section.id: section for section in annexure.sections}
        seen_section_ids = set()
        for section_index, section_payload in enumerate(sections_payload, start=1):
            section = existing_sections.get(section_payload.id) if section_payload.id else None
            if not section:
                section = AnnexureSection(annexure_id=annexure.id)
                db.add(section)
                db.flush()
            seen_section_ids.add(section.id)
            section.title = section_payload.title
            section.section_type = section_payload.section_type
            section.description = section_payload.description
            section.responsible_department = section_payload.responsible_department
            section.sort_order = section_payload.sort_order or section_index

            existing_questions = {question.id: question for question in section.questions}
            seen_question_ids = set()
            for question_index, question_payload in enumerate(section_payload.questions, start=1):
                question = existing_questions.get(question_payload.id) if question_payload.id else None
                if not question:
                    question = AnnexureQuestion(annexure_id=annexure.id, section_id=section.id)
                    db.add(question)
                    db.flush()
                seen_question_ids.add(question.id)
                sequence = question_payload.sequence or question_index
                question.question_text = question_payload.question_text
                question.question_type = question_payload.question_type
                question.response_type = question_payload.response_type
                question.checked_by_department = question_payload.department_owner or section_payload.responsible_department or "Shared"
                question.department_owner = question_payload.department_owner
                question.category = question_payload.category
                question.expected_evidence = question_payload.expected_evidence
                question.required = question_payload.required
                question.sequence = sequence
                question.sort_order = (section.sort_order * 100) + sequence
                question.help_text = question_payload.help_text
                question.guidance_notes = question_payload.guidance_notes
                question.evidence_required = question_payload.evidence_required or question_payload.attachment_allowed
                question.regulatory_reference = question_payload.regulatory_reference
                question.active = True
            for question in section.questions:
                if question.id not in seen_question_ids:
                    question.active = False

        for section in annexure.sections:
            if section.id not in seen_section_ids:
                db.delete(section)

    @staticmethod
    def _audit(db: Session, annexure: Annexure, action: str, current_user: User, summary: str) -> None:
        db.add(
            AnnexureAuditLog(
                annexure_id=annexure.id,
                action=action,
                actor_user_id=current_user.id,
                summary=summary,
            )
        )

    @staticmethod
    def _revision(db: Session, annexure: Annexure, current_user: User, summary: str) -> None:
        db.add(
            AnnexureRevision(
                annexure_id=annexure.id,
                revision=annexure.revision,
                change_summary=summary,
                created_by_user_id=current_user.id,
            )
        )

    @staticmethod
    def _generate_template(db: Session, annexure: Annexure) -> AnnexureTemplate:
        storage_dir = Path("storage/annexure_templates") / f"annexure_{annexure.id}"
        storage_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{annexure.code.lower()}-{AnnexureService._slug(annexure.title)}-rev-{annexure.revision}.docx"
        storage_path = storage_dir / file_name
        AnnexureService._write_docx(storage_path, annexure)
        checksum = hashlib.sha256(storage_path.read_bytes()).hexdigest()
        db.query(AnnexureTemplate).filter(AnnexureTemplate.annexure_id == annexure.id).update(
            {"active": False, "is_active": False},
            synchronize_session=False,
        )
        template = AnnexureTemplate(
            annexure_id=annexure.id,
            version=annexure.revision,
            file_name=file_name,
            file_path=str(storage_path),
            file_size=storage_path.stat().st_size,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            storage_path=str(storage_path),
            checksum=checksum,
            uploaded_by_user_id=annexure.updated_by_user_id or annexure.created_by_user_id,
            uploaded_by=annexure.updated_by_user_id or annexure.created_by_user_id,
            active=True,
            is_active=True,
            notes="System generated refinery annexure master Word template.",
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def _write_docx(path: Path, annexure: Annexure) -> None:
        def paragraph(text: str, style: str | None = None) -> str:
            style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
            return f"<w:p>{style_xml}<w:r><w:t>{html.escape(text)}</w:t></w:r></w:p>"

        def table(rows: list[list[str]]) -> str:
            body = []
            for row in rows:
                cells = "".join(
                    "<w:tc><w:tcPr><w:tcW w:w=\"2400\" w:type=\"dxa\"/></w:tcPr>"
                    f"{paragraph(cell)}</w:tc>"
                    for cell in row
                )
                body.append(f"<w:tr>{cells}</w:tr>")
            return "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders>" + "".join(
                f"<w:{edge} w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"9CA3AF\"/>"
                for edge in ["top", "left", "bottom", "right", "insideH", "insideV"]
            ) + "</w:tblBorders></w:tblPr>" + "".join(body) + "</w:tbl>"

        departments = ", ".join(sorted({item.department_id for item in annexure.departments})) or "Shared"
        content = [
            paragraph(f"{annexure.code}: {annexure.title}", "Title"),
            paragraph(f"Revision: {annexure.revision}"),
            paragraph(f"Department Visibility: {departments}"),
            paragraph("Purpose: Controlled master annexure template for refinery PSSR administration."),
            paragraph("Administrative Metadata", "Heading1"),
            table([
                ["PSSR Number", ""],
                ["Unit / Area", ""],
                ["MOC / Project Reference", ""],
                ["Prepared By", ""],
                ["Reviewed By", ""],
            ]),
        ]
        for section in sorted(annexure.sections, key=lambda item: item.sort_order):
            content.append(paragraph(section.title, "Heading1"))
            if section.description:
                content.append(paragraph(section.description))
            rows = [["No.", "Checkpoint", "Response", "Remarks", "Owner", "Signature"]]
            for index, question in enumerate([q for q in section.questions if q.active], start=1):
                rows.append([
                    str(index),
                    question.question_text,
                    question.response_type,
                    "",
                    question.department_owner or question.checked_by_department,
                    "",
                ])
            content.append(table(rows))
        content.extend([
            paragraph("Punch Point And Remarks Summary", "Heading1"),
            table([["Category", "Description", "Owner", "Due Date", "Closure Evidence"], ["A", "", "", "", ""], ["B", "", "", "", ""], ["C", "", "", "", ""]]),
            paragraph("Approval Block", "Heading1"),
            table([["Role", "Name", "Department", "Signature", "Date"], ["Initiator", "", "", "", ""], ["Area Owner", "", "", "", ""], ["Safety", "", "", "", ""], ["Operations", "", "", "", ""]]),
        ])
        document_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body>{''.join(content)}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"720\" w:right=\"720\" w:bottom=\"720\" w:left=\"720\"/></w:sectPr></w:body></w:document>"
        )
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as docx:
            docx.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
            docx.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
            docx.writestr("word/document.xml", document_xml)

    @staticmethod
    def _slug(value: str) -> str:
        return "-".join(re.sub(r"[^a-zA-Z0-9]+", " ", value).lower().split())

    @staticmethod
    def _response_dict(response: AnnexureResponse) -> dict:
        return {
            "id": response.id,
            "pssr_id": response.pssr_id,
            "annexure_id": response.annexure_id,
            "question_id": response.question_id,
            "response": response.response,
            "remarks": response.remarks,
            "attachments": response.attachments or [],
            "checked_by_user_id": response.checked_by_user_id,
            "checked_by_department": response.checked_by_department,
            "checked_at": response.checked_at.isoformat() if response.checked_at else None,
            "modified_at": response.modified_at.isoformat(),
        }

    @staticmethod
    def _assignment_dict(assignment: AnnexureAssignment) -> dict:
        return {
            "id": assignment.id,
            "pssr_id": assignment.pssr_id,
            "annexure_id": assignment.annexure_id,
            "question_id": assignment.question_id,
            "assigned_department": assignment.assigned_department,
            "assigned_to_user_id": assignment.assigned_to_user_id,
            "area_owner_user_id": assignment.area_owner_user_id,
            "status": assignment.status,
            "priority": assignment.priority,
            "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
            "review_status": assignment.review_status,
            "remarks": assignment.remarks,
            "assigned_at": assignment.assigned_at.isoformat(),
        }

    @staticmethod
    def _ensure_punch_point(db: Session, payload: AnnexureResponseIn, question: AnnexureQuestion, current_user: User) -> None:
        existing = db.query(AnnexurePunchPoint).filter(
            AnnexurePunchPoint.pssr_id == payload.pssr_id,
            AnnexurePunchPoint.question_id == question.id,
            AnnexurePunchPoint.status.in_(["OPEN", "IN_PROGRESS"]),
        ).first()
        if existing:
            return
        db.add(
            AnnexurePunchPoint(
                pssr_id=payload.pssr_id,
                annexure_id=payload.annexure_id,
                question_id=question.id,
                title=f"Failed checkpoint: {question.category}",
                description=payload.remarks or question.question_text,
                category="A" if question.required else "B",
                severity="HIGH" if question.required else "MEDIUM",
                status="OPEN",
                owning_department=question.checked_by_department,
                assigned_to_user_id=None,
                assigned_by_user_id=None,
                raised_by_user_id=current_user.id,
            )
        )
