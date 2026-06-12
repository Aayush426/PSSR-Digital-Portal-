"""add punch point progress remarks and evidence

Revision ID: 20260612_04
Revises: 20260612_03
Create Date: 2026-06-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260612_04"
down_revision = "20260612_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    punch_columns = {column["name"] for column in inspector.get_columns("annexure_punch_points")}
    if "progress_remarks" not in punch_columns:
        op.add_column("annexure_punch_points", sa.Column("progress_remarks", sa.Text(), nullable=True))
    if "pssr_punch_point_evidence" in inspector.get_table_names():
        return
    op.create_table(
        "pssr_punch_point_evidence",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pssr_id", sa.String(length=64), nullable=False),
        sa.Column("punch_point_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=False),
        sa.Column("uploader_employee_code", sa.String(length=120), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["pssr_id"], ["pssr_workflows.pssr_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["punch_point_id"], ["annexure_punch_points.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pssr_punch_point_evidence_id"), "pssr_punch_point_evidence", ["id"], unique=False)
    op.create_index(op.f("ix_pssr_punch_point_evidence_pssr_id"), "pssr_punch_point_evidence", ["pssr_id"], unique=False)
    op.create_index(op.f("ix_pssr_punch_point_evidence_punch_point_id"), "pssr_punch_point_evidence", ["punch_point_id"], unique=False)
    op.create_index(op.f("ix_pssr_punch_point_evidence_uploaded_by_user_id"), "pssr_punch_point_evidence", ["uploaded_by_user_id"], unique=False)
    op.create_index(op.f("ix_pssr_punch_point_evidence_uploaded_at"), "pssr_punch_point_evidence", ["uploaded_at"], unique=False)
    op.create_index("ix_pssr_punch_evidence_pssr_punch", "pssr_punch_point_evidence", ["pssr_id", "punch_point_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_pssr_punch_evidence_pssr_punch", table_name="pssr_punch_point_evidence")
    op.drop_index(op.f("ix_pssr_punch_point_evidence_uploaded_at"), table_name="pssr_punch_point_evidence")
    op.drop_index(op.f("ix_pssr_punch_point_evidence_uploaded_by_user_id"), table_name="pssr_punch_point_evidence")
    op.drop_index(op.f("ix_pssr_punch_point_evidence_punch_point_id"), table_name="pssr_punch_point_evidence")
    op.drop_index(op.f("ix_pssr_punch_point_evidence_pssr_id"), table_name="pssr_punch_point_evidence")
    op.drop_index(op.f("ix_pssr_punch_point_evidence_id"), table_name="pssr_punch_point_evidence")
    op.drop_table("pssr_punch_point_evidence")
    op.drop_column("annexure_punch_points", "progress_remarks")
