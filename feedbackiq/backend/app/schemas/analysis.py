import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

SentimentType = Literal["positive", "neutral", "negative", "mixed", "uncertain"]
IssueCategoryType = Literal[
    "taste",
    "temperature",
    "hygiene",
    "freshness",
    "portion_size",
    "service",
    "ambience",
    "other",
]


class StructuredAnalysisOutput(BaseModel):
    """
    Pydantic schema passed directly to LangChain .with_structured_output().
    Defines the extraction contract for the LLM.
    """
    sentiment: SentimentType = Field(
        ...,
        description="Overall sentiment: positive, neutral, negative, mixed (both strong good and bad), or uncertain (unclear/ambiguous).",
    )
    mentioned_food_items: List[str] = Field(
        default_factory=list,
        description="Explicit food or beverage items named (e.g., 'Dal Tadka', 'Paneer Butter Masala', 'Chapati', 'Soup').",
    )
    service_aspects: List[str] = Field(
        default_factory=list,
        description="Operational/service aspects mentioned (e.g., 'queue length', 'counter staff', 'cleanliness', 'table setting').",
    )
    issue_categories: List[str] = Field(
        default_factory=list,
        description="Issue categories matching: taste, temperature, hygiene, freshness, portion_size, service, other.",
    )
    severity_score: int = Field(
        default=1,
        ge=1,
        le=5,
        description="Severity on scale 1-5: 1 (minor/cosmetic), 3 (moderate dissatisfaction), 5 (critical safety/health risk).",
    )
    evidence_quotes: List[str] = Field(
        default_factory=list,
        description="Exact substrings or phrases from the comment supporting the analysis.",
    )
    food_safety_flag: bool = Field(
        default=False,
        description="True if potential food poisoning, insect/hair/foreign body, raw/undercooked meat, or chemical contamination is reported.",
    )
    food_safety_reasons: List[str] = Field(
        default_factory=list,
        description="Specific safety reasons if food_safety_flag is true.",
    )
    language: str = Field(
        default="en",
        description="Detected primary language code (e.g., 'en', 'hi', 'hinglish').",
    )
    uncertainty_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence uncertainty: 0.0 (crystal clear) to 1.0 (extremely vague, empty, or incomprehensible).",
    )
    rationale: Optional[str] = Field(
        None,
        description="Brief concise justification of why this severity and classification was assigned.",
    )


class FeedbackAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    feedback_id: uuid.UUID
    organization_id: uuid.UUID
    sentiment: str
    mentioned_food_items: List[str]
    service_aspects: List[str]
    issue_categories: List[str]
    severity_score: int
    evidence_quotes: List[str]
    food_safety_flag: bool
    food_safety_reasons: List[str]
    language: str
    uncertainty_score: float
    model_name: str
    raw_model_response: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class BatchAnalysisRequest(BaseModel):
    feedback_ids: Optional[List[uuid.UUID]] = Field(
        None,
        description="Optional list of specific feedback IDs to analyze. If empty, analyzes up to 'limit' unanalyzed records.",
    )
    limit: int = Field(default=20, ge=1, le=100)


class BatchAnalysisResponse(BaseModel):
    total_requested: int
    successful_analyzed: int
    failed_analyzed: int
    safety_alerts_triggered: int
    results: List[FeedbackAnalysisResponse]
