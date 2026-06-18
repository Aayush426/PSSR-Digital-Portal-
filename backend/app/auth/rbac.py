"""
RBAC helper exports.

The concrete dependencies live in `auth.dependencies`; this module provides a
stable import location for future policy helpers such as area-scoped access,
approval authority, or SAP work-order visibility.
"""

from app.auth.dependencies import (
    require_admin,
    require_area_owner,
    require_create_pssr,
    require_permission,
    require_pssr_initiator,
    require_team_member,
)

__all__ = [
    "require_admin",
    "require_area_owner",
    "require_create_pssr",
    "require_permission",
    "require_pssr_initiator",
    "require_team_member",
]
