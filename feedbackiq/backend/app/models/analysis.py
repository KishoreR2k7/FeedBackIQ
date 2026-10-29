import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import String, Integer, Float, Boolean, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin, GUID


class FeedbackAnalysis(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Structured analytical output produced by the Feedback Analysis Agent (LangChain/LLM)
    with deterministic safety validation.
    """
    __tablename__ = "feedback_analyses"

    feedback_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("feedback.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Core aspect & sentiment analytics
    sentiment: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # positive, neutral, negative, mixed, uncertain
    mentioned_food_items: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    service_aspects: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    issue_categories: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    severity_score: Mapped[int] = mapped_column(Integer, default=1, nullable=False, index=True)  # 1 to 5
    evidence_quotes: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Deterministic Food Safety Safeguards
    food_safety_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    food_safety_reasons: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Language & Confidence Diagnostics
    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)
    uncertainty_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0.0 to 1.0

    # Model Telemetry
    model_name: Mapped[str] = mapped_column(String(100), default="unknown", nullable=False)
    raw_model_response: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    feedback: Mapped["Feedback"] = relationship(
        "Feedback",
        back_populates="analysis",
    )

    __table_args__ = (
        Index("ix_analysis_org_safety", "organization_id", "food_safety_flag"),
        Index("ix_analysis_org_severity", "organization_id", "severity_score"),
    )
