"""Agent 1: Feedback Classifier & Department Routing Agent."""

from typing import Optional, Any
from app.core.llm import call_llm_chain
from app.schemas.agent_schemas import ClassificationOutput


CLASSIFIER_SYSTEM_PROMPT = """You are an expert hospitality and food-service operational AI classifier for dining organizations (college messes, restaurants, hospitals, cafeterias).
Your job is to analyze incoming customer feedback and extract:
1. Category: Must be exactly one of: 'food_quality', 'hygiene', 'service', 'facilities', 'billing', 'general'.
2. Department Code: Map to responsible department: 'food_quality', 'hygiene', 'service', 'facilities', 'billing'.
3. Sentiment: Exactly one of: 'positive', 'neutral', 'negative', 'critical'. (Foreign objects, food poisoning, or severe hygiene hazards must ALWAYS be marked 'critical').
4. Sentiment Score: Normalized float between -1.0 (extreme grievance) and 1.0 (ecstatic satisfaction).
5. Urgency: 'P1' (Critical safety/food contamination/pest), 'P2' (High - spoiled/sour/cold main meal, severe rudeness), 'P3' (Medium - taste preference, minor delay), 'P4' (Low/Compliment).
6. Summary: Crisp 1-sentence synopsis.
7. Keywords: 3 to 6 key operational words extracted from the feedback.
"""


def classify_feedback(
    org_id: int,
    raw_text: str,
    rating: int,
    meal_type: Optional[str] = None,
    location_table: Optional[str] = None,
    db: Optional[Any] = None
) -> ClassificationOutput:
    """Analyze feedback text and rating to generate structured operational classification."""
    prompt = (
        f"CUSTOMER RATING: {rating} / 5 stars\n"
        f"MEAL TYPE: {meal_type or 'Not specified'}\n"
        f"LOCATION/TABLE: {location_table or 'General Dining'}\n"
        f"CUSTOMER FEEDBACK COMMENT:\n\"{raw_text}\"\n\n"
        "Classify this dining feedback according to the required JSON schema."
    )

    return call_llm_chain(
        org_id=org_id,
        agent_name="classifier",
        prompt=prompt,
        response_model=ClassificationOutput,
        system_prompt=CLASSIFIER_SYSTEM_PROMPT,
        db=db
    )
