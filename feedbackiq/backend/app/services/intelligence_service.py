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

logger = logging.getLogger("feedbackiq.services.intelligence_service")

# In-memory tenant/global priority config store (can be extended to DB)
_CURRENT_PRIORITY_CONFIG = PriorityEngine.get_default_config()


class IntelligenceService:
    """
    Coordinates Topic Trends, Recurrence Reasoning Agent, and Priority Engine
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
        Runs topic clustering, invokes the Recurrence Reasoning Agent for each cluster,
        computes deterministic priority scores, and persists assessments.
        """
        cfg = config or cls.get_priority_config()

        # Step 1: Calculate factual trends from SQL/Python
        trends = await TrendService.get_clustered_trends(
            db=db,
            organization_id=organization_id,
            recent_days=recent_days,
        )

        if target_cluster_key:
            trends = [t for t in trends if t.issue_cluster_key == target_cluster_key]

        prioritized_items: List[PrioritizedIssueItem] = []

        for trend in trends:
            # Step 2: Recurrence Reasoning Agent generates grounded assessment
            agent_assessment: RecurrenceAssessmentOutput = (
                await RecurrenceReasoningAgent.assess_trend_cluster(trend)
            )

            # Step 3: Deterministic Priority Engine computes normalized priority score
            (
                p_score,
                norm_sev,
                norm_rec,
                norm_freq,
                is_override,
            ) = PriorityEngine.calculate_priority(
                avg_severity=trend.average_severity,
                max_severity=trend.max_severity,
                risk_level=agent_assessment.risk_level,
                recent_complaints=trend.recent_complaints_count,
                has_food_safety_hazard=trend.has_food_safety_hazard,
                config=cfg,
            )

            # Step 4: Persist or update RecurrenceAssessment in DB
            stmt = select(RecurrenceAssessment).where(
                RecurrenceAssessment.organization_id == organization_id,
                RecurrenceAssessment.issue_cluster_key == trend.issue_cluster_key,
            )
            res = await db.execute(stmt)
            existing_record = res.scalars().first()

            if existing_record:
                rec_entity = existing_record
            else:
                rec_entity = RecurrenceAssessment(
                    organization_id=organization_id,
                    issue_cluster_key=trend.issue_cluster_key,
                )
                db.add(rec_entity)

            rec_entity.item = trend.item
            rec_entity.issue_category = trend.issue_category
            rec_entity.meal_type = trend.meal_type
            rec_entity.risk_level = agent_assessment.risk_level
            rec_entity.priority_score = p_score
            rec_entity.severity_score_normalized = norm_sev
            rec_entity.recurrence_risk_normalized = norm_rec
            rec_entity.recent_frequency_normalized = norm_freq
            rec_entity.is_safety_override = is_override
            rec_entity.total_complaints_count = trend.complaint_count
            rec_entity.recent_complaints_count = trend.recent_complaints_count
            rec_entity.historical_complaints_count = trend.historical_complaints_count
            rec_entity.velocity_change_percent = trend.velocity_change_percent
            rec_entity.time_patterns = agent_assessment.observed_patterns or trend.time_patterns
            rec_entity.supporting_evidence = agent_assessment.supporting_evidence or trend.evidence_quotes
            rec_entity.hypotheses_causes = agent_assessment.hypotheses_causes
            rec_entity.recommended_actions = agent_assessment.recommended_actions
            rec_entity.confidence_explanation = agent_assessment.confidence_explanation

            await db.flush()

            prioritized_items.append(
                PrioritizedIssueItem(
                    id=rec_entity.id,
                    issue_cluster_key=trend.issue_cluster_key,
                    item=trend.item,
                    issue_category=trend.issue_category,
                    meal_type=trend.meal_type,
                    priority_score=p_score,
                    severity_score_normalized=norm_sev,
                    recurrence_risk_normalized=norm_rec,
                    recent_frequency_normalized=norm_freq,
                    is_safety_override=is_override,
                    risk_level=agent_assessment.risk_level,
                    topic_label=trend.topic_label,
                    issue_summary=agent_assessment.issue_summary,
                    supporting_evidence=agent_assessment.supporting_evidence or trend.evidence_quotes,
                    observed_patterns=agent_assessment.observed_patterns or trend.time_patterns,
                    hypotheses_causes=agent_assessment.hypotheses_causes,
                    recommended_actions=agent_assessment.recommended_actions,
                    confidence_explanation=agent_assessment.confidence_explanation,
                    total_complaints_count=trend.complaint_count,
                    recent_complaints_count=trend.recent_complaints_count,
                    historical_complaints_count=trend.historical_complaints_count,
                    velocity_change_percent=trend.velocity_change_percent,
                    time_patterns=trend.time_patterns,
                    created_at=rec_entity.created_at,
                )
            )

        await db.commit()

        # Sort by priority score descending
        prioritized_items.sort(key=lambda x: (x.is_safety_override, x.priority_score), reverse=True)
        return prioritized_items

    @classmethod
    async def get_persisted_assessments(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        category: Optional[str] = None,
        meal_type: Optional[str] = None,
        risk_level: Optional[str] = None,
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
