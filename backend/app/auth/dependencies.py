"""
Authentication and RBAC dependencies.

These dependencies are the backend security boundary. Frontend guards improve
user experience, but every protected API route must depend on one of these
functions so authorization remains enforceable by the server.
"""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwt_handler import decode_access_token
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.database.session import get_db
from app.models.assignment import PSSRInitiatorAssignment
from app.models.user import AssignmentStatus, User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def _role_value(user: User) -> str:
    """Normalize stored role values for comparisons during migrations."""

    return user.role.value if hasattr(user.role, "value") else str(user.role)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolve the authenticated user from the bearer token.

    The database lookup is deliberate. It lets admins deactivate accounts or
    change roles and have that state enforced immediately without waiting for a
    token to expire.
    """

    if not credentials or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Bearer authentication token is required.")

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub")
    if not subject:
        raise AuthenticationError("Authentication token is missing subject.")

    user = db.query(User).filter(User.id == int(subject)).first()
    if not user or not user.active:
        raise AuthenticationError("Authenticated user is inactive or unavailable.")
    return user


def require_role(required_role: UserRole):
    """
    Build a reusable role dependency.

    Keeping this as a factory prevents inline lambdas and gives route modules a
    consistent RBAC vocabulary that can later emit authorization audit events.
    """

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if _role_value(current_user) != required_role.value:
            raise AuthorizationError(f"{required_role.value} access required.")
        return current_user

    return dependency


def require_role_or_admin(required_role: UserRole):
    """Build a role dependency that also permits ADMIN operational override."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        role = _role_value(current_user)
        if role not in {required_role.value, UserRole.ADMIN.value}:
            raise AuthorizationError(f"{required_role.value} access required.")
        return current_user

    return dependency


require_admin = require_role(UserRole.ADMIN)
require_team_member = require_role(UserRole.TEAM_MEMBER)
require_area_owner = require_role(UserRole.AREA_OWNER)
require_team_member_or_admin = require_role_or_admin(UserRole.TEAM_MEMBER)


def require_pssr_initiator(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Allow ADMIN users or TEAM_MEMBER users with an active initiator assignment.

    PSSR_INITIATOR is intentionally not a permanent role. This dependency checks
    dynamic assignment state, which scales to project, shutdown, or unit-level
    initiator authority without changing the identity model.
    """

    role = _role_value(current_user)
    if role == UserRole.ADMIN.value:
        return current_user

    if role != UserRole.TEAM_MEMBER.value:
        raise AuthorizationError("PSSR initiator access requires TEAM_MEMBER assignment.")

    has_active_assignment = (
        db.query(PSSRInitiatorAssignment)
        .filter(
            PSSRInitiatorAssignment.user_id == current_user.id,
            PSSRInitiatorAssignment.status == AssignmentStatus.ACTIVE.value,
        )
        .first()
        is not None
    )

    if not has_active_assignment:
        raise AuthorizationError("Active PSSR initiator assignment required.")
    return current_user
