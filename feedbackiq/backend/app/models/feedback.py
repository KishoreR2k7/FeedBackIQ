import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin, GUID


class Feedback(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Core feedback entity storing student, customer, and patron reviews.
    Supports both canteen forms/complaints and external sources (e.g. Zomato).
    """
    __tablename__ = "feedback"

    # External/Client feedback identifier (e.g. FB-1001)
    feedback_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Optional location scoping (e.g., Main Dining Hall, South Campus Mess)
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Core submission attributes
    date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    meal_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    item: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    channel: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    issue_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    source_dataset: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # SHA-256 fingerprint for deterministic duplicate detection and idempotency
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Relationships
    location: Mapped[Optional["Location"]] = relationship(
        "Location",
        back_populates="feedbacks",
    )
    analysis: Mapped[Optional["FeedbackAnalysis"]] = relationship(
        "FeedbackAnalysis",
        back_populates="feedback",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_feedback_org_date", "organization_id", "date"),
        Index("ix_feedback_org_item", "organization_id", "item"),
        Index("ix_feedback_org_hash", "organization_id", "content_hash"),
    )
