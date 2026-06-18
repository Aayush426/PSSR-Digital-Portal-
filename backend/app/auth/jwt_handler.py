"""
JWT creation and validation helpers.

JWTs are used only as bearer access tokens. Authorization decisions still occur
on the backend through dependencies and services because frontend route guards
are convenience controls, not security boundaries.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import JWTError, jwt

from app.config.settings import settings
from app.core.exceptions import AuthenticationError


def create_access_token(subject: str, claims: Dict[str, Any]) -> str:
    """
    Create a signed access token for an authenticated user.

    The token carries a minimal identity snapshot for performance, while
    `get_current_user` still reloads the user from the database to enforce
    active-account checks and current RBAC state.
    """

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": subject,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        **claims,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""

    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired authentication token.") from exc
