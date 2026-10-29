import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user_optional, get_current_active_org
from app.models.organization import Organization
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["In-App Notifications & Alerts"])


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


@router.get("", response_model=List[NotificationResponse], summary="List In-App Notifications")
async def list_notifications(
    is_read: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=100),
    user: Optional[User] = Depends(get_current_user_optional),
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns notifications for the active tenant, filtered by read status or target user.
    """
    user_id = user.id if user else None
    return await NotificationService.get_notifications(
        db=db,
        organization_id=org.id,
        user_id=user_id,
        is_read=is_read,
        limit=limit,
    )


@router.post("/{notification_id}/read", response_model=dict, summary="Mark Notification as Read")
async def mark_as_read(
    notification_id: uuid.UUID,
    org: Organization = Depends(resolve_org),
    db: AsyncSession = Depends(get_db),
):
    """Marks a notification as acknowledged/read."""
    success = await NotificationService.mark_as_read(
        db=db,
        notification_id=notification_id,
        organization_id=org.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"status": "success", "message": "Notification marked as read"}
