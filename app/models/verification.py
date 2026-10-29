"""Verification model to audit task resolutions and prevent recurrence."""

from typing import Optional
from sqlalchemy import BigInteger, String, Float, Boolean, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class Verification(Base, IdMixin, OrgMixin, TimestampMixin):
    """Quality verification auditing whether an issue has truly been resolved."""
    __tablename__ = "verifications"

    task_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    verified_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    status: Mapped[str] = mapped_column(String(50), default="pending_audit", nullable=False)
    
    # Numerical scores computed in code (Rule 3)
    before_sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    after_sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    audit_notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    recurrence_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_audit', 'passed', 'failed', 'reopened')",
            name="check_verification_status_valid"
        ),
        Index("ix_verifications_org_id_created_at", "org_id", "created_at"),
        Index("ix_verifications_org_status", "org_id", "status"),
    )

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="verifications")
    verified_by: Mapped[Optional["User"]] = relationship("User")
