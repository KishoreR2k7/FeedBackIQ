import uuid
from typing import Any, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy import String, JSON, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TenantScopedMixin, GUID


class AuditEvent(Base, UUIDPrimaryKeyMixin, TenantScopedMixin):
    """
    Immutable audit log recording compliance, data uploads, and safety escalations.
    """
    __tablename__ = "audit_events"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    event_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_audit_org_type", "organization_id", "event_type"),
    )
