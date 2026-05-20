"""
Standard API response envelope.

Using one envelope keeps frontend error handling predictable and helps future
audit/reporting integrations parse API outcomes consistently across modules.
"""

from math import ceil
from typing import Any, Dict, Optional


def success_response(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    """Return the standard success response used by route handlers."""

    return {"success": True, "message": message, "data": data, "error": None}


def error_response(
    message: str,
    status_code: int,
    details: Optional[Any] = None,
) -> Dict[str, Any]:
    """Return the standard error response used by exception handlers."""

    return {
        "success": False,
        "message": message,
        "data": None,
        "error": {"status_code": status_code, "details": details},
    }


def paginated_response(
    data: Any,
    total: int,
    page: int,
    per_page: int,
    message: str = "Records retrieved.",
) -> Dict[str, Any]:
    """Return paginated data with metadata needed by enterprise data grids."""

    return success_response(
        data={
            "items": data,
            "pagination": {
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": ceil(total / per_page) if per_page else 0,
            },
        },
        message=message,
    )
