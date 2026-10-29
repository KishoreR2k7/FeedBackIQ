import enum
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Index,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin, GUID


class TaskApprovalStatus(str, enum.Enum):
    PROPOSED = "proposed"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class TaskStatus(str, enum.Enum):
    PROPOSED = "proposed"
    AWAITING_APPROVAL = "awaiting_approval"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    REJECTED = "rejected"


class VerificationOutcome(str, enum.Enum):
    IMPROVED = "Improved"
    NO_CLEAR_IMPROVEMENT = "No Clear Improvement"
    WORSENED = "Worsened"
    INSUFFICIENT_EVIDENCE = "Insufficient Evidence"
    PENDING = "Pending"


class ActionTask(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Action task entity representing prioritized corrective and preventive actions.
    Supports a full lifecycle: Proposed -> Awaiting Approval -> Assigned -> In Progress -> Completed -> Verified.
    """
    __tablename__ = "action_tasks"

    # Reference to the issue cluster (e.g. 'Dal Tadka|temperature|Lunch')
    issue_cluster_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    item: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    issue_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    meal_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    # Scored priority and recurrence risk
    priority_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    risk_level: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    is_safety_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Issue context and evidence
    issue_summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_and_priority_reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Structured recommendations
    corrective_action: Mapped[str] = mapped_column(Text, nullable=False)
    preventive_action: Mapped[str] = mapped_column(Text, nullable=False)
    responsible_role: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Task Assignment & Deadlines
    assignee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assignee_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    # Approvals & Lifecycle
    required_approval: Mapped[str] = mapped_column(String(150), default="None / Immediate Execution", nullable=False)
    approval_status: Mapped[str] = mapped_column(
        String(50),
        default=TaskApprovalStatus.PROPOSED.value,
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=TaskStatus.PROPOSED.value,
        nullable=False,
        index=True,
    )

    # Effort & Operational verification
    estimated_effort: Mapped[str] = mapped_column(String(50), default="Medium", nullable=False)
    verification_criteria: Mapped[str] = mapped_column(Text, default="", nullable=False)
    expected_outcome: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Completion & Verification results
    completion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(50),
        default=VerificationOutcome.PENDING.value,
        nullable=False,
        index=True,
    )
    verification_results: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Idempotency fingerprint to prevent duplicate tasks on workflow retry
    dedup_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Relationships
    assignee: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assignee_id])
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_task_org_priority", "organization_id", "priority_score"),
        Index("ix_task_org_status", "organization_id", "status"),
        Index("ix_task_org_dedup", "organization_id", "dedup_fingerprint"),
        Index("ix_task_org_role", "organization_id", "responsible_role"),
    )
