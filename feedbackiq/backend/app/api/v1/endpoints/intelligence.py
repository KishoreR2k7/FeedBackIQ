import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_active_org
from app.models.organization import Organization
from app.schemas.intelligence import (
    TopicTrendSummary,
    TrendFilterParams,
    PrioritizedIssueItem,
    PriorityConfigSchema,
    RecurrenceAssessmentRequest,
)
from app.schemas.feedback import FeedbackResponse
from app.services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["Feedback Intelligence & Recurrence"])


async def resolve_org_or_first(
    x_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    org_dep: Optional[Organization] = Depends(get_current_active_org),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Helper ensuring a valid active tenant context exists."""
    if org_dep:
        return org_dep
    # Fallback to the first active organization if available
    stmt = select(Organization).where(Organization.is_active.is_(True)).limit(1)
    res = await db.execute(stmt)
    org = res.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization exists. Please onboard a tenant first via /api/v1/organizations",
        )
    return org


@router.get("/trends", response_model=List[TopicTrendSummary], summary="Topic & Trend Intelligence")
@router.get("/topics", response_model=List[TopicTrendSummary], summary="Topic & Trend Intelligence (Alias)")
async def get_topic_trends(
    location_id: Optional[uuid.UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    issue_category: Optional[str] = None,
    meal_type: Optional[str] = None,
    channel: Optional[str] = None,
    recent_days: int = Query(7, ge=1, le=90),
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[TopicTrendSummary]:
    """
    Groups tenant feedback into topic clusters by item, category, location, and meal type.
    Returns computed facts: complaint count, avg rating, negative proportion,
    recent vs historical velocity, time patterns, and grounded summaries.
    """
    filters = TrendFilterParams(
        location_id=location_id,
        date_from=date_from,
        date_to=date_to,
        issue_category=issue_category,
        meal_type=meal_type,
        channel=channel,
    )
    return await IntelligenceService.get_topic_trends(
        db=db,
        organization_id=org.id,
        filters=filters,
        recent_days=recent_days,
    )


@router.get("/topics/{cluster_key}/feedback", response_model=List[FeedbackResponse], summary="Retrieve Supporting Feedback for Topic")
async def get_topic_supporting_feedback(
    cluster_key: str,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[FeedbackResponse]:
    """Retrieve all feedback records supporting a given topic cluster."""
    feedbacks = await IntelligenceService.get_feedback_for_topic(
        db=db,
        organization_id=org.id,
        cluster_key=cluster_key,
    )
    return [FeedbackResponse.model_validate(f) for f in feedbacks]


@router.post("/assess-recurrence", response_model=List[PrioritizedIssueItem], summary="Assess Recurrence & Calculate Priority")
async def assess_recurrence(
    payload: RecurrenceAssessmentRequest,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[PrioritizedIssueItem]:
    """
    Invokes the Recurrence Reasoning Agent (LangChain) on active topic clusters.
    Computes deterministic priority scores and persists assessments.
    """
    return await IntelligenceService.assess_and_prioritize_all(
        db=db,
        organization_id=org.id,
        target_cluster_key=payload.issue_cluster_key,
        recent_days=payload.days_recent_window,
    )


@router.get("/prioritized-issues", response_model=List[PrioritizedIssueItem], summary="List Prioritized Issues")
async def list_prioritized_issues(
    category: Optional[str] = None,
    meal_type: Optional[str] = None,
    risk_level: Optional[str] = None,
    item: Optional[str] = None,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[PrioritizedIssueItem]:
    """
    Returns prioritized issues sorted by deterministic score and safety override.
    Includes full scoring breakdown, supporting evidence quotes, and operational recommendations.
    """
    return await IntelligenceService.get_persisted_assessments(
        db=db,
        organization_id=org.id,
        category=category,
        meal_type=meal_type,
        risk_level=risk_level,
        item=item,
    )


@router.get("/assessments", response_model=List[PrioritizedIssueItem], summary="Alias for Prioritized Issues")
async def get_assessments(
    category: Optional[str] = None,
    meal_type: Optional[str] = None,
    risk_level: Optional[str] = None,
    item: Optional[str] = None,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[PrioritizedIssueItem]:
    """Alias for /prioritized-issues providing recurrence assessments and supporting evidence."""
    return await IntelligenceService.get_persisted_assessments(
        db=db,
        organization_id=org.id,
        category=category,
        meal_type=meal_type,
        risk_level=risk_level,
        item=item,
    )


@router.get("/priority-config", response_model=PriorityConfigSchema, summary="Get Priority Scoring Configuration")
def get_priority_config() -> PriorityConfigSchema:
    """Returns the current configurable priority engine weights."""
    return IntelligenceService.get_priority_config()


@router.put("/priority-config", response_model=PriorityConfigSchema, summary="Update Priority Scoring Configuration")
def update_priority_config(config: PriorityConfigSchema) -> PriorityConfigSchema:
    """
    Updates priority weights (w_severity, w_recurrence_risk, w_recent_frequency, safety_override_floor).
    Weights must sum to ~1.0.
    """
    return IntelligenceService.update_priority_config(config)
