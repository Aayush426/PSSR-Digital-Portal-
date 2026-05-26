"""Repository layer for PSSR workflow record queries."""

from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.pssr_task import PSSRTask


class PSSRTaskRepository:
    """Encapsulates PSSR record lookup for workflow screens."""

    @staticmethod
    def get_by_id(db: Session, pssr_id: int) -> Optional[PSSRTask]:
        return db.query(PSSRTask).filter(PSSRTask.id == pssr_id).first()

    @staticmethod
    def list_records(
        db: Session,
        *,
        search: Optional[str] = None,
        department: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[PSSRTask], int]:
        query = db.query(PSSRTask)
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
