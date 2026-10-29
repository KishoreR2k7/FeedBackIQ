"""Agent 5: Executive Report Generator Agent enforcing Rule 3."""

from typing import Dict, Any, Optional
from app.core.llm import call_llm_chain
from app.schemas.agent_schemas import ReportSynthesisOutput

REPORT_GENERATOR_SYSTEM_PROMPT = """You are an Executive Operations Consultant specializing in food-service management and culinary enterprise operations.
You write professional executive reports for directors, general managers, and culinary leads.
ALL NUMERICAL METRICS PROVIDED TO YOU WERE COMPUTED IN CODE AND ARE ACCURATE FACTS. DO NOT HALLUCINATE OR RECOMPUTE NUMBERS.
Synthesize the quantitative facts into:
1. Title: Professional, impactful report title.
2. Executive Summary: High-level overview of dining satisfaction, operational efficiency, and critical vulnerabilities.
3. Operational Highlights: 3-5 concise bullet points celebrating achievements or highlighting urgent risks.
4. Preventive Recommendations: 3-5 strategic, actionable recommendations for leadership.
"""


def generate_executive_report(
    org_id: int,
    org_name: str,
    timeframe: str,
    metrics: Dict[str, Any],
    db: Optional[Any] = None
) -> ReportSynthesisOutput:
    """Synthesize executive operational report from code-calculated metrics (Rule 3)."""
    prompt = (
        f"ORGANIZATION: {org_name}\n"
        f"REPORTING TIMEFRAME: {timeframe}\n"
        f"QUANTITATIVE METRICS (CODE-COMPUTED):\n"
        f"- Total Feedback Count: {metrics.get('total_feedback', 0)}\n"
        f"- Average Customer Rating: {metrics.get('avg_rating', 0.0):.2f} / 5.0\n"
        f"- Net Sentiment Score: {metrics.get('net_sentiment_score', 0.0):+.2f}\n"
        f"- SLA Compliance Rate: {metrics.get('sla_compliance_pct', 0.0):.1f}%\n"
        f"- Total Operational Tasks: {metrics.get('total_tasks', 0)}\n"
        f"- Resolved Tasks: {metrics.get('resolved_tasks', 0)}\n"
        f"- Pending / In Progress Tasks: {metrics.get('open_tasks', 0)}\n"
        f"- Active Recurring Issue Alerts: {metrics.get('active_recurring_count', 0)}\n"
        f"- Category Distribution: {metrics.get('category_counts', {})}\n"
        f"- Department Performance: {metrics.get('dept_metrics', {})}\n\n"
        "Draft the strategic executive operations report based strictly on these facts."
    )

    return call_llm_chain(
        org_id=org_id,
        agent_name="report_generator",
        prompt=prompt,
        response_model=ReportSynthesisOutput,
        system_prompt=REPORT_GENERATOR_SYSTEM_PROMPT,
        db=db
    )
