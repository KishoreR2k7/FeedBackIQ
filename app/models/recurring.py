"""RecurringIssue model for pattern clustering and predictive intelligence."""

from typing import Optional, List
from datetime import datetime
from sqlalchemy import BigInteger, String, Integer, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class RecurringIssue(Base, IdMixin, OrgMixin, TimestampMixin):
    """Clusters of recurring feedback issues predicted across time windows."""
    __tablename__ = "recurring_issues"

    department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    issue_fingerprint: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Counts computed deterministically in code/SQL (Rule 3)
    frequency_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    predicted_root_cause: Mapped[str] = mapped_column(String(2000), nullable=False)
    recommended_action: Mapped[str] = mapped_column(String(2000), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    
    evidence_feedback_ids: Mapped[List[int]] = mapped_column(JSONB, default=list, nullable=False)
    last_occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'mitigated', 'monitoring')",
            name="check_recurring_status_valid"
        ),
        Index("ix_recurring_issues_org_id_created_at", "org_id", "created_at"),
        Index("ix_recurring_issues_org_status", "org_id", "status"),
    )

    # Relationships
    department: Mapped[Optional["Department"]] = relationship("Department")
