import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, START, END
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.recurrence import RecurrenceAssessment
from app.models.audit import AuditEvent
from app.schemas.intelligence import (
    TopicTrendSummary,
    TrendFilterParams,
    PrioritizedIssueItem,
    RecurrenceAssessmentOutput,
    PriorityConfigSchema,
)
from app.services.trend_service import TrendService
from app.services.priority_engine import PriorityEngine
from app.agents.recurrence_agent import RecurrenceReasoningAgent

logger = logging.getLogger("feedbackiq.workflows.recurrence_workflow")


class RecurrenceGraphState(TypedDict, total=False):
    """Execution state for the LangGraph Recurrence Reasoning Graph."""
    db: AsyncSession
    organization_id: uuid.UUID
    target_cluster_key: Optional[str]
    filters: Optional[TrendFilterParams]
    config: Optional[PriorityConfigSchema]
    recent_days: int

    # Intermediate artifacts
    trends: List[TopicTrendSummary]
    assessments: Dict[str, RecurrenceAssessmentOutput]
    safety_overrides: Dict[str, bool]
    prioritized_items: List[PrioritizedIssueItem]

    # Tracing, execution metadata & resilience
    execution_trace: List[str]
    retry_count: int
    errors: List[str]


# ---------------------------------------------------------------------------
# LangGraph Nodes
# ---------------------------------------------------------------------------

async def retrieve_evidence_node(state: RecurrenceGraphState) -> Dict[str, Any]:
    """
    Node 1: Evidence Retrieval & Factual Calculation
    Retrieves feedback clusters and computes empirical metrics via SQL/Python.
    """
    trace = list(state.get("execution_trace", []))
    trace.append(f"[{datetime.now(timezone.utc).isoformat()}] START: retrieve_evidence_node")

    db = state["db"]
    org_id = state["organization_id"]
    recent_days = state.get("recent_days", 7)
    filters = state.get("filters")
    target_cluster = state.get("target_cluster_key")

    try:
        trends = await TrendService.get_clustered_trends(
            db=db,
            organization_id=org_id,
            filters=filters,
            recent_days=recent_days,
        )
        if target_cluster:
            trends = [t for t in trends if t.issue_cluster_key == target_cluster]

        trace.append(
            f"[{datetime.now(timezone.utc).isoformat()}] Evidence retrieved: {len(trends)} topic trend clusters identified"
        )
        return {
            "trends": trends,
            "execution_trace": trace,
        }
    except Exception as e:
        logger.error(f"Error in retrieve_evidence_node: {e}", exc_info=True)
        trace.append(f"[{datetime.now(timezone.utc).isoformat()}] ERROR: retrieve_evidence_node failed: {e}")
        return {
            "trends": [],
            "execution_trace": trace,
            "errors": [str(e)],
        }


async def reason_recurrence_node(state: RecurrenceGraphState) -> Dict[str, Any]:
    """
    Node 2: Recurrence Reasoning Agent (LangChain)
    Feeds calculated historical evidence to the LLM agent, producing structured assessments
    distinguishing verified observations from hypotheses. Includes retry logic.
    """
    trace = list(state.get("execution_trace", []))
    trace.append(f"[{datetime.now(timezone.utc).isoformat()}] START: reason_recurrence_node")

    trends = state.get("trends", [])
    assessments: Dict[str, RecurrenceAssessmentOutput] = {}
    errors = list(state.get("errors", []))

    for trend in trends:
        assessment: Optional[RecurrenceAssessmentOutput] = None
        # Attempt invocation with retry
        for attempt in range(1, 3):
            try:
                assessment = await RecurrenceReasoningAgent.assess_trend_cluster(trend)
                break
            except Exception as e:
                logger.warning(f"Recurrence agent attempt {attempt} failed for {trend.issue_cluster_key}: {e}")
                if attempt == 2:
                    errors.append(f"Cluster {trend.issue_cluster_key} agent invocation failed: {e}")
                    # Fallback to deterministic reasoning
                    prompt_snippet = (
                        f"Item: {trend.item}\nCategory: {trend.issue_category}\n"
                        f"Complaint Count: {trend.complaint_count}\nTotal Feedback Count: {trend.total_feedback_count}\n"
                        f"Velocity: {trend.velocity_trend}\nFood Safety Hazard: {trend.has_food_safety_hazard}"
                    )
                    assessment = RecurrenceReasoningAgent.deterministic_reasoning(prompt_snippet)

        if assessment:
            # Enforce distinction: all hypotheses must be marked with [HYPOTHESIS]
            cleaned_hypotheses = [
                h if h.startswith("[HYPOTHESIS]") else f"[HYPOTHESIS] {h}"
                for h in assessment.hypotheses_causes
            ]
            assessment.hypotheses_causes = cleaned_hypotheses
            assessments[trend.issue_cluster_key] = assessment

    trace.append(
        f"[{datetime.now(timezone.utc).isoformat()}] Completed recurrence reasoning for {len(assessments)} clusters"
    )
    return {
        "assessments": assessments,
        "execution_trace": trace,
        "errors": errors,
    }


