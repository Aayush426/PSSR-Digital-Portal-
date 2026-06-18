"""
User domain service.

Routes delegate user lookup, filtering, profile enrichment, and update behavior
to this service so controllers stay thin and business rules have one home.
"""

from datetime import datetime, timezone
from math import ceil
from typing import List, Optional, Tuple

from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundError
from app.models.annexures.annexure import Annexure, AnnexureDepartment
from app.models.permissions import PermissionCode, UserPermission
from app.models.pssr_task import PSSRTask
from app.models.user import User, UserRole
from app.repositories.permission_repository import UserPermissionRepository
from app.schemas.auth import UserFilterParams, UserProfileResponse, UserUpdateRequest


def dashboard_path_for_role(role: str) -> str:
    """Map a permanent backend role to the correct frontend dashboard route."""

    role_value = role.value if hasattr(role, "value") else str(role)
    paths = {
        UserRole.ADMIN.value: "/admin/dashboard",
        UserRole.TEAM_MEMBER.value: "/team/dashboard",
        UserRole.AREA_OWNER.value: "/area-owner/dashboard",
    }
    return paths.get(role_value, "/team/dashboard")


class UserService:
    """Business operations for enterprise users."""

    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[User]:
        """Return a user by primary key."""

        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """Return an active or inactive user by normalized email."""

        return db.query(User).filter(User.email == email.lower()).first()

    @staticmethod
    def is_pssr_initiator(db: Session, user: User) -> bool:
        """Check whether a TEAM_MEMBER has active INITIATE_PSSR capability."""

        return UserPermissionRepository.has_permission(
            db,
            user.id,
            PermissionCode.INITIATE_PSSR,
        )

    @staticmethod
    def build_user_profile(
        db: Session,
        user: User,
        check_initiator: bool = True,
    ) -> UserProfileResponse:
        """
        Build the enriched profile used by dashboards and auth state.

        The frontend receives dashboard_path from the backend to avoid copying
        routing policy into multiple client files. The client still verifies the
        role for UX, while the API remains the authority for access.
        """

        role = user.role.value if hasattr(user.role, "value") else str(user.role)
        active_capabilities = [
            row.permission
            for row in db.query(UserPermission.permission)
            .filter(UserPermission.user_id == user.id, UserPermission.active.is_(True))
            .all()
        ] if check_initiator else []
        initiator_enabled = PermissionCode.INITIATE_PSSR.value in active_capabilities
        return UserProfileResponse(
            id=user.id,
            employee_id=user.employee_id,
            full_name=user.full_name,
            email=user.email,
            role=role,
            department=user.department,
            designation=user.designation,
            plant_location=user.plant_location,
            active=user.active,
            dashboard_path=dashboard_path_for_role(role),
            is_pssr_initiator=initiator_enabled,
            initiator_enabled=initiator_enabled,
            capabilities=active_capabilities,
            last_login_at=user.last_login_at,
        )

    @staticmethod
    def list_users(
        db: Session,
        filters: UserFilterParams,
    ) -> Tuple[List[UserProfileResponse], int]:
        """Return paginated users with admin grid filters applied."""

        query = db.query(User)
        if filters.role:
            query = query.filter(User.role == filters.role.value)
        if filters.department:
            query = query.filter(User.department == filters.department.value)
        if filters.active is not None:
            query = query.filter(User.active == filters.active)
        if filters.search:
            search = f"%{filters.search.strip()}%"
            query = query.filter(
                or_(
                    User.full_name.ilike(search),
                    User.email.ilike(search),
                    User.employee_id.ilike(search),
                )
            )

        total = query.count()
        users = (
            query.order_by(User.full_name.asc())
            .offset((filters.page - 1) * filters.per_page)
            .limit(filters.per_page)
            .all()
        )
        return [UserService.build_user_profile(db, user) for user in users], total

    @staticmethod
    def list_users_paginated(
        db: Session,
        page: int = 1,
        limit: int = 50,
        role: Optional[UserRole] = None,
        department: Optional[str | list[str]] = None,
        active: Optional[bool] = None,
        search: Optional[str] = None,
        initiator: Optional[bool] = None,
        plant_area: Optional[str] = None,
    ) -> dict:
        """
        Return a server-paginated directory page.

        Enterprise user directories must never ship 10k-100k personnel records
        to the browser in one response. Pagination keeps PostgreSQL, the API,
        network transfer, and React rendering bounded to predictable chunks
        while still returning total counts for operator navigation.
        """

        page = max(page, 1)
        limit = min(max(limit, 1), 100)
        offset = (page - 1) * limit

        def apply_filters(query):
            if role:
                query = query.filter(User.role == role.value)
            if department:
                if isinstance(department, list):
                    dept_values = [
                        value
                        for item in department
                        for value in UserService._department_variants(item.value if hasattr(item, "value") else item)
                        if value
                    ]
                    query = query.filter(User.department.in_(dept_values))
                else:
                    dept_value = department.value if hasattr(department, "value") else department
                    query = query.filter(User.department.in_(UserService._department_variants(dept_value)))
            if active is not None:
                query = query.filter(User.active == active)
            if plant_area:
                plant_value = f"%{plant_area.strip()}%"
                query = query.filter(User.plant_location.ilike(plant_value))
            if initiator is not None:
                has_initiator_permission = exists().where(
                    UserPermission.user_id == User.id,
                    UserPermission.permission == PermissionCode.INITIATE_PSSR.value,
                    UserPermission.active.is_(True),
                )
                query = query.filter(has_initiator_permission if initiator else ~has_initiator_permission)
            if search:
                search_value = f"%{search.strip()}%"
                query = query.filter(
                    or_(
                        User.employee_id.ilike(search_value),
                        User.full_name.ilike(search_value),
                        User.email.ilike(search_value),
                        User.department.ilike(search_value),
                        User.designation.ilike(search_value),
                    )
                )
            return query

        total_records = apply_filters(db.query(func.count(User.id))).scalar() or 0

        # Select only columns needed by the directory table. Avoiding SELECT *
        # reduces database IO and serialization cost for high-volume grids.
        rows = (
            apply_filters(
                db.query(
                    User.id,
                    User.employee_id,
                    User.full_name,
                    User.email,
                    User.role,
                    User.department,
                    User.designation,
                    User.plant_location,
                    User.active,
                    User.last_login_at,
                )
            )
            .order_by(User.employee_id.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        active_initiator_ids = UserPermissionRepository.active_user_ids(
            db,
            [row.id for row in rows],
            PermissionCode.INITIATE_PSSR,
        )

        records = [
            {
                "id": row.id,
                "employee_id": row.employee_id,
                "full_name": row.full_name,
                "email": row.email,
                "role": row.role,
                "department": row.department,
                "designation": row.designation,
                "plant_location": row.plant_location,
                "active": row.active,
                "dashboard_path": dashboard_path_for_role(row.role),
                "is_pssr_initiator": row.id in active_initiator_ids,
                "last_login_at": (
                    row.last_login_at.isoformat() if row.last_login_at else None
                ),
            }
            for row in rows
        ]

        return {
            "records": records,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_records": total_records,
                "total_pages": ceil(total_records / limit) if limit else 0,
            },
        }

    @staticmethod
    def get_team_members_available_for_assignment(
        db: Session,
        department: Optional[str] = None,
    ) -> List[UserProfileResponse]:
        """Return active TEAM_MEMBER users eligible for department work or capability grants."""

        query = db.query(User).filter(
            User.active.is_(True),
            User.role == UserRole.TEAM_MEMBER.value,
        )
        if department:
            dept_value = department.value if hasattr(department, "value") else department
            query = query.filter(User.department == dept_value)

        return [
            UserService.build_user_profile(db, user)
            for user in query.order_by(User.full_name.asc()).all()
        ]

    @staticmethod
    def _department_variants(department: Optional[str]) -> list[str]:
        """Return canonical department aliases used by PSSR forms and seed data."""

        if not department:
            return []
        value = department.strip()
        lowered = value.lower()
        aliases = {
            "safety / psm": ["Safety", "HSE"],
            "operations": ["Operations", "PM Operation"],
            "operation": ["Operations", "PM Operation"],
            "instrumentation": ["Instrumentation", "Instrumental"],
            "instrumental": ["Instrumental", "Instrumentation"],
            "others": ["Others", "IT", "Administration"],
        }
        return list(dict.fromkeys([value, *aliases.get(lowered, [])]))

    @staticmethod
    def update_user(
        db: Session,
        user_id: int,
        update_data: UserUpdateRequest,
        updated_by: User,
    ) -> UserProfileResponse:
        """Apply an ADMIN-approved partial user update."""

        user = UserService.get_by_id(db, user_id)
        if not user:
            raise ResourceNotFoundError("User", user_id)

        update_dict = update_data.model_dump(exclude_none=True)
        for field, value in update_dict.items():
            if hasattr(value, "value"):
                value = value.value
            if field == "email" and isinstance(value, str):
                value = value.strip().lower()
            if hasattr(user, field):
                setattr(user, field, value)

        user.updated_by_user_id = updated_by.id
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return UserService.build_user_profile(db, user)

    @staticmethod
    def deactivate_user(db: Session, user_id: int, admin_id: int) -> User:
        """
        Soft-deactivate a user account.

        Soft deletion preserves historical approvals, assignments, and audit
        evidence, which is required in industrial compliance environments.
        """

        user = UserService.get_by_id(db, user_id)
        if not user:
            raise ResourceNotFoundError("User", user_id)
        user.active = False
        user.deleted_at = datetime.now(timezone.utc)
        user.deleted_by_user_id = admin_id
        user.updated_by_user_id = admin_id
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def set_user_status(db: Session, user_id: int, active: bool, admin_id: int) -> UserProfileResponse:
        """Enable or disable a user while retaining audit metadata."""

        user = UserService.get_by_id(db, user_id)
        if not user:
            raise ResourceNotFoundError("User", user_id)
        user.active = active
        user.updated_by_user_id = admin_id
        user.updated_at = datetime.now(timezone.utc)
        if active:
            user.deleted_at = None
            user.deleted_by_user_id = None
        else:
            user.deleted_at = datetime.now(timezone.utc)
            user.deleted_by_user_id = admin_id
        db.commit()
        db.refresh(user)
        return UserService.build_user_profile(db, user)

    @staticmethod
    def reset_user_permissions(db: Session, user_id: int, admin_id: int, reason: Optional[str] = None) -> UserProfileResponse:
        """Revoke all active user capability grants for audit-safe access reset."""

        user = UserService.get_by_id(db, user_id)
        if not user:
            raise ResourceNotFoundError("User", user_id)
        now = datetime.now(timezone.utc)
        grants = (
            db.query(UserPermission)
            .filter(UserPermission.user_id == user_id, UserPermission.active.is_(True))
            .all()
        )
        for grant in grants:
            grant.active = False
            grant.revoked_by_user_id = admin_id
            grant.revoked_at = now
            grant.revoke_reason = reason or "Permissions reset by admin."
            grant.updated_at = now
        user.updated_by_user_id = admin_id
        user.updated_at = now
        db.commit()
        db.refresh(user)
        return UserService.build_user_profile(db, user)

    @staticmethod
    def list_department_users_paginated(
        db: Session,
        department_name: str,
        department_code: Optional[str] = None,
        page: int = 1,
        limit: int = 25,
        role: Optional[UserRole] = None,
        active: Optional[bool] = None,
        initiator: Optional[bool] = None,
        plant_area: Optional[str] = None,
        search: Optional[str] = None,
    ) -> dict:
        """Return users for one department with workflow and responsibility rollups."""

        result = UserService.list_users_paginated(
            db=db,
            page=page,
            limit=limit,
            role=role,
            department=[item for item in [department_name, department_code] if item],
            active=active,
            initiator=initiator,
            plant_area=plant_area,
            search=search,
        )
        records = result["records"]
        user_ids = [record["id"] for record in records]
        workload_by_user = dict(
            db.query(PSSRTask.assigned_to_user_id, func.count(PSSRTask.id))
            .filter(PSSRTask.assigned_to_user_id.in_(user_ids))
            .group_by(PSSRTask.assigned_to_user_id)
            .all()
        ) if user_ids else {}
        pending_by_user = dict(
            db.query(PSSRTask.assigned_to_user_id, func.count(PSSRTask.id))
            .filter(
                PSSRTask.assigned_to_user_id.in_(user_ids),
                PSSRTask.status.in_(["To Do", "In Progress", "Pending Review"]),
            )
            .group_by(PSSRTask.assigned_to_user_id)
            .all()
        ) if user_ids else {}
        annexures = (
            db.query(Annexure.code, Annexure.title)
            .join(AnnexureDepartment, AnnexureDepartment.annexure_id == Annexure.id)
            .filter(
                AnnexureDepartment.department_id.in_(
                    [item for item in [department_name, department_code] if item]
                ),
                Annexure.active.is_(True),
                Annexure.is_deleted.is_(False),
            )
            .order_by(Annexure.sort_order.asc(), Annexure.number.asc())
            .limit(12)
            .all()
        )
        responsibilities = [{"code": row.code, "title": row.title} for row in annexures]
        for record in records:
            record["operational_unit"] = record.get("plant_location")
            record["assigned_pssr_count"] = workload_by_user.get(record["id"], 0)
            record["pending_tasks_count"] = pending_by_user.get(record["id"], 0)
            record["annexure_responsibilities"] = responsibilities
        return result
