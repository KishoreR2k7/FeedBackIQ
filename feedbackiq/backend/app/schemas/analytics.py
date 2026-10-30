from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class AnalyticsOverviewResponse(BaseModel):
    """Core summary KPIs for the canteen management team."""
    total_feedback: int = 0
    positive_count: int = 0
    negative_count: int = 0
    neutral_count: int = 0
    satisfaction_percentage: float = 0.0  # (positive / total) * 100
    negative_percentage: float = 0.0     # (negative / total) * 100
    average_rating: float = 0.0          # 1.0 to 5.0
    active_recurring_issues: int = 0     # Critical, High, or Medium recurrence risk
    critical_issues: int = 0             # Critical risk or food safety hazard
    pending_actions: int = 0             # Action tasks not yet completed/verified
    
    # Dataset breakdown
    student_canteen_count: int = 0
    synthetic_count: int = 0
    zomato_count: int = 0


class SentimentByMealItem(BaseModel):
    """Sentiment breakdown scoped to a specific meal type."""
    meal_type: str
    positive: int = 0
    negative: int = 0
    neutral: int = 0
    total: int = 0
    average_rating: float = 0.0


class SentimentTrendItem(BaseModel):
    """Timeline trend item representing sentiment over a specific date."""
    date: str  # YYYY-MM-DD
    positive: int = 0
    negative: int = 0
    neutral: int = 0
    total: int = 0
    average_rating: float = 0.0


class FoodItemStat(BaseModel):
    """Aggregated feedback statistics for an individual food item."""
    item: str
    total_feedback: int = 0
    complaint_count: int = 0
    positive_count: int = 0
    average_rating: float = 0.0
    top_issue: Optional[str] = None


class CommonComplaintStat(BaseModel):
    """Top complaints reported across feedback records."""
    issue: str
    category: str
    count: int = 0
    sample_comment: str = ""
    severity: int = 1


class CategoryDistributionItem(BaseModel):
    """Feedback distribution across standard issue categories."""
    category: str
    count: int = 0
    percentage: float = 0.0


class ExtractedTopicItem(BaseModel):
    """Common topic extracted from real feedback records with evidence quotes."""
    topic: str
    item: str
    category: str
    meal_type: Optional[str] = None
    count: int = 0
    average_rating: float = 0.0
    sentiment_ratio: float = 0.0
    sample_quotes: List[str] = Field(default_factory=list)


class AnalyticsReportResponse(BaseModel):
    """Comprehensive analytics report combining overview, charts, and extracted topics."""
    overview: AnalyticsOverviewResponse
    sentiment_by_meal: List[SentimentByMealItem]
    sentiment_trend: List[SentimentTrendItem]
    top_food_items: List[FoodItemStat]
    top_complaints: List[CommonComplaintStat]
    category_distribution: List[CategoryDistributionItem]
    common_topics: List[ExtractedTopicItem]


class RecurrencePredictionItem(BaseModel):
    """
    Standardized recurrence prediction item as specified in PS 2.5 Section 7.
    Grounded in historical data with statistical frequencies and recommended action.
    """
    issue_name: str
    affected_food_item: str
    meal_type: Optional[str] = None
    number_of_occurrences: int
    recent_frequency: int
    historical_frequency: int
    severity: int
    recurrence_risk_score: float
    risk_category: str  # Critical, High, Medium, Low, Insufficient Evidence
    has_insufficient_evidence: bool = False
    supporting_evidence: List[str] = Field(default_factory=list)
    recommended_preventive_action: str
