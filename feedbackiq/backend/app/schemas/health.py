from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Liveness probe response."""
    status: str = Field(default="healthy", description="Application liveness status")
    app: str = Field(default="FeedbackIQ", description="Application name")
    version: str = Field(default="0.1.0", description="Application version")
    environment: str = Field(default="development", description="Current deployment environment")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="UTC timestamp")


class DatabaseReadiness(BaseModel):
    """Database probe component status."""
    status: str
    connected: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class ReadinessResponse(BaseModel):
    """Readiness probe response checking downstream services."""
    status: str = Field(..., description="Overall readiness: 'ready' or 'not_ready'")
    app: str = Field(default="FeedbackIQ")
    version: str = Field(default="0.1.0")
    environment: str = Field(default="development")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    checks: Dict[str, Any] = Field(..., description="Detailed component checks")
