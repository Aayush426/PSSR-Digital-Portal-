"""Business service for user-centric PSSR initiator capability."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictError, ResourceNotFoundError, ValidationError
from app.models.permissions import PermissionCode, UserPermission
from app.models.user import User, UserRole
from app.repositories.permission_repository import UserPermissionRepository
from app.schemas.pssr import InitiatorCapabilityResponse


class InitiatorCapabilityService:
    """Grant, revoke, list, and report INITIATE_PSSR capability."""

    @staticmethod
    def grant_initiator_access(
        db: Session,
        user_id: int,
        current_admin: User,
        reason: Optional[str] = None,
    ) -> InitiatorCapabilityResponse:
        """Grant a TEAM_MEMBER permission to create and own new PSSR workflows."""

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError("User", user_id)
        if not user.active:
            raise ValidationError("Only active users can receive PSSR initiator access.")
        if user.role != UserRole.TEAM_MEMBER.value:
            raise ValidationError("Only TEAM_MEMBER users can receive PSSR initiator access.")
        existing = UserPermissionRepository.active_grant(
            db,
            user.id,
            PermissionCode.INITIATE_PSSR,
        )
        if existing:
            raise ConflictError("This TEAM_MEMBER already has PSSR initiator access.")

        grant = UserPermission(
            user_id=user.id,
            permission=PermissionCode.INITIATE_PSSR.value,
            active=True,
            granted_by_user_id=current_admin.id,
            grant_reason=reason,
        )
        db.add(grant)
        db.commit()
        return InitiatorCapabilityService._to_response(db, user)

    @staticmethod
    def revoke_initiator_access(
        db: Session,
        user_id: int,
        current_admin: User,
        reason: Optional[str] = None,
    ) -> InitiatorCapabilityResponse:
        """Disable future PSSR creation while preserving grant history."""

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError("User", user_id)
        grant = UserPermissionRepository.active_grant(
            db,
            user.id,
            PermissionCode.INITIATE_PSSR,
        )
        if not grant:
            raise ConflictError("This user does not have active PSSR initiator access.")

        now = datetime.now(timezone.utc)
        grant.active = False
        grant.revoked_by_user_id = current_admin.id
        grant.revoked_at = now
        grant.revoke_reason = reason
        grant.updated_at = now
        db.commit()
        return InitiatorCapabilityService._to_response(db, user)

    @staticmethod
    def list_initiators(
        db: Session,
        *,
        active: Optional[bool] = True,
        department: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 25,
    ) -> tuple[list[InitiatorCapabilityResponse], int]:
        """Return TEAM_MEMBER users with or without INITIATE_PSSR capability."""

        page = max(page, 1)
        limit = min(max(limit, 1), 100)
        query = db.query(User).filter(User.role == UserRole.TEAM_MEMBER.value)
        permission_exists = exists().where(
            UserPermission.user_id == User.id,
            UserPermission.permission == PermissionCode.INITIATE_PSSR.value,
            UserPermission.active.is_(True),
        )
        if active is True:
            query = query.filter(permission_exists)
        elif active is False:
            query = query.filter(~permission_exists)
        if department:
            query = query.filter(User.department == department)
        if search:
            pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(User.full_name.ilike(pattern), User.email.ilike(pattern), User.employee_id.ilike(pattern))
            )

        total = query.count()
        users = (
            query.order_by(User.department.asc(), User.full_name.asc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return [InitiatorCapabilityService._to_response(db, user) for user in users], total

    @staticmethod
    def is_active_initiator(db: Session, user_id: int) -> bool:
        return UserPermissionRepository.has_permission(
            db,
            user_id,
            PermissionCode.INITIATE_PSSR,
        )

    @staticmethod
    def _to_response(db: Session, user: User) -> InitiatorCapabilityResponse:
        grant = (
            db.query(UserPermission)
            .options(joinedload(UserPermission.granted_by))
            .filter(
                UserPermission.user_id == user.id,
                UserPermission.permission == PermissionCode.INITIATE_PSSR.value,
            )
            .order_by(UserPermission.active.desc(), UserPermission.granted_at.desc())
            .first()
        )
        return InitiatorCapabilityResponse(
            user_id=user.id,
            employee_id=user.employee_id,
            full_name=user.full_name,
            email=user.email,
            department=user.department,
            designation=user.designation,
            plant_location=user.plant_location,
            is_active=bool(grant and grant.active),
            granted_at=grant.granted_at if grant else None,
            granted_by_full_name=grant.granted_by.full_name if grant and grant.granted_by else None,
            revoked_at=grant.revoked_at if grant else None,
            statistics=UserPermissionRepository.stats_for_user(db, user.id),
        )

    @staticmethod
    def capability_counts(db: Session) -> dict:
        """Small admin statistics block for initiator governance."""

        active_initiators = (
            db.query(func.count(UserPermission.id))
            .filter(
                UserPermission.permission == PermissionCode.INITIATE_PSSR.value,
                UserPermission.active.is_(True),
            )
            .scalar()
            or 0
        )
        return {
            "active_initiators": active_initiators,
            "draft_pssr": 0,
            "in_progress": 0,
            "pending_area_owner_approval": 0,
            "approved": 0,
            "open_punch_points": 0,
        }
