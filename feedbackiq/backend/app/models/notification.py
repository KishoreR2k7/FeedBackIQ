import enum
import uuid
from typing import Any, Dict, Optional
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin, GUID


class NotificationType(str, enum.Enum):
    TASK_ASSIGNED = "task_assigned"
    APPROVAL_REQUIRED = "approval_required"
    DEADLINE_APPROACHING = "deadline_approaching"
    DEADLINE_MISSED = "deadline_missed"
    CRITICAL_SAFETY_ALERT = "critical_safety_alert"
    INVESTIGATION_REQUIRED = "investigation_required"


class NotificationChannel(str, enum.Enum):
    IN_APP = "in_app"
    EMAIL = "email"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    SIMULATED = "simulated"


class Notification(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Notification entity for in-app and email alerts across task lifecycles and critical safety overrides.
    Maintains delivery status and audit retry handling.
    """
    __tablename__ = "notifications"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("action_tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    channel: Mapped[str] = mapped_column(String(50), default=NotificationChannel.IN_APP.value, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    delivery_status: Mapped[str] = mapped_column(
        String(50),
        default=DeliveryStatus.PENDING.value,
        nullable=False,
        index=True,
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivery_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    task: Mapped[Optional["ActionTask"]] = relationship("ActionTask", back_populates="notifications")
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("ix_notif_org_user", "organization_id", "user_id"),
        Index("ix_notif_org_read", "organization_id", "is_read"),
        Index("ix_notif_org_type", "organization_id", "notification_type"),
    )
