"""
Admin dashboard service.

Aggregation logic belongs here rather than in route handlers. That keeps API
controllers thin and makes future caching, materialized views, or reporting
database offload possible without changing route contracts.
"""

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.permissions import PermissionCode, UserPermission
from app.models.user import User


class AdminService:
    """Admin-facing analytics and dashboard operations."""

    @staticmethod
    def get_dashboard_metrics(db: Session, current_admin: User) -> dict:
        """Return lightweight enterprise metrics for the admin dashboard."""

        role_counts = (
            db.query(User.role, func.count(User.id).label("count"))
            .filter(User.active.is_(True))
            .group_by(User.role)
            .all()
        )
        active_initiators = (
            db.query(UserPermission)
            .filter(
                UserPermission.permission == PermissionCode.INITIATE_PSSR.value,
                UserPermission.active.is_(True),
            )
            .count()
        )
        department_counts = (
            db.query(User.department, func.count(User.id).label("count"))
            .filter(User.active.is_(True), User.department.isnot(None))
            .group_by(User.department)
            .all()
        )

        return {
            "admin": {
                "id": current_admin.id,
                "full_name": current_admin.full_name,
                "employee_id": current_admin.employee_id,
            },
            "system_stats": {
                "users_by_role": {row.role: row.count for row in role_counts},
                "active_pssr_initiators": active_initiators,
                "users_by_department": {
                    row.department: row.count for row in department_counts
                },
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
