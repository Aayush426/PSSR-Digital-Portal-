"""
User domain service.

Routes delegate user lookup, filtering, profile enrichment, and update behavior
to this service so controllers stay thin and business rules have one home.
"""

from datetime import datetime, timezone
from math import ceil
from typing import List, Optional, Tuple

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundError
from app.models.assignment import PSSRInitiatorAssignment
from app.models.user import AssignmentStatus, User, UserRole
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
        """Check whether a TEAM_MEMBER has any active initiator assignment."""

        return (
            db.query(PSSRInitiatorAssignment)
            .filter(
                PSSRInitiatorAssignment.user_id == user.id,
                PSSRInitiatorAssignment.status == AssignmentStatus.ACTIVE.value,
            )
            .first()
            is not None
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
            is_pssr_initiator=(
                UserService.is_pssr_initiator(db, user) if check_initiator else False
            ),
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
        department: Optional[str] = None,
        active: Optional[bool] = None,
        search: Optional[str] = None,
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
                dept_value = department.value if hasattr(department, "value") else department
                query = query.filter(User.department == dept_value)
            if active is not None:
                query = query.filter(User.active == active)
            if search:
                search_value = f"%{search.strip()}%"
                query = query.filter(
                    or_(
                        User.employee_id.ilike(search_value),
                        User.full_name.ilike(search_value),
                        User.email.ilike(search_value),
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
                "is_pssr_initiator": False,
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
        """Return active TEAM_MEMBER users eligible for initiator assignment."""

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
            if hasattr(user, field):
                setattr(user, field, value)

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
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user
