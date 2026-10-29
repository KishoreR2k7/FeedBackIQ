"""initial_feedbackiq_schema

Revision ID: c50d660a10ef
Revises: 
Create Date: 2026-10-29 14:04:19.357389

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c50d660a10ef'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Attempt vector extension (enabled in pgvector docker container)
    conn = op.get_bind()
    try:
        with conn.begin_nested():
            conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception:
        pass

    # 1. Organizations
    op.create_table(
        'organizations',
        sa.Column('org_id', sa.BigInteger(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('org_type', sa.String(length=50), nullable=False),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("org_type IN ('college_mess', 'restaurant_chain', 'cafeteria', 'hospital', 'other')", name='check_org_type_valid'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organizations_org_id'), 'organizations', ['org_id'], unique=False)
    op.create_index('ix_organizations_org_id_created_at', 'organizations', ['org_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=True)

    # 2. Roles
    op.create_table(
        'roles',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'name', name='uq_roles_org_name')
    )
    op.create_index(op.f('ix_roles_org_id'), 'roles', ['org_id'], unique=False)
    op.create_index('ix_roles_org_id_created_at', 'roles', ['org_id', 'created_at'], unique=False)

    # 3. Permissions
    op.create_table(
        'permissions',
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'code', name='uq_permissions_org_code')
    )
    op.create_index(op.f('ix_permissions_org_id'), 'permissions', ['org_id'], unique=False)
    op.create_index('ix_permissions_org_id_created_at', 'permissions', ['org_id', 'created_at'], unique=False)

    # 4. Role Permissions
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.BigInteger(), nullable=False),
        sa.Column('permission_id', sa.BigInteger(), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')
    )
    op.create_index(op.f('ix_role_permissions_org_id'), 'role_permissions', ['org_id'], unique=False)
    op.create_index('ix_role_permissions_org_id_created_at', 'role_permissions', ['org_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_role_permissions_permission_id'), 'role_permissions', ['permission_id'], unique=False)
    op.create_index(op.f('ix_role_permissions_role_id'), 'role_permissions', ['role_id'], unique=False)

    # 5. Departments (initially without FK to users)
    op.create_table(
        'departments',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('in_charge_user_id', sa.BigInteger(), nullable=True),
        sa.Column('sla_hours_p1', sa.Integer(), nullable=False),
        sa.Column('sla_hours_p2', sa.Integer(), nullable=False),
        sa.Column('sla_hours_p3', sa.Integer(), nullable=False),
        sa.Column('sla_hours_p4', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'code', name='uq_departments_org_code')
    )
    op.create_index(op.f('ix_departments_in_charge_user_id'), 'departments', ['in_charge_user_id'], unique=False)
    op.create_index(op.f('ix_departments_org_id'), 'departments', ['org_id'], unique=False)
    op.create_index('ix_departments_org_id_created_at', 'departments', ['org_id', 'created_at'], unique=False)

    # 6. Users
    op.create_table(
        'users',
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('role_id', sa.BigInteger(), nullable=True),
        sa.Column('department_id', sa.BigInteger(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_superuser', sa.Boolean(), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('org_id', 'email', name='uq_users_org_email')
    )
    op.create_index(op.f('ix_users_department_id'), 'users', ['department_id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    op.create_index(op.f('ix_users_org_id'), 'users', ['org_id'], unique=False)
    op.create_index('ix_users_org_id_created_at', 'users', ['org_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)

    # 7. Add foreign key on departments pointing to users
    op.create_foreign_key(
        'fk_departments_in_charge_user_id',
        'departments',
        'users',
        ['in_charge_user_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # 8. Agent Runs
    op.create_table(
        'agent_runs',
        sa.Column('agent_name', sa.String(length=100), nullable=False),
        sa.Column('model_used', sa.String(length=100), nullable=False),
        sa.Column('prompt_preview', sa.String(length=1000), nullable=False),
        sa.Column('response_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('fallback_attempts', sa.Integer(), nullable=False),
        sa.Column('error_message', sa.String(length=1000), nullable=True),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('success', 'failed', 'fallback', 'rules')", name='check_agent_run_status_valid'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_agent_runs_org_agent', 'agent_runs', ['org_id', 'agent_name'], unique=False)
    op.create_index(op.f('ix_agent_runs_org_id'), 'agent_runs', ['org_id'], unique=False)
    op.create_index('ix_agent_runs_org_id_created_at', 'agent_runs', ['org_id', 'created_at'], unique=False)

    # 9. Audit Logs
    op.create_table(
        'audit_logs',
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.BigInteger(), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_org_action', 'audit_logs', ['org_id', 'action'], unique=False)
    op.create_index(op.f('ix_audit_logs_org_id'), 'audit_logs', ['org_id'], unique=False)
    op.create_index('ix_audit_logs_org_id_created_at', 'audit_logs', ['org_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)

    # 10. Feedbacks
    op.create_table(
        'feedbacks',
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('raw_text', sa.String(length=4000), nullable=False),
        sa.Column('customer_name', sa.String(length=100), nullable=True),
        sa.Column('customer_contact', sa.String(length=100), nullable=True),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('location_table', sa.String(length=100), nullable=True),
        sa.Column('meal_type', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('department_id', sa.BigInteger(), nullable=True),
        sa.Column('sentiment', sa.String(length=30), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=True),
        sa.Column('urgency', sa.String(length=10), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('ai_analysis', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("channel IN ('qr_code', 'web_link', 'kiosk')", name='check_feedback_channel_valid'),
        sa.CheckConstraint("sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'critical')", name='check_feedback_sentiment_valid'),
        sa.CheckConstraint("status IN ('new', 'triaged', 'actioned', 'resolved', 'ignored')", name='check_feedback_status_valid'),
        sa.CheckConstraint("urgency IS NULL OR urgency IN ('P1', 'P2', 'P3', 'P4')", name='check_feedback_urgency_valid'),
        sa.CheckConstraint('rating >= 1 AND rating <= 5', name='check_feedback_rating_range'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_feedbacks_department_id'), 'feedbacks', ['department_id'], unique=False)
    op.create_index('ix_feedbacks_org_department', 'feedbacks', ['org_id', 'department_id'], unique=False)
    op.create_index(op.f('ix_feedbacks_org_id'), 'feedbacks', ['org_id'], unique=False)
    op.create_index('ix_feedbacks_org_id_created_at', 'feedbacks', ['org_id', 'created_at'], unique=False)
    op.create_index('ix_feedbacks_org_status', 'feedbacks', ['org_id', 'status'], unique=False)

    # 11. Tasks
    op.create_table(
        'tasks',
        sa.Column('feedback_id', sa.BigInteger(), nullable=True),
        sa.Column('department_id', sa.BigInteger(), nullable=False),
        sa.Column('assigned_to_user_id', sa.BigInteger(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=2000), nullable=False),
        sa.Column('priority', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.String(length=2000), nullable=True),
        sa.Column('sla_breached', sa.Boolean(), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("priority IN ('P1', 'P2', 'P3', 'P4')", name='check_task_priority_valid'),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'resolved', 'verified')", name='check_task_status_valid'),
        sa.ForeignKeyConstraint(['assigned_to_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['feedback_id'], ['feedbacks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tasks_assigned_to_user_id'), 'tasks', ['assigned_to_user_id'], unique=False)
    op.create_index(op.f('ix_tasks_department_id'), 'tasks', ['department_id'], unique=False)
    op.create_index(op.f('ix_tasks_feedback_id'), 'tasks', ['feedback_id'], unique=False)
    op.create_index(op.f('ix_tasks_org_id'), 'tasks', ['org_id'], unique=False)
    op.create_index('ix_tasks_org_id_created_at', 'tasks', ['org_id', 'created_at'], unique=False)
    op.create_index('ix_tasks_org_priority', 'tasks', ['org_id', 'priority'], unique=False)
    op.create_index('ix_tasks_org_status', 'tasks', ['org_id', 'status'], unique=False)

    # 12. Recurring Issues
    op.create_table(
        'recurring_issues',
        sa.Column('department_id', sa.BigInteger(), nullable=True),
        sa.Column('issue_fingerprint', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('frequency_count', sa.Integer(), nullable=False),
        sa.Column('predicted_root_cause', sa.String(length=2000), nullable=False),
        sa.Column('recommended_action', sa.String(length=2000), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('evidence_feedback_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('last_occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('active', 'mitigated', 'monitoring')", name='check_recurring_status_valid'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recurring_issues_department_id'), 'recurring_issues', ['department_id'], unique=False)
    op.create_index(op.f('ix_recurring_issues_org_id'), 'recurring_issues', ['org_id'], unique=False)
    op.create_index('ix_recurring_issues_org_id_created_at', 'recurring_issues', ['org_id', 'created_at'], unique=False)
    op.create_index('ix_recurring_issues_org_status', 'recurring_issues', ['org_id', 'status'], unique=False)

    # 13. Verifications
    op.create_table(
        'verifications',
        sa.Column('task_id', sa.BigInteger(), nullable=False),
        sa.Column('verified_by_user_id', sa.BigInteger(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('before_sentiment_score', sa.Float(), nullable=True),
        sa.Column('after_sentiment_score', sa.Float(), nullable=True),
        sa.Column('audit_notes', sa.String(length=2000), nullable=True),
        sa.Column('recurrence_detected', sa.Boolean(), nullable=False),
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('org_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('pending_audit', 'passed', 'failed', 'reopened')", name='check_verification_status_valid'),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['verified_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_verifications_org_id'), 'verifications', ['org_id'], unique=False)
    op.create_index('ix_verifications_org_id_created_at', 'verifications', ['org_id', 'created_at'], unique=False)
    op.create_index('ix_verifications_org_status', 'verifications', ['org_id', 'status'], unique=False)
    op.create_index(op.f('ix_verifications_task_id'), 'verifications', ['task_id'], unique=False)
    op.create_index(op.f('ix_verifications_verified_by_user_id'), 'verifications', ['verified_by_user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('verifications')
    op.drop_table('recurring_issues')
    op.drop_table('tasks')
    op.drop_table('feedbacks')
    op.drop_table('audit_logs')
    op.drop_table('agent_runs')
    op.drop_constraint('fk_departments_in_charge_user_id', 'departments', type_='foreignkey')
    op.drop_table('users')
    op.drop_table('departments')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
    op.drop_table('roles')
    op.drop_table('organizations')
