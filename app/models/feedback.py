"""Feedback model storing ingested raw feedback and AI classification results."""

from typing import Optional, Dict, Any, List
from sqlalchemy import BigInteger, String, Integer, Float, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class Feedback(Base, IdMixin, OrgMixin, TimestampMixin):
    """Customer feedback collected via QR code, web link, or kiosk."""
    __tablename__ = "feedbacks"

    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[str] = mapped_column(String(4000), nullable=False)
    
    customer_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    customer_contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    channel: Mapped[str] = mapped_column(String(50), default="web_link", nullable=False)
    location_table: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    meal_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    sentiment: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    urgency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    
    status: Mapped[str] = mapped_column(String(50), default="new", nullable=False)
    ai_analysis: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, default=dict, nullable=True)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_feedback_rating_range"),
        CheckConstraint("channel IN ('qr_code', 'web_link', 'kiosk')", name="check_feedback_channel_valid"),
        CheckConstraint(
            "status IN ('new', 'triaged', 'actioned', 'resolved', 'ignored')",
            name="check_feedback_status_valid"
        ),
        CheckConstraint(
            "sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'critical')",
            name="check_feedback_sentiment_valid"
        ),
        CheckConstraint(
            "urgency IS NULL OR urgency IN ('P1', 'P2', 'P3', 'P4')",
            name="check_feedback_urgency_valid"
        ),
        Index("ix_feedbacks_org_id_created_at", "org_id", "created_at"),
        Index("ix_feedbacks_org_status", "org_id", "status"),
        Index("ix_feedbacks_org_department", "org_id", "department_id"),
    )

    # Relationships
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="feedback_items")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="feedback")
