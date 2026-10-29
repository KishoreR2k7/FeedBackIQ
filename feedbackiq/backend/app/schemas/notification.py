import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

NotificationTypeLiteral = Literal[
    "task_assigned",
    "approval_required",
    "deadline_approaching",
    "deadline_missed",
    "critical_safety_alert",
    "investigation_required",
]
DeliveryStatusLiteral = Literal["pending", "delivered", "failed", "simulated"]


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    target_role: Optional[str] = None
    title: str
    message: str
    notification_type: NotificationTypeLiteral
    task_id: Optional[uuid.UUID] = None
    channel: str
    is_read: bool
    delivery_status: DeliveryStatusLiteral
    retry_count: int
    delivery_details: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class NotificationFilterParams(BaseModel):
    is_read: Optional[bool] = None
    notification_type: Optional[str] = None
    target_role: Optional[str] = None