async def safety_override_node(state: RecurrenceGraphState) -> Dict[str, Any]:
    """
    Node 3: Deterministic Rule 9 Safety Safeguard
    Guarantees critical food safety hazards escalate to Critical risk and cannot be suppressed.
    """
    trace = list(state.get("execution_trace", []))
    trace.append(f"[{datetime.now(timezone.utc).isoformat()}] START: safety_override_node")

    trends = state.get("trends", [])
    assessments = state.get("assessments", {})
    safety_overrides: Dict[str, bool] = {}
    overrides_triggered = 0

    for trend in trends:
        key = trend.issue_cluster_key
        assessment = assessments.get(key)
        if not assessment:
            continue

        if trend.has_food_safety_hazard:
            assessment.risk_level = "Critical"
            safety_overrides[key] = True
            overrides_triggered += 1
            if not any("CRITICAL" in h.upper() for h in assessment.hypotheses_causes):
                assessment.hypotheses_causes.insert(
                    0,
                    "[HYPOTHESIS] Critical food safety incident detected requiring immediate operational halt.",
                )
        else:
            safety_overrides[key] = False

    trace.append(
        f"[{datetime.now(timezone.utc).isoformat()}] Rule 9 Safety Safeguards verified. Overrides active: {overrides_triggered}"
    )
    return {
        "assessments": assessments,
        "safety_overrides": safety_overrides,
        "execution_trace": trace,
    }


async def priority_scoring_node(state: RecurrenceGraphState) -> Dict[str, Any]:
    """
    Node 4: Deterministic Priority Scoring Engine
    Calculates transparent normalized subscores and priority score (0-100).
    """
    trace = list(state.get("execution_trace", []))
    trace.append(f"[{datetime.now(timezone.utc).isoformat()}] START: priority_scoring_node")

    trends = state.get("trends", [])
    assessments = state.get("assessments", {})
    config = state.get("config") or PriorityEngine.get_default_config()

    prioritized_items: List[PrioritizedIssueItem] = []

    for trend in trends:
        key = trend.issue_cluster_key
        assessment = assessments.get(key)
        if not assessment:
            continue

        score, norm_sev, norm_rec, norm_freq, is_override = PriorityEngine.calculate_priority(
            avg_severity=trend.average_severity,
            max_severity=trend.max_severity,
            risk_level=assessment.risk_level,
            recent_complaints=trend.recent_complaints_count,
            has_food_safety_hazard=trend.has_food_safety_hazard,
            config=config,
        )

        item = PrioritizedIssueItem(
            issue_cluster_key=key,
            item=trend.item,
            issue_category=trend.issue_category,
            meal_type=trend.meal_type,
            priority_score=score,
            severity_score_normalized=norm_sev,
            recurrence_risk_normalized=norm_rec,
            recent_frequency_normalized=norm_freq,
            is_safety_override=is_override,
            risk_level=assessment.risk_level,
            topic_label=trend.topic_label,
            issue_summary=assessment.issue_summary,
            supporting_evidence=assessment.supporting_evidence or trend.evidence_quotes,
            observed_patterns=assessment.observed_patterns or trend.time_patterns,
            hypotheses_causes=assessment.hypotheses_causes,
            recommended_actions=assessment.recommended_actions,
            confidence_explanation=assessment.confidence_explanation,
            total_complaints_count=trend.complaint_count,
            recent_complaints_count=trend.recent_complaints_count,
            historical_complaints_count=trend.historical_complaints_count,
            velocity_change_percent=trend.velocity_change_percent,
            time_patterns=trend.time_patterns,
            distinct_days_count=trend.distinct_days_count,
            days_since_last_occurrence=trend.days_since_last_occurrence,
            last_occurred_at=trend.last_occurred_at,
            synthetic_records_count=trend.synthetic_records_count,
            real_records_count=trend.real_records_count,
            execution_trace=trace,
            created_at=datetime.now(timezone.utc),
        )
        prioritized_items.append(item)

    # Sort descending by priority score and safety override
    prioritized_items.sort(key=lambda x: (x.is_safety_override, x.priority_score), reverse=True)

    trace.append(
        f"[{datetime.now(timezone.utc).isoformat()}] Priority scores computed for {len(prioritized_items)} items"
    )
    return {
        "prioritized_items": prioritized_items,
        "execution_trace": trace,
    }


