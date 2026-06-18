"""
Authentication service.

Authentication logic stays outside routes so the same behavior can later support
SSO callback handlers, service-account login, or CLI administration tools.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth.jwt_handler import create_access_token
from app.auth.password_handler import verify_password
from app.config.settings import settings
from app.core.exceptions import AuthenticationError
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.user_service import UserService


class AuthService:
    """Enterprise authentication workflows."""

    @staticmethod
    def authenticate_user(db: Session, login_data: LoginRequest) -> TokenResponse:
        """
        Validate credentials, update login metadata, and issue a JWT.

        Invalid email and invalid password intentionally return the same error
        to reduce account-enumeration risk.
        """

        user = UserService.get_by_email(db, login_data.email)
        if not user or not user.active:
            raise AuthenticationError("Invalid credentials or inactive account.")

        if not verify_password(login_data.password, user.password_hash):
            raise AuthenticationError("Invalid credentials or inactive account.")

        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

        profile = UserService.build_user_profile(db, user)
        token = create_access_token(
            subject=str(user.id),
            claims={
                "employee_id": user.employee_id,
                "role": profile.role,
            },
        )

        return TokenResponse(
            access_token=token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=profile,
        )

    @staticmethod
    def get_current_user_profile(db: Session, current_user):
        """Return the enriched profile for an already-authenticated user."""

        return UserService.build_user_profile(db, current_user)
