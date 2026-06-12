"""enforce one pssr team member per department

Revision ID: 20260601_01
Revises: 20260528_01
Create Date: 2026-06-01
"""

from alembic import op

revision = "20260601_01"
down_revision = "20260528_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Disabled migration.

    Existing production data contains multiple team members
    per department for a single PSSR. Creating a unique
    constraint on (pssr_id, department) would fail and
    would also break the current workflow design.

    Migration intentionally left empty.
    """
    pass


def downgrade() -> None:
    """
    No-op downgrade.
    """
    pass