"""Pydantic schemas for public and internal feedback data transfer."""

from typing import Optional, Dict, Any, Literal, List
from datetime import datetime
from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    """Payload for submitting feedback publicly via QR code or web link."""
    rating: int = Field(..., ge=1, le=5, description="Customer satisfaction rating between 1 and 5")
    raw_text: str = Field(..., min_length=3, max_length=4000, description="Customer feedback comments")
    customer_name: Optional[str] = Field(None, max_length=100)
    customer_contact: Optional[str] = Field(None, max_length=100)
    channel: Literal["qr_code", "web_link", "kiosk"] = "web_link"
    location_table: Optional[str] = Field(None, max_length=100)
    meal_type: Optional[Literal["breakfast", "lunch", "snacks", "dinner"]] = None


class FeedbackPublicResponse(BaseModel):
    """Public customer response after feedback submission."""
    id: int
    status: str
    message: str
    sentiment: Optional[str] = None
    urgency: Optional[str] = None


class FeedbackDetailResponse(BaseModel):
    """Full internal feedback record for organization staff."""
    id: int
    org_id: int
    rating: int
    raw_text: str
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    channel: str
    location_table: Optional[str] = None
    meal_type: Optional[str] = None
    category: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    urgency: Optional[str] = None
    status: str
    ai_analysis: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

