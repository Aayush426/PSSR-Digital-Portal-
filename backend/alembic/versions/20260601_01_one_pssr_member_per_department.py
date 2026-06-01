"""enforce one pssr team member per department

Revision ID: 20260601_01
Revises: 20260528_01
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260601_01"
down_revision = "20260528_01"
branch_labels = None
depends_on = None


TABLE_NAME = "pssr_team_member_assignments"
OLD_UNIQUE = "uq_pssr_assignment_department_user"
NEW_UNIQUE = "uq_pssr_assignment_department"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE_NAME not in inspector.get_table_names():
        return

    if bind.dialect.name == "sqlite":
        return

    unique_names = {constraint["name"] for constraint in inspector.get_unique_constraints(TABLE_NAME)}
    if OLD_UNIQUE in unique_names:
        op.drop_constraint(OLD_UNIQUE, TABLE_NAME, type_="unique")
    if NEW_UNIQUE not in unique_names:
        op.create_unique_constraint(NEW_UNIQUE, TABLE_NAME, ["pssr_id", "department"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE_NAME not in inspector.get_table_names():
        return

    if bind.dialect.name == "sqlite":
        return

    unique_names = {constraint["name"] for constraint in inspector.get_unique_constraints(TABLE_NAME)}
    if NEW_UNIQUE in unique_names:
        op.drop_constraint(NEW_UNIQUE, TABLE_NAME, type_="unique")
    if OLD_UNIQUE not in unique_names:
        op.create_unique_constraint(OLD_UNIQUE, TABLE_NAME, ["pssr_id", "department", "user_id"])
