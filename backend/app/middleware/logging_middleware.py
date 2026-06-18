"""
Request ID and access logging middleware.

Every request receives or preserves an X-Request-ID. That correlation ID is
returned to the frontend and written to logs, which is essential when reviewing
workflow approvals, failed login attempts, or integration calls across systems.
"""

import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Attach request IDs and write structured access logs."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        request.state.request_id = request_id
        started_at = time.perf_counter()

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.info(
            (
                f"{request.method} {request.url.path} "
                f"status={response.status_code} duration_ms={duration_ms}"
            ),
            extra={"request_id": request_id},
        )
        return response
