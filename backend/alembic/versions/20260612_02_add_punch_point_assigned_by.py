"""add punch point assigned by user

Revision ID: 20260612_02
Revises: 20260612_01
Create Date: 2026-06-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260612_02"
down_revision = "20260612_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("annexure_punch_points")}
    indexes = {index["name"] for index in inspector.get_indexes("annexure_punch_points")}
    foreign_keys = {foreign_key.get("name") for foreign_key in inspector.get_foreign_keys("annexure_punch_points")}
    if "assigned_by_user_id" not in columns:
        op.add_column("annexure_punch_points", sa.Column("assigned_by_user_id", sa.Integer(), nullable=True))
    if op.f("ix_annexure_punch_points_assigned_by_user_id") not in indexes:
        op.create_index(op.f("ix_annexure_punch_points_assigned_by_user_id"), "annexure_punch_points", ["assigned_by_user_id"], unique=False)
    if "fk_annexure_punch_points_assigned_by_user_id_users" not in foreign_keys:
        op.create_foreign_key(
            "fk_annexure_punch_points_assigned_by_user_id_users",
            "annexure_punch_points",
            "users",
            ["assigned_by_user_id"],
            ["id"],
        )
    op.execute(
        """
        UPDATE annexure_punch_points AS punch
        SET assigned_by_user_id = CASE
            WHEN punch.raised_by_user_id IN (workflow.initiator_user_id, workflow.area_owner_user_id)
                THEN punch.raised_by_user_id
            WHEN workflow.area_owner_user_id IS NOT NULL
                THEN workflow.area_owner_user_id
            ELSE workflow.initiator_user_id
        END
        FROM pssr_workflows AS workflow
        WHERE workflow.pssr_id = punch.pssr_id
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_annexure_punch_points_assigned_by_user_id_users", "annexure_punch_points", type_="foreignkey")
    op.drop_index(op.f("ix_annexure_punch_points_assigned_by_user_id"), table_name="annexure_punch_points")
    op.drop_column("annexure_punch_points", "assigned_by_user_id")
