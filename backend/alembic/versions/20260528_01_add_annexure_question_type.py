"""add annexure question checkpoint type

Revision ID: 20260528_01
Revises:
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa


revision = "20260528_01"
down_revision = None
branch_labels = None
depends_on = None


TABLE_NAME = "annexure_questions"
COLUMN_NAME = "question_type"
CHECK_NAME = "ck_annexure_questions_question_type"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE_NAME not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns(TABLE_NAME)}
    if COLUMN_NAME not in existing_columns:
        op.add_column(
            TABLE_NAME,
            sa.Column(COLUMN_NAME, sa.String(length=20), nullable=False, server_default="FIELD"),
        )

    op.execute(
        sa.text(
            f"UPDATE {TABLE_NAME} "
            f"SET {COLUMN_NAME} = 'FIELD' "
            f"WHERE {COLUMN_NAME} IS NULL OR {COLUMN_NAME} NOT IN ('DOCUMENT', 'FIELD')"
        )
    )

    if bind.dialect.name != "sqlite":
        op.alter_column(TABLE_NAME, COLUMN_NAME, server_default=None, existing_type=sa.String(length=20))
        constraints = {constraint["name"] for constraint in inspector.get_check_constraints(TABLE_NAME)}
        if CHECK_NAME not in constraints:
            op.create_check_constraint(CHECK_NAME, TABLE_NAME, f"{COLUMN_NAME} IN ('DOCUMENT', 'FIELD')")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE_NAME not in inspector.get_table_names():
        return

    if bind.dialect.name != "sqlite":
        constraints = {constraint["name"] for constraint in inspector.get_check_constraints(TABLE_NAME)}
        if CHECK_NAME in constraints:
            op.drop_constraint(CHECK_NAME, TABLE_NAME, type_="check")

    existing_columns = {column["name"] for column in inspector.get_columns(TABLE_NAME)}
    if COLUMN_NAME in existing_columns:
        op.drop_column(TABLE_NAME, COLUMN_NAME)
