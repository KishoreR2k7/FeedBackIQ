import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import FeedbackAnalysisResponse


class FeedbackBase(BaseModel):
    feedback_id: Optional[str] = Field(None, max_length=100)
    location_id: Optional[uuid.UUID] = None
    date: Optional[datetime] = None
    meal_type: Optional[str] = Field(None, max_length=50)
    item: Optional[str] = Field(None, max_length=255)
    rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    channel: Optional[str] = Field(None, max_length=50)
    issue_category: Optional[str] = Field(None, max_length=100)
    source_dataset: Optional[str] = Field("manual_entry", max_length=100)


class FeedbackCreate(FeedbackBase):
    organization_id: Optional[uuid.UUID] = None


class FeedbackResponse(FeedbackBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    content_hash: str
    created_at: datetime
    updated_at: datetime
    analysis: Optional[FeedbackAnalysisResponse] = None


class PaginatedFeedbackResponse(BaseModel):
    items: List[FeedbackResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SyntheticGenerationRequest(BaseModel):
    count: int = Field(default=50, ge=5, le=500, description="Number of synthetic records to generate")
    seed_recurring_issues: bool = Field(default=True, description="Seed systemic recurring failure patterns")
    meal_types: Optional[List[str]] = None
    items: Optional[List[str]] = None


class SyntheticGenerationResponse(BaseModel):
    generated_count: int
    seeded_scenarios: List[str]
    sample_records: List[FeedbackResponse]


class ImportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    source_name: str
    filename: str
    total_records: int
    processed_records: int
    successful_records: int
    failed_records: int
    duplicate_records: int
    errors: List[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: datetime


class CSVUploadResponse(BaseModel):
    import_job: ImportJobResponse
    message: str


class DatasetStatsResponse(BaseModel):
    total_feedback: int
    student_canteen_count: int
    synthetic_count: int
    zomato_count: int
    other_count: int
    dataset_breakdown: Dict[str, int]

