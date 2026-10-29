import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import String, Integer, Float, Boolean, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin


class RecurrenceAssessment(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Persistent recurrence-risk assessment and deterministic priority scores for issue clusters.
    Distinguishes observed facts from hypotheses and recommendations.
    """
    __tablename__ = "recurrence_assessments"

    # Cluster key (e.g., 'item:Dal Tadka|category:Taste & Flavor|meal:Lunch')
    issue_cluster_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    item: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    issue_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    meal_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    # Risk level: 'Critical', 'High', 'Medium', 'Low', 'Insufficient Evidence'
    risk_level: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Deterministic Priority Score (0.0 to 100.0)
    priority_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    severity_score_normalized: Mapped[float] = mapped_column(Float, nullable=False)
    recurrence_risk_normalized: Mapped[float] = mapped_column(Float, nullable=False)
    recent_frequency_normalized: Mapped[float] = mapped_column(Float, nullable=False)

    # Safety override indicator (Rule 9)
    is_safety_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Calculated factual metrics
    total_complaints_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recent_complaints_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    historical_complaints_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    velocity_change_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Observed facts & patterns
    time_patterns: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    supporting_evidence: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # Hypotheses & Prescriptive Next Steps
    hypotheses_causes: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    recommended_actions: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    confidence_explanation: Mapped[str] = mapped_column(String(500), default="", nullable=False)

    __table_args__ = (
        Index("ix_rec_org_priority", "organization_id", "priority_score"),
        Index("ix_rec_org_risk", "organization_id", "risk_level"),
        Index("ix_rec_org_cluster", "organization_id", "issue_cluster_key"),
    )
