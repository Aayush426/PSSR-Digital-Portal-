"""
Domain exception types.

Services raise these exceptions instead of FastAPI HTTPException so business
logic remains framework-light and can later be reused by workers or workflow
engines.
"""

from typing import Any


class AppError(Exception):
    """Base application exception with an HTTP mapping."""

    status_code = 400

    def __init__(self, message: str, details: Any = None) -> None:
        self.message = message
        self.details = details
        super().__init__(message)


class AuthenticationError(AppError):
    status_code = 401


class AuthorizationError(AppError):
    status_code = 403


class ResourceNotFoundError(AppError):
    status_code = 404

    def __init__(self, resource: str, identifier: Any) -> None:
        super().__init__(f"{resource} not found.", {"identifier": str(identifier)})


class ConflictError(AppError):
    status_code = 409


class ValidationError(AppError):
    status_code = 422
