"""004_tasks_and_notifications_schema

Revision ID: 004_tasks_and_notifications
Revises: 003_recurrence
Create Date: 2026-10-29 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004_tasks_and_notifications"
down_revision: Union[str, None] = "003_recurrence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. action_tasks table
    op.create_table(
        "action_tasks",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issue_cluster_key", sa.String(length=255), nullable=False),
        sa.Column("item", sa.String(length=255), nullable=True),
        sa.Column("issue_category", sa.String(length=100), nullable=True),
        sa.Column("meal_type", sa.String(length=50), nullable=True),
        sa.Column("priority_score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=50), nullable=False),
        sa.Column("is_safety_override", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("issue_summary", sa.Text(), nullable=False),
        sa.Column("evidence_and_priority_reason", sa.Text(), nullable=False),
        sa.Column("corrective_action", sa.Text(), nullable=False),
        sa.Column("preventive_action", sa.Text(), nullable=False),
        sa.Column("responsible_role", sa.String(length=100), nullable=False),
        sa.Column("assignee_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assignee_name", sa.String(length=255), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("required_approval", sa.String(length=150), nullable=False, server_default="None / Immediate Execution"),
        sa.Column("approval_status", sa.String(length=50), nullable=False, server_default="proposed"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="proposed"),
        sa.Column("estimated_effort", sa.String(length=50), nullable=False, server_default="Medium"),
        sa.Column("verification_criteria", sa.Text(), nullable=False, server_default=""),
        sa.Column("expected_outcome", sa.Text(), nullable=False, server_default=""),
        sa.Column("completion_notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_status", sa.String(length=50), nullable=False, server_default="Pending"),
        sa.Column("verification_results", sa.JSON(), nullable=True),
        sa.Column("dedup_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_action_tasks_id", "action_tasks", ["id"])
    op.create_index("ix_task_org_priority", "action_tasks", ["organization_id", "priority_score"])
    op.create_index("ix_task_org_status", "action_tasks", ["organization_id", "status"])
    op.create_index("ix_task_org_dedup", "action_tasks", ["organization_id", "dedup_fingerprint"])
    op.create_index("ix_task_org_role", "action_tasks", ["organization_id", "responsible_role"])

    # 2. notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_role", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(length=100), nullable=False),
        sa.Column("task_id", sa.UUID(as_uuid=True), sa.ForeignKey("action_tasks.id", ondelete="CASCADE"), nullable=True),
        sa.Column("channel", sa.String(length=50), nullable=False, server_default="in_app"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("delivery_status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delivery_details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_id", "notifications", ["id"])
    op.create_index("ix_notif_org_user", "notifications", ["organization_id", "user_id"])
    op.create_index("ix_notif_org_read", "notifications", ["organization_id", "is_read"])
    op.create_index("ix_notif_org_type", "notifications", ["organization_id", "notification_type"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("action_tasks")
