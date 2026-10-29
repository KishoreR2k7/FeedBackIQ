"""Agent 4: Fix Verification & Quality Audit Agent."""

from typing import Optional, List, Any
from app.core.llm import call_llm_chain
from app.schemas.agent_schemas import VerificationOutput

FIX_VERIFIER_SYSTEM_PROMPT = """You are a rigorous Quality Assurance Auditor for food-service operations.
Your job is to audit whether an operational task marked 'resolved' has genuinely addressed the issue.
Examine:
- Original Task Title & Description
- Staff Resolution Notes
- Code-calculated sentiment scores (before vs after)
- Subsequent customer feedback in the same category

Determine:
1. Status: 'passed' (satisfactorily fixed), 'failed' (inadequate fix / persisting complaint), 'reopened' (issue worsened).
2. Recurrence Detected: True if similar negative feedback occurred post-resolution.
3. Audit Notes: Justification of the audit finding.
4. Confidence Score: 0.0 to 1.0.
"""


def verify_task_resolution(
    org_id: int,
    task_title: str,
    task_description: str,
    resolution_notes: str,
    before_sentiment: float,
    after_sentiment: float,
    subsequent_feedback: List[str],
    db: Optional[Any] = None
) -> VerificationOutput:
    """Audit operational task resolution and detect recurrence."""
    post_feedback_text = (
        "\n".join(f"- {f}" for f in subsequent_feedback)
        if subsequent_feedback
        else "No negative feedback recorded since resolution."
    )

    prompt = (
        f"TASK TITLE: {task_title}\n"
        f"TASK DESCRIPTION: {task_description}\n"
        f"STAFF RESOLUTION NOTES: {resolution_notes or 'No resolution notes entered'}\n"
        f"COMPUTED BEFORE SENTIMENT: {before_sentiment:.2f}\n"
        f"COMPUTED AFTER SENTIMENT: {after_sentiment:.2f}\n"
        f"SUBSEQUENT FEEDBACK IN POST-RESOLUTION WINDOW:\n"
        f"{post_feedback_text}\n\n"
        "Audit this resolution and decide whether to pass or fail verification."
    )

    return call_llm_chain(
        org_id=org_id,
        agent_name="fix_verifier",
        prompt=prompt,
        response_model=VerificationOutput,
        system_prompt=FIX_VERIFIER_SYSTEM_PROMPT,
        db=db
    )
