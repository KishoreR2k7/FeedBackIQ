import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.organization import Organization, OrgTemplateType
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
)

router = APIRouter(prefix="/organizations", tags=["Organizations & Tenants"])

# Preset organization templates
ORGANIZATION_TEMPLATES = {
    OrgTemplateType.COLLEGE: {
        "description": "Higher Education Campus & Hostel Mess",
        "meal_slots": ["Breakfast", "Lunch", "Evening Snacks", "Dinner"],
        "default_categories": [
            "Taste & Flavor",
            "Hygiene & Cleanliness",
            "Temperature",
            "Portion & Quantity",
            "Freshness & Spoilage",
            "Service & Waiting Time",
        ],
        "default_channels": ["student_form", "complaint_box", "qr_scan"],
        "sla_resolution_hours": 24,
    },
    OrgTemplateType.RESTAURANT: {
        "description": "Commercial Restaurant & Dining Establishment",
        "meal_slots": ["Lunch Service", "Dinner Service", "Late Night"],
        "default_categories": [
            "Food Quality & Presentation",
            "Service & Hospitality",
            "Hygiene & Tableware",
            "Billing & Value",
            "Ambience & Music",
        ],
        "default_channels": ["table_qr", "manager_complaint", "online_review"],
        "sla_resolution_hours": 12,
    },
    OrgTemplateType.CORPORATE_CAFETERIA: {
        "description": "Enterprise Corporate Cafeteria & Food Court",
        "meal_slots": ["Breakfast Grab&Go", "Lunch Rush 1", "Lunch Rush 2", "Evening Refreshment"],
        "default_categories": [
            "Nutritional Balance & Healthy Options",
            "Food Freshness & Temperature",
            "Counter Speed & Wait Time",
            "Hygiene & Utensils",
            "Menu Variety",
        ],
        "default_channels": ["slack_bot", "feedback_kiosk", "web_portal"],
        "sla_resolution_hours": 8,
    },
    OrgTemplateType.CUSTOM: {
        "description": "Customizable Organization Template",
        "meal_slots": ["General Service"],
        "default_categories": ["Quality", "Service", "Hygiene"],
        "default_channels": ["web_form"],
        "sla_resolution_hours": 48,
    },
}


@router.get("/templates", summary="Get Available Organization Templates")
async def get_templates():
    """Return available organization templates and their default configuration."""
    return ORGANIZATION_TEMPLATES


@router.get("", response_model=List[OrganizationResponse], summary="List Organizations")
async def list_organizations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> List[Organization]:
    stmt = select(Organization).where(Organization.is_active.is_(True)).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Organization",
)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
) -> Organization:
    # Check slug uniqueness
    stmt = select(Organization).where(Organization.slug == payload.slug)
    result = await db.execute(stmt)
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Organization with slug '{payload.slug}' already exists",
        )

    # Merge template defaults if settings not fully customized
    template_config = ORGANIZATION_TEMPLATES.get(payload.template_type, {})
    merged_settings = {**template_config, **payload.settings}

    org = Organization(
        name=payload.name,
        slug=payload.slug,
        template_type=payload.template_type,
        settings=merged_settings,
        is_active=True,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@router.get(
    "/{org_id}",
    response_model=OrganizationResponse,
    summary="Get Organization by ID",
)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Organization:
    stmt = select(Organization).where(Organization.id == org_id)
    result = await db.execute(stmt)
    org = result.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org
