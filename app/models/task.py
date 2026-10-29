"""Task model for operational corrective actions and SLA tracking."""

from typing import Optional, List
from datetime import datetime
from sqlalchemy import BigInteger, String, Boolean, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class Task(Base, IdMixin, OrgMixin, TimestampMixin):
    """Operational action task assigned to department in-charge or staff."""
    __tablename__ = "tasks"

    feedback_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("feedbacks.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    department_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    assigned_to_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), default="P3", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    
    # SLA due date computed in code (Rule 3)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    sla_breached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint("priority IN ('P1', 'P2', 'P3', 'P4')", name="check_task_priority_valid"),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'resolved', 'verified')",
            name="check_task_status_valid"
        ),
        Index("ix_tasks_org_id_created_at", "org_id", "created_at"),
        Index("ix_tasks_org_status", "org_id", "status"),
        Index("ix_tasks_org_priority", "org_id", "priority"),
    )

    # Relationships
    feedback: Mapped[Optional["Feedback"]] = relationship("Feedback", back_populates="tasks")
    department: Mapped["Department"] = relationship("Department", back_populates="tasks")
    assigned_to: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_to_user_id])
    verifications: Mapped[List["Verification"]] = relationship("Verification", back_populates="task")
