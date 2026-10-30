import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_active_org
from app.models.organization import Organization
from app.schemas.intelligence import PrioritizedIssueItem
from app.schemas.analytics import RecurrencePredictionItem
from app.services.intelligence_service import IntelligenceService
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/issues", tags=["Issues & Recurrence Intelligence"])


async def resolve_org(
    x_org_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    org_dep: Optional[Organization] = Depends(get_current_active_org),
    db: AsyncSession = Depends(get_db),
) -> Organization:
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
            detail="No organization exists. Please onboard a tenant first.",
        )
    return org


@router.get("", response_model=List[PrioritizedIssueItem], summary="List Prioritized Issues")
async def list_issues(
    category: Optional[str] = None,
    meal_type: Optional[str] = None,
    risk_level: Optional[str] = None,
    item: Optional[str] = None,
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
) -> List[PrioritizedIssueItem]:
    """Returns prioritized issues sorted by deterministic priority score and safety override."""
    return await IntelligenceService.get_persisted_assessments(
        db=db,
        organization_id=org.id,
        category=category,
        meal_type=meal_type,
        risk_level=risk_level,
        item=item,
    )


@router.get("/predictions", response_model=List[RecurrencePredictionItem], summary="Get Recurrence Predictions")
async def get_predictions(
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
) -> List[RecurrencePredictionItem]:
    """Returns evidence-grounded recurrence risk predictions as specified in PS 2.5 Section 7."""
    return await AnalyticsService.get_predictions(db=db, organization_id=org.id)


@router.get("/{issue_id}", response_model=PrioritizedIssueItem, summary="Get Issue Assessment Details")
async def get_issue(
    issue_id: uuid.UUID,
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
) -> PrioritizedIssueItem:
    """Retrieves full details of a specific prioritized issue assessment."""
    assessments = await IntelligenceService.get_persisted_assessments(db=db, organization_id=org.id)
    for a in assessments:
        if a.id == issue_id:
            return a
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue assessment not found")
