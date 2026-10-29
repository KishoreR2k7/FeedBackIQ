import logging
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool

from app.core.config import settings
from app.schemas.intelligence import (
    TopicTrendSummary,
    RecurrenceAssessmentOutput,
    RiskLevelType,
)

logger = logging.getLogger("feedbackiq.agents.recurrence_agent")


RECURRENCE_SYSTEM_PROMPT = """You are FeedbackIQ's Recurrence Reasoning Agent.
Your objective is to assess whether an identified food service quality or safety issue is likely to recur based STRICTLY on empirical historical evidence.

CRITICAL RULES:
1. Distinguish OBSERVED FACTS from HYPOTHESES and PREDICTIONS.
2. Every possible cause MUST be explicitly prefixed with '[HYPOTHESIS]' to ensure kitchen operators know it is an inference, not a proven fact.
3. NEVER invent or hallucinate complaint counts, dates, or statistics. All numbers must strictly match the provided evidence.
4. DO NOT generate arbitrary percentages as probabilities (e.g., do not say '87.4% chance of recurring').
5. Risk Level Guidelines:
   - 'Critical': Any food safety hazard (pests, foreign objects, illness, raw meat, severe spoilage) OR severe persistent failure with high velocity.
   - 'High': Consistently repeated complaints across multiple days or service shifts with increasing or steady frequency.
   - 'Medium': Occasional repeated complaints (2-3 occurrences) without severe escalation.
   - 'Low': Isolated complaint with no recurring pattern in historical data.
   - 'Insufficient Evidence': Very small sample size (1-2 records) with vague or contradictory information.
6. Provide actionable, practical monitoring and operational investigation recommendations.
"""


# LangChain Tools for empirical recurrence analysis
@tool
def calculate_recurrence_metrics(recent_count: int, historical_count: int, total_count: int) -> Dict[str, Any]:
    """Calculates factual complaint velocity, acceleration, and historical recurrence ratio."""
    ratio = recent_count / max(1, total_count)
    velocity = "new" if historical_count == 0 and recent_count > 0 else (
        "increasing" if recent_count > historical_count else "stable"
    )
    return {
        "recent_ratio": round(ratio, 2),
        "velocity_direction": velocity,
        "is_small_sample": total_count < 3,
    }


@tool
def analyze_temporal_distribution(time_patterns: List[str]) -> Dict[str, Any]:
    """Analyzes temporal patterns such as peak shifts or recurring days of the week."""
    has_day_pattern = any("Frequent on" in p for p in time_patterns)
    has_meal_pattern = any("service" in p.lower() for p in time_patterns)
    return {
        "has_day_pattern": has_day_pattern,
        "has_meal_pattern": has_meal_pattern,
        "pattern_count": len(time_patterns),
    }


class MockRecurrenceLLM:
    """Deterministic, rule-grounded recurrence evaluator for test suites and offline operation."""

    def with_structured_output(self, schema: Any):
        return self

    async def ainvoke(self, messages: Any) -> RecurrenceAssessmentOutput:
        prompt_text = ""
        for m in messages:
            content = m[1] if isinstance(m, tuple) else getattr(m, "content", "")
            prompt_text += "\n" + content

        # Deterministic extraction from prompt content
        return RecurrenceReasoningAgent.deterministic_reasoning(prompt_text)


