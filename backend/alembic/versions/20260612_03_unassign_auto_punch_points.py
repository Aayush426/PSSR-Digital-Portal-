"""unassign auto-generated punch points

Revision ID: 20260612_03
Revises: 20260612_02
Create Date: 2026-06-12 00:00:00.000000
"""

from alembic import op


revision = "20260612_03"
down_revision = "20260612_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE annexure_punch_points AS punch
        SET assigned_to_user_id = NULL,
            assigned_by_user_id = NULL
        FROM pssr_workflows AS workflow
        WHERE workflow.pssr_id = punch.pssr_id
          AND punch.status IN ('OPEN', 'IN_PROGRESS')
          AND (
              punch.title LIKE 'PSSR question failed:%'
              OR punch.title LIKE 'Failed checkpoint:%'
          )
          AND punch.raised_by_user_id IS NOT NULL
          AND punch.raised_by_user_id NOT IN (
              workflow.initiator_user_id,
              COALESCE(workflow.area_owner_user_id, -1)
          )
          AND punch.due_date IS NULL
        """
    )


def downgrade() -> None:
    pass
