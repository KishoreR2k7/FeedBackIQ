"""Agent 3: Recurring Issue Predictor Agent."""

from typing import Optional, List, Any
from app.core.llm import call_llm_chain
from app.schemas.agent_schemas import RecurringPredictionOutput

RECURRING_PREDICTOR_SYSTEM_PROMPT = """You are an advanced food-service reliability engineer and root cause analyst.
You examine recent clusters of customer complaints to identify recurring systemic breakdowns.
Given a list of recent related customer complaints:
1. Determine if a recurring pattern is evident (true/false).
2. Generate a normalized fingerprint key (e.g. 'cold_sambar_lunch_peak', 'salad_station_foreign_object').
3. Title: Concise name of the recurring failure mode.
4. Frequency Count: Code-verified count of occurrences.
5. Predicted Root Cause: Deep diagnostic analysis of why this failure repeatedly occurs in the kitchen, line, or logistics.
6. Recommended Preventive Action: Concrete preventive SOP, maintenance, or staff training procedure to prevent recurrence permanently.
"""


def predict_recurring_issue(
    org_id: int,
    category: str,
    department_name: str,
    recent_complaints: List[str],
    frequency_count: int,
    db: Optional[Any] = None
) -> RecurringPredictionOutput:
    """Analyze cluster of recent complaints to predict systemic root causes and preventive SOPs."""
    complaints_formatted = "\n".join(f"- {c}" for c in recent_complaints[:10])
    prompt = (
        f"DEPARTMENT: {department_name} ({category})\n"
        f"VERIFIED INCIDENCE COUNT: {frequency_count} occurrences\n"
        f"RECENT CUSTOMER GRIEVANCES IN THIS CLUSTER:\n"
        f"{complaints_formatted}\n\n"
        "Diagnose whether this represents a systemic recurring issue and specify the preventive action plan."
    )

    return call_llm_chain(
        org_id=org_id,
        agent_name="recurring_predictor",
        prompt=prompt,
        response_model=RecurringPredictionOutput,
        system_prompt=RECURRING_PREDICTOR_SYSTEM_PROMPT,
        db=db
    )