async def persist_assessment_node(state: RecurrenceGraphState) -> Dict[str, Any]:
    """
    Node 5: Database Persistence & Safety Audit Logging
    Persists recurrence assessments to PostgreSQL and creates audit events for safety alerts.
    """
    trace = list(state.get("execution_trace", []))
    trace.append(f"[{datetime.now(timezone.utc).isoformat()}] START: persist_assessment_node")

    db = state["db"]
    org_id = state["organization_id"]
    items = state.get("prioritized_items", [])

    for item in items:
        stmt = select(RecurrenceAssessment).where(
            RecurrenceAssessment.organization_id == org_id,
            RecurrenceAssessment.issue_cluster_key == item.issue_cluster_key,
        )
        res = await db.execute(stmt)
        rec_entity = res.scalars().first()

        if not rec_entity:
            rec_entity = RecurrenceAssessment(
                organization_id=org_id,
                issue_cluster_key=item.issue_cluster_key,
            )
            db.add(rec_entity)

        rec_entity.item = item.item
        rec_entity.issue_category = item.issue_category
        rec_entity.meal_type = item.meal_type
        rec_entity.risk_level = item.risk_level
        rec_entity.priority_score = item.priority_score
        rec_entity.severity_score_normalized = item.severity_score_normalized
        rec_entity.recurrence_risk_normalized = item.recurrence_risk_normalized
        rec_entity.recent_frequency_normalized = item.recent_frequency_normalized
        rec_entity.is_safety_override = item.is_safety_override
        rec_entity.total_complaints_count = item.total_complaints_count
        rec_entity.recent_complaints_count = item.recent_complaints_count
        rec_entity.historical_complaints_count = item.historical_complaints_count
        rec_entity.velocity_change_percent = item.velocity_change_percent
        rec_entity.time_patterns = item.observed_patterns
        rec_entity.supporting_evidence = item.supporting_evidence
        rec_entity.hypotheses_causes = item.hypotheses_causes
        rec_entity.recommended_actions = item.recommended_actions
        rec_entity.confidence_explanation = item.confidence_explanation

        await db.flush()
        item.id = rec_entity.id

        # Safety escalation audit logging
        if item.is_safety_override:
            audit = AuditEvent(
                organization_id=org_id,
                event_type="RECURRENCE_SAFETY_OVERRIDE",
                entity_type="recurrence_assessment",
                entity_id=str(rec_entity.id),
                event_payload={
                    "cluster_key": item.issue_cluster_key,
                    "item": item.item,
                    "risk_level": item.risk_level,
                    "priority_score": item.priority_score,
                },
            )
            db.add(audit)

    await db.commit()
    trace.append(
        f"[{datetime.now(timezone.utc).isoformat()}] Successfully persisted {len(items)} assessments to PostgreSQL"
    )
    for item in items:
        item.execution_trace = list(trace)

    return {
        "prioritized_items": items,
        "execution_trace": trace,
    }


# ---------------------------------------------------------------------------
# LangGraph Workflow Construction
# ---------------------------------------------------------------------------

def create_recurrence_workflow() -> Any:
    """Builds and compiles the LangGraph recurrence assessment workflow graph."""
    graph = StateGraph(RecurrenceGraphState)

    graph.add_node("retrieve_evidence", retrieve_evidence_node)
    graph.add_node("reason_recurrence", reason_recurrence_node)
    graph.add_node("safety_override", safety_override_node)
    graph.add_node("priority_scoring", priority_scoring_node)
    graph.add_node("persist_assessment", persist_assessment_node)

    graph.add_edge(START, "retrieve_evidence")
    graph.add_edge("retrieve_evidence", "reason_recurrence")
    graph.add_edge("reason_recurrence", "safety_override")
    graph.add_edge("safety_override", "priority_scoring")
    graph.add_edge("priority_scoring", "persist_assessment")
    graph.add_edge("persist_assessment", END)

    return graph.compile()


# Singleton compiled graph instance
compiled_recurrence_graph = create_recurrence_workflow()


async def run_recurrence_workflow(
    db: AsyncSession,
    organization_id: uuid.UUID,
    target_cluster_key: Optional[str] = None,
    filters: Optional[TrendFilterParams] = None,
    config: Optional[PriorityConfigSchema] = None,
    recent_days: int = 7,
) -> List[PrioritizedIssueItem]:
    """
    Executes the LangGraph Recurrence Reasoning Graph for an organization.
    Returns prioritized issues with full evidence, risk level, and execution tracing.
    """
    initial_state: RecurrenceGraphState = {
        "db": db,
        "organization_id": organization_id,
        "target_cluster_key": target_cluster_key,
        "filters": filters,
        "config": config,
        "recent_days": recent_days,
        "execution_trace": [f"[{datetime.now(timezone.utc).isoformat()}] Initialized Recurrence Workflow Graph"],
        "retry_count": 0,
        "errors": [],
    }

    final_state = await compiled_recurrence_graph.ainvoke(initial_state)
    return final_state.get("prioritized_items", [])
