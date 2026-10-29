import uuid
from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.models.organization import Organization

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract authenticated user if JWT token is present and valid."""
    if not auth or not auth.credentials:
        return None
    try:
        payload = decode_access_token(auth.credentials)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = uuid.UUID(user_id_str)
        stmt = select(User).where(User.id == user_id, User.is_active.is_(True))
        result = await db.execute(stmt)
        return result.scalars().first()
    except Exception:
        return None


async def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    """Enforces authentication."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or are invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


async def get_current_active_org(
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[Organization]:
    """
    Resolves the active tenant/organization context.
    Prioritizes authenticated user's organization, with fallback to X-Organization-Id header
    for public submission forms or authorized multi-tenant switchers.
    """
    org_id: Optional[uuid.UUID] = None
    if current_user and current_user.organization_id:
        org_id = current_user.organization_id
    elif x_organization_id:
        try:
            org_id = uuid.UUID(x_organization_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization ID format in X-Organization-Id header",
            )

    if not org_id:
        return None

    stmt = select(Organization).where(Organization.id == org_id, Organization.is_active.is_(True))
    result = await db.execute(stmt)
    org = result.scalars().first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )
    return org
