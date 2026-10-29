"""Structured Pydantic schemas for AI Agent pipeline responses (Rule 4)."""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class ClassificationOutput(BaseModel):
    """Output schema for Classifier & Department Mapper Agent."""
    category: Literal["food_quality", "hygiene", "service", "facilities", "billing", "general"] = Field(
        ..., description="Standardized operational category"
    )
    department_code: Literal["food_quality", "hygiene", "service", "facilities", "billing"] = Field(
        ..., description="Mapped operational department code"
    )
    sentiment: Literal["positive", "neutral", "negative", "critical"] = Field(
        ..., description="Evaluated emotional sentiment"
    )
    sentiment_score: float = Field(
        ..., ge=-1.0, le=1.0, description="Normalized sentiment score from -1.0 (extreme dissatisfaction) to 1.0 (delight)"
    )
    urgency: Literal["P1", "P2", "P3", "P4"] = Field(
        ..., description="Urgency priority level: P1 Critical (safety/hygiene), P2 High, P3 Medium, P4 Low"
    )
    summary: str = Field(..., max_length=500, description="One-sentence executive summary of the feedback")
    keywords: List[str] = Field(default_factory=list, description="Extracted domain keywords")


class TaskGenerationOutput(BaseModel):
    """Output schema for Task Generator & Prioritization Agent."""
    title: str = Field(..., max_length=255, description="Clear, action-oriented operational task title")
    description: str = Field(..., max_length=1500, description="Detailed actionable instructions for the department team")
    priority: Literal["P1", "P2", "P3", "P4"] = Field(..., description="Operational priority")
    recommended_department_code: Literal["food_quality", "hygiene", "service", "facilities", "billing"] = Field(
        ..., description="Assigned department code"
    )
    suggested_actions: List[str] = Field(
        default_factory=list, description="Step-by-step containment and corrective actions"
    )


class RecurringPredictionOutput(BaseModel):
    """Output schema for Recurring Issue Prediction Agent."""
    recurring_pattern_identified: bool = Field(
        ..., description="Whether this feedback matches an emerging or established recurring pattern"
    )
    fingerprint: str = Field(..., max_length=100, description="Unique normalized pattern fingerprint")
    title: str = Field(..., max_length=255, description="Title characterizing the recurring issue")
    frequency_count: int = Field(default=1, description="Estimated occurrence frequency across the window")
    predicted_root_cause: str = Field(..., max_length=1500, description="AI-diagnosed operational root cause")
    recommended_preventive_action: str = Field(
        ..., max_length=1500, description="Preventive SOP or maintenance recommendations"
    )


class VerificationOutput(BaseModel):
    """Output schema for Fix Verification & Quality Audit Agent."""
    status: Literal["passed", "failed", "reopened"] = Field(..., description="Audit outcome")
    recurrence_detected: bool = Field(..., description="Whether identical complaints re-emerged post-resolution")
    audit_notes: str = Field(..., max_length=1500, description="Reasoning and evidence justifying the audit outcome")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Audit confidence index")


class ReportSynthesisOutput(BaseModel):
    """Output schema for Executive Report Generator Agent."""
    title: str = Field(..., max_length=255, description="Report headline")
    executive_summary: str = Field(..., max_length=2500, description="Strategic narrative executive summary")
    operational_highlights: List[str] = Field(
        default_factory=list, description="Key departmental achievements or critical warnings"
    )
    preventive_recommendations: List[str] = Field(
        default_factory=list, description="Strategic improvements for executive leadership"
    )
