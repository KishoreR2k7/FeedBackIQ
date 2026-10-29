import logging
import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy import select, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recurrence import RecurrenceAssessment
from app.schemas.intelligence import (
    TopicTrendSummary,
    TrendFilterParams,
    PrioritizedIssueItem,
    RecurrenceAssessmentOutput,
    PriorityConfigSchema,
)
from app.services.trend_service import TrendService
from app.services.priority_engine import PriorityEngine
from app.agents.recurrence_agent import RecurrenceReasoningAgent
from app.workflows.recurrence_workflow import run_recurrence_workflow

logger = logging.getLogger("feedbackiq.services.intelligence_service")

# In-memory tenant/global priority config store (can be extended to DB)
_CURRENT_PRIORITY_CONFIG = PriorityEngine.get_default_config()


class IntelligenceService:
    """
    Coordinates Topic Trends, Recurrence Reasoning Agent (LangGraph), and Priority Engine
    to generate prioritized operational issue lists with full transparency.
    """

    @classmethod
    def get_priority_config(cls) -> PriorityConfigSchema:
        return _CURRENT_PRIORITY_CONFIG

    @classmethod
    def update_priority_config(cls, new_config: PriorityConfigSchema) -> PriorityConfigSchema:
        global _CURRENT_PRIORITY_CONFIG
        _CURRENT_PRIORITY_CONFIG = new_config
        logger.info(f"Updated priority config: {new_config}")
        return _CURRENT_PRIORITY_CONFIG

    @classmethod
    async def get_topic_trends(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        filters: Optional[TrendFilterParams] = None,
        recent_days: int = 7,
    ) -> List[TopicTrendSummary]:
        return await TrendService.get_clustered_trends(
            db=db,
            organization_id=organization_id,
            filters=filters,
            recent_days=recent_days,
        )

    @classmethod
    async def get_feedback_for_topic(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        cluster_key: str,
    ) -> List[Any]:
        return await TrendService.get_feedback_for_topic(
            db=db,
            organization_id=organization_id,
            cluster_key=cluster_key,
        )

    @classmethod
    async def assess_and_prioritize_all(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        target_cluster_key: Optional[str] = None,
        config: Optional[PriorityConfigSchema] = None,
        recent_days: int = 7,
    ) -> List[PrioritizedIssueItem]:
        """
        Executes the LangGraph Recurrence Reasoning Workflow.
        Calculates historical facts, invokes LLM reasoning, enforces Rule 9 safety overrides,
        calculates priority scores, and persists assessments with full execution tracing.
        """
        cfg = config or cls.get_priority_config()
        return await run_recurrence_workflow(
            db=db,
            organization_id=organization_id,
            target_cluster_key=target_cluster_key,
            config=cfg,
            recent_days=recent_days,
        )

    @classmethod
    async def get_persisted_assessments(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        category: Optional[str] = None,
        meal_type: Optional[str] = None,
        risk_level: Optional[str] = None,
        item: Optional[str] = None,
    ) -> List[PrioritizedIssueItem]:
        """
        Retrieves persisted prioritized assessments from the database.
        If empty, triggers an assessment run automatically.
        """
        query = (
            select(RecurrenceAssessment)
            .where(RecurrenceAssessment.organization_id == organization_id)
            .order_by(desc(RecurrenceAssessment.is_safety_override), desc(RecurrenceAssessment.priority_score))
        )

        if category:
            query = query.where(RecurrenceAssessment.issue_category == category)
        if meal_type:
            query = query.where(RecurrenceAssessment.meal_type == meal_type)
        if risk_level:
            query = query.where(RecurrenceAssessment.risk_level == risk_level)
        if item:
            query = query.where(RecurrenceAssessment.item.ilike(f"%{item}%"))

        res = await db.execute(query)
        records = res.scalars().all()

        if not records:
            # Auto-assess if not yet populated
            return await cls.assess_and_prioritize_all(db=db, organization_id=organization_id)

        items: List[PrioritizedIssueItem] = []
        for r in records:
            items.append(
                PrioritizedIssueItem(
                    id=r.id,
                    issue_cluster_key=r.issue_cluster_key,
                    item=r.item,
                    issue_category=r.issue_category,
                    meal_type=r.meal_type,
                    priority_score=r.priority_score,
                    severity_score_normalized=r.severity_score_normalized,
                    recurrence_risk_normalized=r.recurrence_risk_normalized,
                    recent_frequency_normalized=r.recent_frequency_normalized,
                    is_safety_override=r.is_safety_override,
                    risk_level=r.risk_level,
                    topic_label=f"{r.item or 'General'} — {(r.issue_category or '').title()}",
                    issue_summary=f"Assessment for {r.item} ({r.issue_category})",
                    supporting_evidence=r.supporting_evidence or [],
                    observed_patterns=r.time_patterns or [],
                    hypotheses_causes=r.hypotheses_causes or [],
                    recommended_actions=r.recommended_actions or [],
                    confidence_explanation=r.confidence_explanation or "",
                    total_complaints_count=r.total_complaints_count,
                    recent_complaints_count=r.recent_complaints_count,
                    historical_complaints_count=r.historical_complaints_count,
                    velocity_change_percent=r.velocity_change_percent,
                    time_patterns=r.time_patterns or [],
                    created_at=r.created_at,
                )
            )

        return items
