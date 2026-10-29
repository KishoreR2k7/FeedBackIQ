"""Agent 2: Task Generator & Prioritization Agent."""

from typing import Optional, Any
from datetime import datetime, timezone, timedelta
from app.core.llm import call_llm_chain
from app.schemas.agent_schemas import ClassificationOutput, TaskGenerationOutput
from app.models.department import Department

TASK_GENERATOR_SYSTEM_PROMPT = """You are an operational task planner for food-service management.
Based on customer grievances, generate an immediate, highly actionable task for the department in-charge and ground employees.
Your task instructions must include:
1. Title: Action-oriented (e.g. 'Audit Bain-Marie Holding Temperature & Sambar Recipe').
2. Description: Detailed steps explaining the root investigation required.
3. Priority: Must match urgency: 'P1', 'P2', 'P3', or 'P4'.
4. Recommended Department: 'food_quality', 'hygiene', 'service', 'facilities', or 'billing'.
5. Suggested Actions: 2-4 concrete, pragmatic immediate containment checkpoints.
"""


def should_generate_task(rating: int, classification: ClassificationOutput) -> bool:
    """Determine deterministically in code whether feedback requires an operational task."""
    if rating <= 3:
        return True
    if classification.sentiment in ("negative", "critical"):
        return True
    if classification.urgency in ("P1", "P2", "P3"):
        return True
    return False


def calculate_sla_deadline(
    department: Optional[Department],
    priority: str,
    from_time: Optional[datetime] = None
) -> datetime:
    """Rule 3: Code counts, LLM thinks. Compute SLA deadline deterministically."""
    now = from_time or datetime.now(timezone.utc)
    
    # Default fallback SLA hours if department not found
    sla_map = {
        "P1": getattr(department, "sla_hours_p1", 2),
        "P2": getattr(department, "sla_hours_p2", 6),
        "P3": getattr(department, "sla_hours_p3", 24),
        "P4": getattr(department, "sla_hours_p4", 48),
    }
    
    hours = sla_map.get(priority, 24)
    return now + timedelta(hours=hours)


def generate_operational_task(
    org_id: int,
    raw_text: str,
    classification: ClassificationOutput,
    department_name: str,
    db: Optional[Any] = None
) -> TaskGenerationOutput:
    """Generate structured operational action task from classified feedback."""
    prompt = (
        f"CUSTOMER COMPLAINT: \"{raw_text}\"\n"
        f"CLASSIFICATION CATEGORY: {classification.category}\n"
        f"SENTIMENT: {classification.sentiment} (Score: {classification.sentiment_score})\n"
        f"URGENCY LEVEL: {classification.urgency}\n"
        f"RESPONSIBLE DEPARTMENT: {department_name} ({classification.department_code})\n\n"
        "Generate a targeted operational task specification for immediate assignment."
    )

    return call_llm_chain(
        org_id=org_id,
        agent_name="task_generator",
        prompt=prompt,
        response_model=TaskGenerationOutput,
        system_prompt=TASK_GENERATOR_SYSTEM_PROMPT,
        db=db
    )
