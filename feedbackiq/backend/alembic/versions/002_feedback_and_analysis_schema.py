"""002_feedback_and_analysis_schema

Revision ID: 002_feedback_and_analysis
Revises: 001_initial
Create Date: 2026-10-29 13:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_feedback_and_analysis"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Locations Table
    op.create_table(
        "locations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("location_type", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_locations_organization_id", "locations", ["organization_id"])
    op.create_index("ix_locations_id", "locations", ["id"])

    # 2. Feedback Table
    op.create_table(
        "feedback",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("feedback_id", sa.String(length=100), nullable=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meal_type", sa.String(length=50), nullable=True),
        sa.Column("item", sa.String(length=255), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("channel", sa.String(length=50), nullable=True),
        sa.Column("issue_category", sa.String(length=100), nullable=True),
        sa.Column("source_dataset", sa.String(length=100), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feedback_id", "feedback", ["id"])
    op.create_index("ix_feedback_feedback_id", "feedback", ["feedback_id"])
    op.create_index("ix_feedback_organization_id", "feedback", ["organization_id"])
    op.create_index("ix_feedback_location_id", "feedback", ["location_id"])
    op.create_index("ix_feedback_date", "feedback", ["date"])
    op.create_index("ix_feedback_meal_type", "feedback", ["meal_type"])
    op.create_index("ix_feedback_item", "feedback", ["item"])
    op.create_index("ix_feedback_channel", "feedback", ["channel"])
    op.create_index("ix_feedback_issue_category", "feedback", ["issue_category"])
    op.create_index("ix_feedback_source_dataset", "feedback", ["source_dataset"])
    op.create_index("ix_feedback_content_hash", "feedback", ["content_hash"])
    op.create_index("ix_feedback_org_date", "feedback", ["organization_id", "date"])
    op.create_index("ix_feedback_org_item", "feedback", ["organization_id", "item"])
    op.create_index("ix_feedback_org_hash", "feedback", ["organization_id", "content_hash"])

    # 3. Feedback Analyses Table
    op.create_table(
        "feedback_analyses",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("feedback_id", sa.UUID(as_uuid=True), sa.ForeignKey("feedback.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sentiment", sa.String(length=50), nullable=False),
        sa.Column("mentioned_food_items", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("service_aspects", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("issue_categories", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("severity_score", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("evidence_quotes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("food_safety_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("food_safety_reasons", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("language", sa.String(length=20), nullable=False, server_default="en"),
        sa.Column("uncertainty_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("model_name", sa.String(length=100), nullable=False, server_default="unknown"),
        sa.Column("raw_model_response", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feedback_analyses_id", "feedback_analyses", ["id"])
    op.create_index("ix_feedback_analyses_feedback_id", "feedback_analyses", ["feedback_id"])
    op.create_index("ix_feedback_analyses_organization_id", "feedback_analyses", ["organization_id"])
    op.create_index("ix_feedback_analyses_sentiment", "feedback_analyses", ["sentiment"])
    op.create_index("ix_feedback_analyses_severity_score", "feedback_analyses", ["severity_score"])
    op.create_index("ix_feedback_analyses_food_safety_flag", "feedback_analyses", ["food_safety_flag"])
    op.create_index("ix_analysis_org_safety", "feedback_analyses", ["organization_id", "food_safety_flag"])
    op.create_index("ix_analysis_org_severity", "feedback_analyses", ["organization_id", "severity_score"])

    # 4. Import Jobs Table
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_name", sa.String(length=100), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("total_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("successful_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicate_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "status",
            sa.Enum("PENDING", "PROCESSING", "COMPLETED", "FAILED", name="importjobstatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_import_jobs_id", "import_jobs", ["id"])
    op.create_index("ix_import_jobs_organization_id", "import_jobs", ["organization_id"])
    op.create_index("ix_import_jobs_status", "import_jobs", ["status"])

    # 5. Audit Events Table
    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("event_payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_events_id", "audit_events", ["id"])
    op.create_index("ix_audit_events_organization_id", "audit_events", ["organization_id"])
    op.create_index("ix_audit_events_user_id", "audit_events", ["user_id"])
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"])
    op.create_index("ix_audit_org_type", "audit_events", ["organization_id", "event_type"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("import_jobs")
    op.execute("DROP TYPE IF EXISTS importjobstatus;")
    op.drop_table("feedback_analyses")
    op.drop_table("feedback")
    op.drop_table("locations")
