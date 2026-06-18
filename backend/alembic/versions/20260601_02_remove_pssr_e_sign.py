"""remove pssr e sign workflow artifacts

Revision ID: 20260601_02
Revises: 20260601_01
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260601_02"
down_revision = "20260601_01"
branch_labels = None
depends_on = None


ASSIGNMENTS = "pssr_team_member_assignments"
SIGNATURES = "pssr_e_signatures"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if SIGNATURES in tables:
        op.drop_table(SIGNATURES)

    if ASSIGNMENTS in tables:
        columns = {column["name"] for column in inspector.get_columns(ASSIGNMENTS)}
        if bind.dialect.name != "sqlite":
            if "e_sign_status" in columns:
                op.drop_column(ASSIGNMENTS, "e_sign_status")
            if "signed_at" in columns:
                op.drop_column(ASSIGNMENTS, "signed_at")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if ASSIGNMENTS in tables:
        columns = {column["name"] for column in inspector.get_columns(ASSIGNMENTS)}
        if bind.dialect.name != "sqlite":
            if "e_sign_status" not in columns:
                op.add_column(ASSIGNMENTS, sa.Column("e_sign_status", sa.String(length=40), nullable=False, server_default="PENDING"))
            if "signed_at" not in columns:
                op.add_column(ASSIGNMENTS, sa.Column("signed_at", sa.DateTime(), nullable=True))

    if SIGNATURES not in tables:
        op.create_table(
            SIGNATURES,
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("pssr_id", sa.String(length=64), nullable=False, index=True),
            sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("pssr_team_member_assignments.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("department", sa.String(length=120), nullable=False, index=True),
            sa.Column("signer_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("signature_type", sa.String(length=60), nullable=False, server_default="DEPARTMENT_COMPLETION", index=True),
            sa.Column("validation_hash", sa.String(length=128), nullable=False),
            sa.Column("signed_at", sa.DateTime(), nullable=False),
        )
