"""003_recurrence_and_trends_schema

Revision ID: 003_recurrence
Revises: 002_feedback_and_analysis
Create Date: 2026-10-29 14:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_recurrence"
down_revision: Union[str, None] = "002_feedback_and_analysis"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recurrence_assessments",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("issue_cluster_key", sa.String(length=255), nullable=False),
        sa.Column("item", sa.String(length=255), nullable=True),
        sa.Column("issue_category", sa.String(length=100), nullable=True),
        sa.Column("meal_type", sa.String(length=50), nullable=True),
        sa.Column("risk_level", sa.String(length=50), nullable=False),
        sa.Column("priority_score", sa.Float(), nullable=False),
        sa.Column("severity_score_normalized", sa.Float(), nullable=False),
        sa.Column("recurrence_risk_normalized", sa.Float(), nullable=False),
        sa.Column("recent_frequency_normalized", sa.Float(), nullable=False),
        sa.Column("is_safety_override", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("total_complaints_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recent_complaints_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("historical_complaints_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("velocity_change_percent", sa.Float(), nullable=True),
        sa.Column("time_patterns", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("supporting_evidence", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("hypotheses_causes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("recommended_actions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("confidence_explanation", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_recurrence_assessments_id", "recurrence_assessments", ["id"])
    op.create_index("ix_rec_org_priority", "recurrence_assessments", ["organization_id", "priority_score"])
    op.create_index("ix_rec_org_risk", "recurrence_assessments", ["organization_id", "risk_level"])
    op.create_index("ix_rec_org_cluster", "recurrence_assessments", ["organization_id", "issue_cluster_key"])


def downgrade() -> None:
    op.drop_table("recurrence_assessments")
