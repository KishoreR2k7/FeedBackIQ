import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_active_org
from app.models.organization import Organization
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    AnalyticsReportResponse,
    SentimentByMealItem,
    SentimentTrendItem,
    ExtractedTopicItem,
    RecurrencePredictionItem,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Feedback Analytics & Decision Intelligence"])


async def resolve_org_or_first(
    x_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    org_dep: Optional[Organization] = Depends(get_current_active_org),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Helper ensuring a valid active tenant context exists."""
    if org_dep:
        return org_dep
    if x_org_id:
        try:
            target_id = uuid.UUID(x_org_id)
            stmt = select(Organization).where(Organization.id == target_id)
            res = await db.execute(stmt)
            org = res.scalars().first()
            if org:
                return org
        except Exception:
            pass
    stmt = select(Organization).where(Organization.is_active.is_(True)).limit(1)
    res = await db.execute(stmt)
    org = res.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization exists. Please onboard a tenant first via /api/v1/organizations",
        )
    return org


@router.get("/overview", response_model=AnalyticsOverviewResponse, summary="Executive Overview Analytics")
async def get_analytics_overview(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    meal_type: Optional[str] = None,
    item: Optional[str] = None,
    issue_category: Optional[str] = None,
    sentiment: Optional[str] = None,
    channel: Optional[str] = None,
    source_dataset: Optional[str] = None,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsOverviewResponse:
    """
    Computes real-time executive KPI metrics:
    total feedback, positive/negative/neutral counts, satisfaction %, average rating,
    active recurring issues, critical food safety alerts, and pending action tasks.
    """
    return await AnalyticsService.get_overview(
        db=db,
        organization_id=org.id,
        date_from=date_from,
        date_to=date_to,
        meal_type=meal_type,
        item=item,
        issue_category=issue_category,
        sentiment=sentiment,
        channel=channel,
        source_dataset=source_dataset,
    )


@router.get("/report", response_model=AnalyticsReportResponse, summary="Full Multi-Dimensional Analytics Report")
async def get_analytics_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    meal_type: Optional[str] = None,
    item: Optional[str] = None,
    issue_category: Optional[str] = None,
    sentiment: Optional[str] = None,
    channel: Optional[str] = None,
    source_dataset: Optional[str] = None,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsReportResponse:
    """
    Full analytics report providing:
    - Overview KPIs
    - Sentiment distribution by meal type
    - Sentiment trends over time
    - Most frequently reported food items
    - Top complaints
    - Category distribution across standard 8 quality dimensions
    - Common topics with supporting evidence
    """
    return await AnalyticsService.get_report(
        db=db,
        organization_id=org.id,
        date_from=date_from,
        date_to=date_to,
        meal_type=meal_type,
        item=item,
        issue_category=issue_category,
        sentiment=sentiment,
        channel=channel,
        source_dataset=source_dataset,
    )


@router.get("/sentiment", summary="Sentiment Breakdown and Trends")
async def get_sentiment_analytics(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    meal_type: Optional[str] = None,
    item: Optional[str] = None,
    channel: Optional[str] = None,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
):
    """Returns meal-wise sentiment distribution and daily sentiment timeline trends."""
    report = await AnalyticsService.get_report(
        db=db,
        organization_id=org.id,
        date_from=date_from,
        date_to=date_to,
        meal_type=meal_type,
        item=item,
        channel=channel,
    )
    return {
        "overview": report.overview,
        "sentiment_by_meal": report.sentiment_by_meal,
        "sentiment_trend": report.sentiment_trend,
    }


@router.get("/topics", response_model=List[ExtractedTopicItem], summary="Common Extracted Topics")
async def get_topic_analytics(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    meal_type: Optional[str] = None,
    category: Optional[str] = None,
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[ExtractedTopicItem]:
    """Returns topics extracted from actual stored feedback with quotes and counts."""
    report = await AnalyticsService.get_report(
        db=db,
        organization_id=org.id,
        date_from=date_from,
        date_to=date_to,
        meal_type=meal_type,
        issue_category=category,
    )
    return report.common_topics


@router.get("/predictions", response_model=List[RecurrencePredictionItem], summary="Recurrence Risk Predictions")
async def get_predictions(
    org: Organization = Depends(resolve_org_or_first),
    db: AsyncSession = Depends(get_db),
) -> List[RecurrencePredictionItem]:
    """
    Returns structured recurrence risk predictions as specified in PS 2.5 Section 7.
    Grounds recurrence risk scores in historical complaint counts, recent frequency,
    and velocity trends.
    """
    return await AnalyticsService.get_predictions(
        db=db,
        organization_id=org.id,
    )
