import uuid
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, model_validator


RiskLevelType = Literal["Critical", "High", "Medium", "Low", "Insufficient Evidence"]
VelocityTrendType = Literal["increasing", "stable", "decreasing", "new", "insufficient_data"]


class PriorityConfigSchema(BaseModel):
    """
    Configurable priority weighting parameters for the deterministic scoring engine.
    Ensures weights are transparent, customizable, and normalized.
    """
    w_severity: float = Field(default=0.50, ge=0.0, le=1.0, description="Weight for normalized issue severity")
    w_recurrence_risk: float = Field(default=0.30, ge=0.0, le=1.0, description="Weight for recurrence risk")
    w_recent_frequency: float = Field(default=0.20, ge=0.0, le=1.0, description="Weight for recent complaint volume")
    safety_override_floor: float = Field(default=85.0, ge=0.0, le=100.0, description="Minimum priority for critical food safety issues")

    @model_validator(mode="after")
    def check_weights_sum(self) -> "PriorityConfigSchema":
        total = self.w_severity + self.w_recurrence_risk + self.w_recent_frequency
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Priority weights must sum to approximately 1.0 (got {total:.3f})")
        return self


class TrendFilterParams(BaseModel):
    """Filter dimensions for topic grouping and historical trends."""
    location_id: Optional[uuid.UUID] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    issue_category: Optional[str] = None
    meal_type: Optional[str] = None
    channel: Optional[str] = None


class TopicTrendSummary(BaseModel):
    """
    Calculated factual metrics and grounded readable topic synthesis for a cluster.
    Computed deterministically via SQL/Python, with readable synthesis grounded in evidence.
    """
    issue_cluster_key: str
    item: Optional[str] = None
    issue_category: Optional[str] = None
    meal_type: Optional[str] = None
    
    # Grounded topic labeling from evidence (LLM-grounded or rule-based, counts never hallucinated)
    topic_label: str
    topic_summary: str

    # Calculated factual metrics
    total_feedback_count: int
    complaint_count: int
    positive_count: int
    average_rating: float
    negative_feedback_proportion: float  # 0.0 to 1.0
    
    # Frequency & velocity
    recent_complaints_count: int
    historical_complaints_count: int
    velocity_change_percent: Optional[float] = None
    velocity_trend: VelocityTrendType

    # Temporal patterns & evidence quotes
    time_patterns: List[str] = Field(default_factory=list)
    evidence_quotes: List[str] = Field(default_factory=list)

    # Food safety hazard indicator
    has_food_safety_hazard: bool = False
    food_safety_reasons: List[str] = Field(default_factory=list)
    average_severity: float = 1.0
    max_severity: int = 1

    # Supporting feedback records
    supporting_feedback_ids: List[str] = Field(
        default_factory=list, description="IDs of feedback records in this cluster"
    )


class RecurrenceAssessmentOutput(BaseModel):
    """
    Structured output returned by the Recurrence Reasoning Agent (LangChain / LLM).
    Clearly distinguishes observed empirical facts from hypotheses and recommendations.
    """
    issue_summary: str = Field(
        ...,
        description="Factual, readable synthesis of what defect or pattern is being reported grounded solely in evidence."
    )
    risk_level: RiskLevelType = Field(
        ...,
        description="Assessed likelihood of recurrence: Critical, High, Medium, Low, or Insufficient Evidence."
    )
    supporting_evidence: List[str] = Field(
        default_factory=list,
        description="Direct quotes and verified historical metrics demonstrating the pattern."
    )
    observed_patterns: List[str] = Field(
        default_factory=list,
        description="Observed empirical patterns (e.g., 'Recurring during Tuesday Lunch service over 3 consecutive weeks')."
    )
    hypotheses_causes: List[str] = Field(
        default_factory=list,
        description="Possible root causes explicitly marked with [HYPOTHESIS] prefix to separate speculation from fact."
    )
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Actionable monitoring, inspection, or kitchen operational steps."
    )
    confidence_explanation: str = Field(
        ...,
        description="Explanation of reasoning confidence, sample size limitations, or uncertainties."
    )


class PrioritizedIssueItem(BaseModel):
    """
    Comprehensive prioritized issue entity combining factual trend stats,
    recurrence reasoning assessment, and deterministic priority score.
    """
    id: Optional[uuid.UUID] = None
    issue_cluster_key: str
    item: Optional[str] = None
    issue_category: Optional[str] = None
    meal_type: Optional[str] = None
    
    # Deterministic priority score and components
    priority_score: float
    severity_score_normalized: float
    recurrence_risk_normalized: float
    recent_frequency_normalized: float
    is_safety_override: bool

    # Recurrence & risk analysis
    risk_level: str
    topic_label: str
    issue_summary: str
    supporting_evidence: List[str] = Field(default_factory=list)
    observed_patterns: List[str] = Field(default_factory=list)
    hypotheses_causes: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    confidence_explanation: str

    # Factual operational counts
    total_complaints_count: int
    recent_complaints_count: int
    historical_complaints_count: int
    velocity_change_percent: Optional[float] = None
    time_patterns: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class RecurrenceAssessmentRequest(BaseModel):
    """Request payload to trigger assessment generation."""
    issue_cluster_key: Optional[str] = None
    days_recent_window: int = Field(default=7, ge=1, le=90)
    days_historical_window: int = Field(default=30, ge=7, le=365)
