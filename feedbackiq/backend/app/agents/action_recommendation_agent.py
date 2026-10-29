import logging
import os
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import settings
from app.schemas.task import ActionRecommendationOutput
from app.schemas.intelligence import PrioritizedIssueItem, TopicTrendSummary

logger = logging.getLogger("feedbackiq.agents.action_recommendation")


class ActionRecommendationAgent:
    """
    LangChain agent generating practical, evidence-based corrective and preventive actions
    for prioritized food-quality breakdowns and food-safety alerts.
    """

    SYSTEM_PROMPT = """You are the Senior Operational Quality Director for FeedbackIQ, an enterprise food-service intelligence platform.
Your mandate is to generate practical, evidence-based Corrective and Preventive Action (CAPA) recommendations for kitchen, mess, and catering teams.

STRICT OPERATIONAL DIRECTIVES:
1. EVIDENCE BOUNDED: Base recommendations strictly on the provided complaints, evidence quotes, and verified patterns.
2. DO NOT INVENT OPERATIONAL FACTS: Never invent specific equipment model numbers, imaginary vendor names, unmentioned staff identities, or unverified recipe alterations.
3. INSUFFICIENT EVIDENCE RULE: When the issue has 'Insufficient Evidence' or low complaint volume, DO NOT assert a root cause. Recommend operational investigation, sample gathering, and targeted shift monitoring instead.
4. CRITICAL SAFETY PRIORITIZATION: For food safety hazards (pests, foreign objects, chemical contamination, illness, raw meat), prioritize immediate quarantine of batches, physical inspection, and mandatory management sign-off within 24 hours.
5. CONCRETE & ACTIONABLE:
   - Corrective Action: Immediate containment step to stop the active failure right now.
   - Preventive Action: Structural or procedural policy/checklist change to prevent recurrence.
   - Verification Criteria: Measurable operational check to confirm the issue was fixed.
   - Expected Outcome: Realistic improvement in quality and complaint volume.

Format your response strictly using the structured Pydantic contract.
"""

    @classmethod
    def _get_llm(cls) -> Optional[BaseChatModel]:
        """Configures LLM provider using system environment settings."""
        provider = getattr(settings, "LLM_PROVIDER", "mock").lower()
        if provider == "mock":
            return None

        if provider == "gemini":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
                if not api_key:
                    return None
                return ChatGoogleGenerativeAI(
                    model=getattr(settings, "LLM_MODEL", "gemini-1.5-flash"),
                    google_api_key=api_key,
                    temperature=0.0,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini LLM: {e}")
                return None

        if provider == "groq":
            try:
                from langchain_groq import ChatGroq
                api_key = os.getenv("GROQ_API_KEY")
                if not api_key:
                    return None
                return ChatGroq(
                    model_name=getattr(settings, "LLM_MODEL", "llama-3.3-70b-versatile"),
                    groq_api_key=api_key,
                    temperature=0.0,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Groq LLM: {e}")
                return None

        return None

    @classmethod
    async def recommend_for_issue(
        cls,
        issue: PrioritizedIssueItem,
        trend: Optional[TopicTrendSummary] = None,
    ) -> ActionRecommendationOutput:
        """
        Generates structured action recommendation for a prioritized issue.
        Falls back seamlessly to deterministic rule-based generation if LLM is mock or fails.
        """
        llm = cls._get_llm()

        prompt_text = cls._build_prompt(issue, trend)

        if llm:
            try:
                structured_llm = llm.with_structured_output(ActionRecommendationOutput)
                result = await structured_llm.ainvoke([
                    SystemMessage(content=cls.SYSTEM_PROMPT),
                    HumanMessage(content=prompt_text),
                ])
                if isinstance(result, ActionRecommendationOutput):
                    return result
            except Exception as e:
                logger.error(f"Action recommendation LLM invocation failed: {e}. Using deterministic engine.", exc_info=True)

        return cls.deterministic_recommendation(issue, trend)

    @classmethod
    def _build_prompt(
        cls,
        issue: PrioritizedIssueItem,
        trend: Optional[TopicTrendSummary] = None,
    ) -> str:
        quotes = issue.supporting_evidence
        patterns = issue.observed_patterns
        hypotheses = issue.hypotheses_causes

        return f"""ISSUE CLUSTER DATA:
- Item: {issue.item or 'General Canteen Service'}
- Category: {issue.issue_category or 'general'}
- Meal Shift: {issue.meal_type or 'All Shifts'}
- Priority Score: {issue.priority_score:.1f} / 100
- Recurrence Risk: {issue.risk_level}
- Safety Override Active: {issue.is_safety_override}
- Total Complaints: {issue.total_complaints_count} (Recent: {issue.recent_complaints_count}, Prior: {issue.historical_complaints_count})
- Velocity Trend: {issue.velocity_change_percent or 0.0:+.1f}% change
- Distinct Days with Complaints: {issue.distinct_days_count}
- Days Since Last Occurrence: {issue.days_since_last_occurrence if issue.days_since_last_occurrence is not None else 'N/A'}

OBSERVED EVIDENCE & PATTERNS:
{chr(10).join(f"- Pattern: {p}" for p in patterns) if patterns else '- No repeated temporal patterns detected'}
{chr(10).join(f"- Grounded Quote: {q}" for q in quotes[:4]) if quotes else '- No quotes available'}

AI WORKING HYPOTHESES:
{chr(10).join(f"- {h}" for h in hypotheses[:3]) if hypotheses else '- No hypotheses formulated'}

TASK:
Produce practical, evidence-based Corrective and Preventive Actions with verification criteria and responsible roles.
"""

    @classmethod
    def deterministic_recommendation(
        cls,
        issue: PrioritizedIssueItem,
        trend: Optional[TopicTrendSummary] = None,
    ) -> ActionRecommendationOutput:
        """
        Deterministic, evidence-grounded rule engine ensuring 100% reliable action generation
        even in offline, air-gapped, or mock LLM environments.
        """
        cat = (issue.issue_category or "general").lower()
        item = issue.item or "Food item"
        meal = issue.meal_type or "service shift"
        is_safety = issue.is_safety_override or issue.risk_level == "Critical"
        insufficient_data = issue.risk_level == "Insufficient Evidence" or issue.total_complaints_count < 2

        # 1. Critical Food Safety Safeguard
        if is_safety:
            return ActionRecommendationOutput(
                issue_summary=f"Critical food safety hazard reported for {item}: potential contamination or foreign body risk.",
                evidence_and_priority_reason=(
                    f"Elevated by Rule 9 Safety Override to priority {issue.priority_score:.1f}/100. "
                    f"Food safety alerts require immediate operational quarantine regardless of historical recurrence frequency."
                ),
                suggested_corrective_action=(
                    f"Immediately halt serving {item}, quarantine remaining stock from the batch, and conduct a physical "
                    f"inspection of prep surfaces, utensils, and storage bins."
                ),
                suggested_preventive_action=(
                    f"Implement mandatory vendor batch inspection, deep sanitation of food preparation areas, "
                    f"and conduct an immediate food safety protocol refresher with the kitchen shift staff."
                ),
                responsible_role="Hygiene Supervisor",
                suggested_deadline_days=1,
                required_approval="Food Safety Officer / Operations Manager Approval",
                estimated_effort="High",
                verification_criteria=(
                    f"Physical inspection log signed by Hygiene Supervisor confirming batch disposal, surface sanitation, "
                    f"and 0 foreign body or safety incidents in subsequent 7 days of service."
                ),
                expected_outcome=(
                    f"Elimination of safety hazard, containment of customer health risk, and full compliance restoration."
                ),
            )

        # 2. Insufficient Evidence / Isolated Anomaly
        if insufficient_data:
            return ActionRecommendationOutput(
                issue_summary=f"Single isolated customer comment regarding {item} ({cat}) during {meal}.",
                evidence_and_priority_reason=(
                    f"Classified as 'Insufficient Evidence' due to limited volume ({issue.total_complaints_count} complaint across "
                    f"{issue.distinct_days_count} calendar day). Root causes cannot be statistically confirmed without further signals."
                ),
                suggested_corrective_action=(
                    f"Conduct a brief operational check on {item} preparation during {meal} and gather 3-5 informal student/patron "
                    f"feedback samples before initiating recipe or equipment modifications."
                ),
                suggested_preventive_action=(
                    f"Maintain standard recipe adherence and monitor upcoming feedback submissions for repeated signals."
                ),
                responsible_role="Head Chef",
                suggested_deadline_days=5,
                required_approval="None / Immediate Execution",
                estimated_effort="Low",
                verification_criteria=(
                    f"Collection of at least 3 direct customer feedback checks during the next {meal} service without new negative complaints."
                ),
                expected_outcome=(
                    f"Clarification of whether the issue was a one-off anomaly or an emerging trend, preventing unnecessary operational disruption."
                ),
            )

        # 3. Category-Specific Empirical Recommendations
        if "temperature" in cat:
            return ActionRecommendationOutput(
                issue_summary=f"Recurring temperature maintenance failure: {item} served cold/lukewarm during {meal}.",
                evidence_and_priority_reason=(
                    f"Priority score {issue.priority_score:.1f}/100 driven by {issue.total_complaints_count} complaints "
                    f"across {issue.distinct_days_count} days. Empirical velocity shows repeated thermal upkeep breakdowns."
                ),
                suggested_corrective_action=(
                    f"Recalibrate hot-holding equipment (bain-marie / warmer) to maintain {item} holding temperature above 65°C (149°F). "
                    f"Preheat serving vessels and verify food core temperature with a calibrated probe before meal distribution."
                ),
                suggested_preventive_action=(
                    f"Institute a mandatory pre-service temperature logging checklist requiring the line supervisor to record holding "
                    f"temperatures at 30-minute intervals throughout {meal}."
                ),
                responsible_role="Head Chef",
                suggested_deadline_days=2,
                required_approval="None / Immediate Execution",
                estimated_effort="Low",
                verification_criteria=(
                    f"Continuous log of holding temperatures >= 65°C for 5 consecutive days and zero cold-food complaints during {meal}."
                ),
                expected_outcome=(
                    f"Restoration of proper serving temperatures and complete elimination of temperature-related complaints."
                ),
            )

        if "taste" in cat:
            return ActionRecommendationOutput(
                issue_summary=f"Flavor or seasoning inconsistency reported in {item} during {meal}.",
                evidence_and_priority_reason=(
                    f"Priority score {issue.priority_score:.1f}/100 with {issue.total_complaints_count} customer reports. "
                    f"Negative feedback indicates seasoning variability across batch preparations."
                ),
                suggested_corrective_action=(
                    f"Review batch seasoning ratios with the shift cooks; taste-test the current batch of {item} against standard recipe card "
                    f"and adjust salt/spice levels prior to counter service."
                ),
                suggested_preventive_action=(
                    f"Standardize ingredient batch measurements using pre-measured spice kits and require head cook sign-off on the pre-service tasting log."
                ),
                responsible_role="Head Chef",
                suggested_deadline_days=3,
                required_approval="None / Immediate Execution",
                estimated_effort="Low",
                verification_criteria=(
                    f"Pre-service tasting sign-off completed for all batches over the next 7 days, resulting in average rating improvement to >= 3.8."
                ),
                expected_outcome=(
                    f"Consistent flavor profile and noticeable reduction in seasoning-related dissatisfaction."
                ),
            )

        if "freshness" in cat:
            return ActionRecommendationOutput(
                issue_summary=f"Ingredient freshness or stale texture breakdown in {item} during {meal}.",
                evidence_and_priority_reason=(
                    f"Priority score {issue.priority_score:.1f}/100 reflecting {issue.total_complaints_count} freshness complaints. "
                    f"Risk level {issue.risk_level} indicates inventory storage or ingredient aging issues."
                ),
                suggested_corrective_action=(
                    f"Inspect the walk-in cooler storage and current inventory of raw ingredients used in {item}; discard any stock showing "
                    f"signs of dehydration or stale storage."
                ),
                suggested_preventive_action=(
                    f"Enforce strict First-In-First-Out (FIFO) ingredient rotation with color-coded shelf labeling and daily cooler temperature logging."
                ),
                responsible_role="Procurement & Kitchen Store Manager",
                suggested_deadline_days=2,
                required_approval="Operations Manager Approval",
                estimated_effort="Medium",
                verification_criteria=(
                    f"Daily FIFO audit log signed by store supervisor for 7 days with zero customer reports of stale ingredients."
                ),
                expected_outcome=(
                    f"Guaranteed fresh ingredient utilization and elimination of spoilage/freshness dissatisfaction."
                ),
            )

        if "hygiene" in cat:
            return ActionRecommendationOutput(
                issue_summary=f"Cleanliness or hygiene standards concern involving {item} or counter area.",
                evidence_and_priority_reason=(
                    f"Priority score {issue.priority_score:.1f}/100. Hygiene issues impact customer trust and dining satisfaction."
                ),
                suggested_corrective_action=(
                    f"Perform an immediate mid-shift sanitization of serving counters, utensils, and tray return stations associated with {item}."
                ),
                suggested_preventive_action=(
                    f"Update the shift cleaning schedule with clear responsibilities for counter wiping and staff PPE compliance (hairnets and aprons)."
                ),
                responsible_role="Hygiene Supervisor",
                suggested_deadline_days=2,
                required_approval="Operations Manager Approval",
                estimated_effort="Medium",
                verification_criteria=(
                    f"Passing score on daily hygiene inspection audit for 10 consecutive operating days."
                ),
                expected_outcome=(
                    f"Visible cleanliness compliance and elimination of service hygiene complaints."
                ),
            )

        # Default Operational Recommendation
        return ActionRecommendationOutput(
            issue_summary=f"Operational service breakdown in {item} ({cat}) during {meal}.",
            evidence_and_priority_reason=(
                f"Priority score {issue.priority_score:.1f}/100 supported by {issue.total_complaints_count} feedback reports. "
                f"Requires operational adjustment to maintain standard service quality."
            ),
            suggested_corrective_action=(
                f"Review operational workflow for {item} with the counter staff and implement immediate pacing adjustments during peak rush."
            ),
            suggested_preventive_action=(
                f"Conduct a brief shift briefing on portion consistency, counter readiness, and customer communication."
            ),
            responsible_role="Dining Hall Operations Supervisor",
            suggested_deadline_days=3,
            required_approval="None / Immediate Execution",
            estimated_effort="Medium",
            verification_criteria=(
                f"Audit of 3 consecutive meal services showing adherence to portion and queue standards without escalation."
            ),
            expected_outcome=(
                f"Smoother meal distribution and improved student satisfaction metrics."
            ),
        )
