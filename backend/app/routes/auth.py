"""
This file comtains :
PSSR Portal - Authentication Routes

Endpoints:
    POST /api/v1/auth/login   — Authenticate and receive JWT
    GET  /api/v1/auth/me      — Get current user's profile
    POST /api/v1/auth/logout  — Client-side logout (token invalidation hint)

Enterprise Pattern documented for reference and consistency across all routes:
    - Route handlers are intentionally thin where all logic is in the service layer
    - Swagger documentation is embedded via docstrings + response_model
    - Security dependencies are injected via Depends() — not inline
    - All responses follow the enterprise envelope via success_response()
    - Logging is done at key events (login success, logout) with user context

"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.auth.dependencies import get_current_user
from app.services.auth_service import AuthService
from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse
from app.models.user import User
from app.core.responses import success_response
from app.core.logging import get_logger

logger = get_logger(__name__)


# Router Setup

# All routes prefixed with /auth are  mounted at /api/v1/auth in main.py
# tags=["Authentication"] groups these in Swagger UI


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)



# POST /auth/login


@router.post(
    "/login",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Authenticate the  user and retrieve JWT",
    description="""
    Authenticates a refinery portal user with email and password.

    Workflow:
    1.  First Validation of  email format and password length happens via Pydantic model (LoginRequest)
    2. Verifies the  bcrypted  password hash against stored hash
    3. Checks account active status (only active users can login)
    4. Generates a signed JWT access token
    5. Returns token + user profile with dashboard routing path

    RBAC:
    No authentication required (public endpoint).

    Security:
    - Returns identical error message for invalid email OR invalid password (anti-enumeration)
    - Failed attempts are logged for security monitoring
    - JWT token is valid for 8 hours (configurable as per environment)
    """,
    responses={
        200: {"description": "Login successful — JWT token returned"},
        401: {"description": "Invalid credentials or deactivated account"},
        422: {"description": "Request validation error (invalid email format, etc.)"},
    }
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Login endpoint — entry point for all user authentication.

    Returns a TokenResponse containing:
        - JWT access token (Bearer)
        - Token expiry in seconds
        - User profile with dashboard_path for frontend routing

    The `dashboard_path` will  tell the frontend where to redirect:
        - ADMIN       → /admin/dashboard
        - TEAM_MEMBER → /team/dashboard
        - AREA_OWNER  → /area-owner/dashboard
    """
    token_response = AuthService.authenticate_user(db, login_data)

    logger.info(
        f"Login successful: email={login_data.email} "
        f"role={token_response.user.role}"
    )

    return success_response(
        data=token_response.model_dump(),
        message="Authentication successful. Welcome to the PSSR Portal.",
    )



# GET /auth/me


@router.get(
    "/me",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user's profile",
    description="""
    Returns the full profile of the currently authenticated user.

    Workflow:
    1. Validating the Bearer token from Authorization header
    2. Looks up user from database (that confirms active status)
    3. Enriches the profile with dashboard_path and PSSR initiator status

    RBAC:
    Requires valid JWT Bearer token (any role).

    Use Cases:
    - Frontend fetches this on the portal load to hydrate the user context
    - Frontend re-fetches when user navigates to profile settings
    - Used to determine if a TEAM_MEMBER currently has INITIATE_PSSR capability
    """,
    responses={
        200: {"description": "User profile returned successfully"},
        401: {"description": "Missing, invalid, or expired token"},
    }
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the authenticated user's full profile.

    Includes:
        - Permanent role and department
        - Dashboard path for role-based navigation
        - is_pssr_initiator flag (dynamic, from user_permissions)
        - Last login timestamp for security display
    """
    profile = AuthService.get_current_user_profile(db, current_user)

    return success_response(
        data=profile.model_dump(mode="json"),
        message="User profile retrieved successfully.",
    )



# POST /auth/logout


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout — invalidate client-side token",
    description="""
    Signals the client to discard the necessary JWT token.

    Note on JWT Logout:
    JWTs are stateless so the server cannot truly invalidate them before the  expiry.
    This endpoint instructs the frontend to clear the necessary stored token.

    optional enhancement (Phase 2):
    For true server-side revocation, implementing a JWT blocklist in Redis.
    Tokens are added to the blocklist on logout and checked on every request.

    RBAC:
    Requires a valid JWT Bearer token (any role).
    """,
)
def logout(
    current_user: User = Depends(get_current_user),
):
    """
    Logout endpoint — instructs the client to clear the stored JWT.

    enhancementPhase 2:
        Add token to the Redis blocklist here for true server-side invalidation.
        Check blocklist in get_current_user() dependency.
    """
    logger.info(
        f"Logout: user_id={current_user.id} "
        f"employee_id={current_user.employee_id}"
    )

    return success_response(
        data=None,
        message="Logged out successfully. Please clear your authentication token.",
    )