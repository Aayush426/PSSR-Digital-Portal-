"""
Global exception handling.

Routes and services can fail in different ways, but clients should receive a
stable response envelope. Centralizing exception handling also gives security
teams a single place to add incident telemetry later.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.core.responses import error_response

logger = get_logger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach enterprise response handlers to the FastAPI application."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        logger.warning(
            exc.message,
            extra={"request_id": getattr(request.state, "request_id", "-")},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.message, exc.status_code, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(str(exc.detail), exc.status_code),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=error_response("Request validation failed.", 422, exc.errors()),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        logger.exception(
            "Unhandled application error",
            extra={"request_id": getattr(request.state, "request_id", "-")},
        )
        return JSONResponse(
            status_code=500,
            content=error_response("Internal server error.", 500),
        )
