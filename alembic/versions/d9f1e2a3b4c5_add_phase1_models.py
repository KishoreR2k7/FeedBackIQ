"""add_phase1_models

Revision ID: d9f1e2a3b4c5
Revises: c50d660a10ef
Create Date: 2026-10-29 15:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd9f1e2a3b4c5'
down_revision: Union[str, Sequence[str], None] = 'c50d660a10ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create locations table
    op.create_table(
        'locations',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'code', name='uq_locations_org_code')
    )
    op.create_index(op.f('ix_locations_org_id'), 'locations', ['org_id'], unique=False)
    op.create_index('ix_locations_org_id_created_at', 'locations', ['org_id', 'created_at'], unique=False)

    # 2. Add columns to users: name, pw_hash, manager_id, active, must_change_pw
    op.add_column('users', sa.Column('name', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('pw_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('manager_id', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('must_change_pw', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # Populate name and pw_hash from full_name and hashed_password for existing rows
    op.execute("UPDATE users SET name = full_name WHERE name IS NULL")
    op.execute("UPDATE users SET pw_hash = hashed_password WHERE pw_hash IS NULL")
    op.execute("UPDATE users SET active = is_active WHERE active IS NULL")

    # Set nullable=False for name and pw_hash now that existing rows have data
    op.alter_column('users', 'name', nullable=False)
    op.alter_column('users', 'pw_hash', nullable=False)
    op.alter_column('users', 'hashed_password', nullable=True)
    op.alter_column('users', 'full_name', nullable=True)
    op.alter_column('users', 'is_active', nullable=True)

    # Foreign key for manager_id
    op.create_foreign_key('fk_users_manager_id', 'users', 'users', ['manager_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_users_manager_id'), 'users', ['manager_id'], unique=False)

    # 3. Add incharge_id to departments
    op.add_column('departments', sa.Column('incharge_id', sa.BigInteger(), nullable=True))
    op.execute("UPDATE departments SET incharge_id = in_charge_user_id WHERE incharge_id IS NULL")
    op.create_foreign_key('fk_departments_incharge_id', 'departments', 'users', ['incharge_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_departments_incharge_id'), 'departments', ['incharge_id'], unique=False)


def downgrade() -> None:
    op.drop_constraint('fk_departments_incharge_id', 'departments', type_='foreignkey')
    op.drop_index(op.f('ix_departments_incharge_id'), table_name='departments')
    op.drop_column('departments', 'incharge_id')

    op.drop_constraint('fk_users_manager_id', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_manager_id'), table_name='users')
    op.drop_column('users', 'must_change_pw')
    op.drop_column('users', 'active')
    op.drop_column('users', 'manager_id')
    op.drop_column('users', 'pw_hash')
    op.drop_column('users', 'name')

    op.drop_index('ix_locations_org_id_created_at', table_name='locations')
    op.drop_index(op.f('ix_locations_org_id'), table_name='locations')
    op.drop_table('locations')
