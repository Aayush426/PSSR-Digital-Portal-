"""Database access for annexure master templates."""

from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.annexures import (
    Annexure,
    AnnexureDepartment,
    AnnexureQuestion,
    AnnexureRevision,
    AnnexureSection,
    AnnexureTemplate,
)


class AnnexureRepository:
    """Encapsulates query construction for the annexure master repository."""

    @staticmethod
    def base_query(db: Session):
        return db.query(Annexure)

    @staticmethod
    def list(
        db: Session,
        *,
        page: int,
        limit: int,
        search: Optional[str],
        department: Optional[str],
        active: Optional[bool],
        archived: Optional[bool] = False,
        revision: Optional[str] = None,
        has_template: Optional[bool] = None,
        recently_modified: bool = False,
        sort_by: str = "number",
        sort_dir: str = "asc",
    ) -> tuple[list[Annexure], int]:
        query = AnnexureRepository.base_query(db)
        if archived is not None:
            query = query.filter(Annexure.is_deleted.is_(archived))
        if active is not None:
            query = query.filter(Annexure.active.is_(active))
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(or_(Annexure.title.ilike(pattern), Annexure.code.ilike(pattern)))
        if department:
            query = query.join(AnnexureDepartment).filter(AnnexureDepartment.department_id == department)
        if revision:
            query = query.filter(Annexure.revision == revision)
        if has_template is not None:
            template_ids = db.query(AnnexureTemplate.annexure_id).filter(AnnexureTemplate.is_active.is_(True))
            query = query.filter(Annexure.id.in_(template_ids) if has_template else ~Annexure.id.in_(template_ids))

        total = query.distinct().count()
        sort_column = {
            "number": Annexure.number,
            "title": Annexure.title,
            "revision": Annexure.revision,
            "updated_at": Annexure.updated_at,
            "status": Annexure.active,
        }.get(sort_by, Annexure.number)
        if sort_dir.lower() == "desc":
            sort_column = sort_column.desc()
        else:
            sort_column = sort_column.asc()

        records = (
            query.options(
                joinedload(Annexure.sections).joinedload(AnnexureSection.questions),
                joinedload(Annexure.templates),
                joinedload(Annexure.departments),
            )
            .order_by(Annexure.updated_at.desc() if recently_modified else sort_column, Annexure.id.asc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return records, total

    @staticmethod
    def get(db: Session, annexure_id: int, *, include_deleted: bool = False) -> Annexure | None:
        query = db.query(Annexure).options(
            joinedload(Annexure.sections).joinedload(AnnexureSection.questions),
            joinedload(Annexure.templates),
            joinedload(Annexure.departments),
            joinedload(Annexure.revisions),
        )
        if not include_deleted:
            query = query.filter(Annexure.is_deleted.is_(False))
        return query.filter(Annexure.id == annexure_id).first()

    @staticmethod
    def active_template(db: Session, annexure_id: int) -> AnnexureTemplate | None:
        return (
            db.query(AnnexureTemplate)
            .filter(
                AnnexureTemplate.annexure_id == annexure_id,
                AnnexureTemplate.is_active.is_(True),
            )
            .order_by(AnnexureTemplate.uploaded_at.desc())
            .first()
        )

    @staticmethod
    def overview(db: Session) -> dict:
        base = db.query(Annexure).filter(Annexure.is_deleted.is_(False))
        total = base.count()
        active = base.filter(Annexure.active.is_(True)).count()
        archived = db.query(Annexure).filter(Annexure.is_deleted.is_(True)).count()
        sections = (
            db.query(func.count(AnnexureSection.id))
            .join(Annexure, Annexure.id == AnnexureSection.annexure_id)
            .filter(Annexure.is_deleted.is_(False))
            .scalar()
            or 0
        )
        questions = (
            db.query(func.count(AnnexureQuestion.id))
            .join(Annexure, Annexure.id == AnnexureQuestion.annexure_id)
            .filter(Annexure.is_deleted.is_(False), AnnexureQuestion.active.is_(True))
            .scalar()
            or 0
        )
        templates = (
            db.query(func.count(AnnexureTemplate.id))
            .join(Annexure, Annexure.id == AnnexureTemplate.annexure_id)
            .filter(Annexure.is_deleted.is_(False), AnnexureTemplate.is_active.is_(True))
            .scalar()
            or 0
        )
        departments = (
            db.query(func.count(AnnexureDepartment.id))
            .join(Annexure, Annexure.id == AnnexureDepartment.annexure_id)
            .filter(Annexure.is_deleted.is_(False))
            .scalar()
            or 0
        )
        latest_revision = base.order_by(Annexure.updated_at.desc()).first()
        recent_activity = (
            db.query(AnnexureRevision)
            .join(Annexure, Annexure.id == AnnexureRevision.annexure_id)
            .filter(Annexure.is_deleted.is_(False))
            .order_by(AnnexureRevision.created_at.desc())
            .limit(6)
            .all()
        )
        recently_modified = base.order_by(Annexure.updated_at.desc()).limit(5).all()
        recently_uploaded_templates = (
            db.query(AnnexureTemplate)
            .join(Annexure, Annexure.id == AnnexureTemplate.annexure_id)
            .filter(Annexure.is_deleted.is_(False))
            .order_by(AnnexureTemplate.uploaded_at.desc())
            .limit(5)
            .all()
        )
        return {
            "total_annexures": total,
            "active_annexures": active,
            "archived_annexures": archived,
            "total_sections": sections,
            "total_questions": questions,
            "latest_revision": latest_revision.revision if latest_revision else "1.0",
            "templates_uploaded": templates,
            "department_visibility_count": departments,
            "recent_activity": [
                {
                    "id": item.id,
                    "annexure_id": item.annexure_id,
                    "revision": item.revision,
                    "summary": item.change_summary,
                    "created_at": item.created_at.isoformat(),
                }
                for item in recent_activity
            ],
            "recently_modified": [
                {
                    "id": item.id,
                    "code": item.code,
                    "title": item.title,
                    "revision": item.revision,
                    "updated_at": item.updated_at.isoformat(),
                }
                for item in recently_modified
            ],
            "recently_uploaded_templates": [
                {
                    "id": item.id,
                    "annexure_id": item.annexure_id,
                    "file_name": item.file_name,
                    "version": item.version,
                    "uploaded_at": item.uploaded_at.isoformat(),
                }
                for item in recently_uploaded_templates
            ],
            "revision_history_preview": [
                {
                    "id": item.id,
                    "annexure_id": item.annexure_id,
                    "revision": item.revision,
                    "summary": item.change_summary,
                    "created_at": item.created_at.isoformat(),
                }
                for item in recent_activity[:5]
            ],
        }
