"""Repository helpers for user capability grants."""

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.permissions import PermissionCode, UserPermission


class UserPermissionRepository:
    """Data access for active and historical RBAC capabilities."""

    @staticmethod
    def active_grant(
        db: Session,
        user_id: int,
        permission: PermissionCode | str,
    ) -> Optional[UserPermission]:
        code = permission.value if hasattr(permission, "value") else str(permission)
        return (
            db.query(UserPermission)
            .filter(
                UserPermission.user_id == user_id,
                UserPermission.permission == code,
                UserPermission.active.is_(True),
            )
            .first()
        )

    @staticmethod
    def has_permission(db: Session, user_id: int, permission: PermissionCode | str) -> bool:
        return UserPermissionRepository.active_grant(db, user_id, permission) is not None

    @staticmethod
    def active_user_ids(
        db: Session,
        user_ids: list[int],
        permission: PermissionCode | str,
    ) -> set[int]:
        if not user_ids:
            return set()
        code = permission.value if hasattr(permission, "value") else str(permission)
        rows = (
            db.query(UserPermission.user_id)
            .filter(
                UserPermission.user_id.in_(user_ids),
                UserPermission.permission == code,
                UserPermission.active.is_(True),
            )
            .group_by(UserPermission.user_id)
            .all()
        )
        return {row.user_id for row in rows}

    @staticmethod
    def stats_for_user(db: Session, user_id: int) -> dict:
        active_permissions = (
            db.query(func.count(UserPermission.id))
            .filter(UserPermission.user_id == user_id, UserPermission.active.is_(True))
            .scalar()
            or 0
        )
        return {
            "active_capabilities": active_permissions,
            "draft_pssr": 0,
            "in_progress": 0,
            "pending_area_owner_approval": 0,
            "approved": 0,
            "open_punch_points": 0,
            "my_pssr": 0,
        }