class RecurrenceReasoningAgent:
    """
    LangChain-based reasoning agent that receives factual topic trend evidence
    and produces a validated recurrence assessment.
    """

    @classmethod
    def get_llm(cls) -> Any:
        provider = settings.LLM_PROVIDER.lower()
        if provider == "mock":
            return MockRecurrenceLLM()
        elif provider == "gemini":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=settings.LLM_MODEL or "gemini-1.5-flash",
                    google_api_key=settings.GEMINI_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"Failed to load Gemini LLM: {e}. Falling back to mock evaluator.")
                return MockRecurrenceLLM()
        elif provider == "groq":
            try:
                from langchain_groq import ChatGroq
                return ChatGroq(
                    model_name=settings.LLM_MODEL or "llama-3.1-70b-versatile",
                    groq_api_key=settings.GROQ_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"Failed to load Groq LLM: {e}. Falling back to mock evaluator.")
                return MockRecurrenceLLM()
        elif provider == "openai":
            try:
                from langchain_openai import ChatOpenAI
                return ChatOpenAI(
                    model_name=settings.LLM_MODEL or "gpt-4o-mini",
                    api_key=settings.OPENAI_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"Failed to load OpenAI LLM: {e}. Falling back to mock evaluator.")
                return MockRecurrenceLLM()
        else:
            return MockRecurrenceLLM()

    @classmethod
    def deterministic_reasoning(
        cls,
        summary_text: str,
    ) -> RecurrenceAssessmentOutput:
        """
        Deterministic, empirical reasoning algorithm guaranteeing correct factual attribution,
        hypothesis labeling, and risk categorization.
        """
        lower = summary_text.lower()
        is_safety = "food safety hazard: true" in lower or "critical food safety" in lower

        # Extract item and category if present
        item = "Food Item"
        category = "Quality"
        if "item:" in summary_text:
            try:
                item = summary_text.split("Item:")[1].split("\n")[0].strip()
            except Exception:
                pass
        if "category:" in summary_text:
            try:
                category = summary_text.split("Category:")[1].split("\n")[0].strip()
            except Exception:
                pass

        # Extract counts
        complaint_count = 1
        if "complaint count:" in lower:
            try:
                c_str = summary_text.split("Complaint Count:")[1].split("\n")[0].strip()
                complaint_count = int(c_str)
            except Exception:
                pass

        total_count = complaint_count
        if "total feedback count:" in lower:
            try:
                t_str = summary_text.split("Total Feedback Count:")[1].split("\n")[0].strip()
                total_count = int(t_str)
            except Exception:
                pass

        # Determine risk level
        risk_level: RiskLevelType
        if is_safety:
            risk_level = "Critical"
        elif total_count < 2 or complaint_count < 2:
            risk_level = "Insufficient Evidence" if total_count <= 1 else "Low"
        elif complaint_count >= 4 or "velocity: increasing" in lower:
            risk_level = "High"
        elif complaint_count >= 2:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        # Hypotheses tailored to category
        hypotheses: List[str] = []
        recommendations: List[str] = []

        if is_safety:
            hypotheses.append(f"[HYPOTHESIS] Vendor delivery hygiene compromise or improper cold-chain refrigeration for {item}.")
            hypotheses.append(f"[HYPOTHESIS] Inadequate physical barrier or kitchen pest control coverage around prep area.")
            recommendations.append(f"Immediately halt serving current batch of {item} and inspect preparation area.")
            recommendations.append("Audit supplier food-safety certificates and storage temperature logs.")
        elif "temperature" in category.lower() or "cold" in lower:
            hypotheses.append(f"[HYPOTHESIS] Steam table bain-marie heater cycling off or food placed in serving pans before water reaches holding temperature (60°C).")
            hypotheses.append(f"[HYPOTHESIS] Delayed transport from central kitchen to dining hall without insulated thermal containers.")
            recommendations.append(f"Log core temperature of {item} every 20 minutes during serving hours.")
            recommendations.append("Calibrate steam table thermostats and inspect heating elements.")
        elif "taste" in category.lower() or "salt" in lower:
            hypotheses.append(f"[HYPOTHESIS] Batch seasoning recipe inconsistency across alternate chef shifts.")
            hypotheses.append(f"[HYPOTHESIS] Evaporation during prolonged holding leading to concentration of salt/spices.")
            recommendations.append(f"Standardize gram-weight ingredient measure for {item} batch recipes.")
            recommendations.append("Require senior cook taste-testing and sign-off before counter release.")
        elif "freshness" in category.lower() or "sour" in lower or "stale" in lower:
            hypotheses.append(f"[HYPOTHESIS] Storage of dairy or perishable base beyond maximum FIFO holding window.")
            recommendations.append(f"Verify refrigeration logs (< 4°C) for {item} raw ingredients.")
            recommendations.append("Enforce strict FIFO (First In, First Out) raw ingredient tagging.")
        else:
            hypotheses.append(f"[HYPOTHESIS] Operational procedure variation during peak service demand periods.")
            recommendations.append(f"Conduct supervisory observation during upcoming service shifts for {item}.")

        # Supporting evidence extraction
        evidence: List[str] = []
        if "evidence quotes:" in summary_text:
            try:
                eq_block = summary_text.split("Evidence Quotes:")[1].split("Observed Time Patterns:")[0]
                lines = [line.strip("- ").strip() for line in eq_block.split("\n") if line.strip("- ").strip()]
                evidence.extend(lines[:3])
            except Exception:
                pass
        if not evidence:
            evidence.append(f"{complaint_count} negative feedback reports recorded out of {total_count} total submissions.")

        # Observed patterns extraction
        patterns: List[str] = []
        if "observed time patterns:" in summary_text:
            try:
                tp_block = summary_text.split("Observed Time Patterns:")[1].split("\n\n")[0]
                lines = [line.strip("- ").strip() for line in tp_block.split("\n") if line.strip("- ").strip()]
                patterns.extend(lines[:3])
            except Exception:
                pass
        if not patterns:
            patterns.append(f"Observed across {complaint_count} customer reports.")

        # Confidence explanation
        if total_count <= 1:
            confidence = "High uncertainty / Insufficient evidence: Single isolated report is inadequate to confirm systemic recurrence."
        elif complaint_count >= 3:
            confidence = f"High confidence: Supported by {complaint_count} consistent empirical reports demonstrating a recurring operational defect."
        else:
            confidence = f"Moderate confidence: {complaint_count} reports observed. Further monitoring recommended to distinguish trend from random fluctuation."

        issue_summary = (
            f"Recurring quality defect: {item} ({category}) reported across {complaint_count} customer complaints."
            if not is_safety else
            f"CRITICAL SAFETY CONCERN: Urgent contamination or safety hazard reported in {item}."
        )

        return RecurrenceAssessmentOutput(
            issue_summary=issue_summary,
            risk_level=risk_level,
            supporting_evidence=evidence,
            observed_patterns=patterns,
            hypotheses_causes=hypotheses,
            recommended_actions=recommendations,
            confidence_explanation=confidence,
        )

    @classmethod
    async def assess_trend_cluster(
        cls,
        trend: TopicTrendSummary,
    ) -> RecurrenceAssessmentOutput:
        """
        Orchestrates recurrence reasoning for a single topic trend cluster.
        Feeds strict factual evidence to LLM or deterministic fallback.
        """
        # Build factual prompt grounded in empirical metrics
        evidence_str = "\n".join([f"- \"{q}\"" for q in trend.evidence_quotes]) or "- None provided"
        patterns_str = "\n".join([f"- {p}" for p in trend.time_patterns]) or "- No distinct temporal pattern detected"

        prompt_content = f"""Empirical Evidence Input:
Item: {trend.item or 'Unknown Item'}
Category: {trend.issue_category or 'General'}
Meal Type: {trend.meal_type or 'All Meals'}
Total Feedback Count: {trend.total_feedback_count}
Complaint Count: {trend.complaint_count}
Average Rating: {trend.average_rating} / 5.0
Recent Complaints (Last Window): {trend.recent_complaints_count}
Historical Complaints: {trend.historical_complaints_count}
Velocity: {trend.velocity_trend} ({trend.velocity_change_percent or 0.0}%)
Food Safety Hazard: {trend.has_food_safety_hazard}
Food Safety Reasons: {", ".join(trend.food_safety_reasons) if trend.food_safety_reasons else "None"}

Evidence Quotes:
{evidence_str}

Observed Time Patterns:
{patterns_str}
"""

        llm = cls.get_llm()
        if isinstance(llm, MockRecurrenceLLM):
            return cls.deterministic_reasoning(prompt_content)

        prompt = ChatPromptTemplate.from_messages([
            ("system", RECURRENCE_SYSTEM_PROMPT),
            ("human", "{evidence_text}"),
        ])

        try:
            structured_chain = prompt | llm.with_structured_output(RecurrenceAssessmentOutput)
            result = await structured_chain.ainvoke({"evidence_text": prompt_content})
            return result
        except Exception as e:
            logger.warning(f"LLM recurrence assessment failed: {e}. Falling back to deterministic engine.")
            return cls.deterministic_reasoning(prompt_content)
