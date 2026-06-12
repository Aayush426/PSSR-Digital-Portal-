"""add pssr checkpoint attachments

Revision ID: 20260612_01
Revises: 20260601_02
Create Date: 2026-06-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260612_01"
down_revision = "20260601_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pssr_checkpoint_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pssr_id", sa.String(length=64), nullable=False),
        sa.Column("checkpoint_id", sa.Integer(), nullable=False),
        sa.Column("response_id", sa.Integer(), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=False),
        sa.Column("uploader_employee_code", sa.String(length=120), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["checkpoint_id"], ["pssr_questions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pssr_id"], ["pssr_workflows.pssr_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["response_id"], ["pssr_question_responses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pssr_checkpoint_attachments_id"), "pssr_checkpoint_attachments", ["id"], unique=False)
    op.create_index("ix_pssr_checkpoint_attachments_pssr_checkpoint", "pssr_checkpoint_attachments", ["pssr_id", "checkpoint_id"], unique=False)
    op.create_index(op.f("ix_pssr_checkpoint_attachments_pssr_id"), "pssr_checkpoint_attachments", ["pssr_id"], unique=False)
    op.create_index(op.f("ix_pssr_checkpoint_attachments_checkpoint_id"), "pssr_checkpoint_attachments", ["checkpoint_id"], unique=False)
    op.create_index(op.f("ix_pssr_checkpoint_attachments_response_id"), "pssr_checkpoint_attachments", ["response_id"], unique=False)
    op.create_index(op.f("ix_pssr_checkpoint_attachments_uploaded_by_user_id"), "pssr_checkpoint_attachments", ["uploaded_by_user_id"], unique=False)
    op.create_index(op.f("ix_pssr_checkpoint_attachments_uploaded_at"), "pssr_checkpoint_attachments", ["uploaded_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_pssr_checkpoint_attachments_uploaded_at"), table_name="pssr_checkpoint_attachments")
    op.drop_index(op.f("ix_pssr_checkpoint_attachments_uploaded_by_user_id"), table_name="pssr_checkpoint_attachments")
    op.drop_index(op.f("ix_pssr_checkpoint_attachments_response_id"), table_name="pssr_checkpoint_attachments")
    op.drop_index(op.f("ix_pssr_checkpoint_attachments_checkpoint_id"), table_name="pssr_checkpoint_attachments")
    op.drop_index(op.f("ix_pssr_checkpoint_attachments_pssr_id"), table_name="pssr_checkpoint_attachments")
    op.drop_index("ix_pssr_checkpoint_attachments_pssr_checkpoint", table_name="pssr_checkpoint_attachments")
    op.drop_index(op.f("ix_pssr_checkpoint_attachments_id"), table_name="pssr_checkpoint_attachments")
    op.drop_table("pssr_checkpoint_attachments")
