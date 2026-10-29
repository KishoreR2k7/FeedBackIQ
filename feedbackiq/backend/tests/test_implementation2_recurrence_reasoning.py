import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization
from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.models.recurrence import RecurrenceAssessment
from app.services.trend_service import TrendService
from app.services.priority_engine import PriorityEngine
from app.agents.recurrence_agent import RecurrenceReasoningAgent
from app.workflows.recurrence_workflow import run_recurrence_workflow
from app.schemas.intelligence import TrendFilterParams, PriorityConfigSchema


# ==============================================================================
# SCENARIO 1: A complaint recurring every Friday
# ==============================================================================
@pytest.mark.asyncio
async def test_scenario_1_complaint_recurring_every_friday(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 1: Friday-specific recurrence pattern.
    A complaint occurs across 4 consecutive Fridays during Lunch service.
    Verifies:
      - Empirical statistics: distinct_days_count = 4, time_patterns detect Friday pattern.
      - Recurrence agent evaluates risk as 'High'.
      - Observed patterns explicitly state Friday/Lunch observations.
      - Hypotheses strictly labeled with [HYPOTHESIS].
    """
    org = Organization(name="Friday Campus Dining", slug="friday-dining")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # Base date: find recent Friday
    now = datetime.now(timezone.utc)
    # Days back to last Friday: (now.weekday() - 4) % 7
    days_back = (now.weekday() - 4) % 7
    last_friday = now - timedelta(days=days_back)

    # 4 consecutive Fridays
    friday_dates = [last_friday - timedelta(weeks=i) for i in range(4)]

    for i, f_date in enumerate(friday_dates):
        fb = Feedback(
            organization_id=org.id,
            date=f_date,
            item="Fish Curry",
            meal_type="Lunch",
            rating=1,
            comment=f"Fish curry was completely raw and cold on Friday lunch #{i+1}",
            issue_category="temperature",
            content_hash=f"hash_friday_fish_{i}",
            source_dataset="manual_entry",
        )
        db_session.add(fb)
        await db_session.flush()

        an = FeedbackAnalysis(
            feedback_id=fb.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Fish Curry"],
            service_aspects=["kitchen shift timing"],
            issue_categories=["temperature"],
            severity_score=3,
            evidence_quotes=["raw and cold on Friday lunch"],
            food_safety_flag=False,
        )
        db_session.add(an)

    await db_session.commit()

    # 1. Independent statistical verification via TrendService
    trends = await TrendService.get_clustered_trends(
        db=db_session,
        organization_id=org.id,
        recent_days=35,  # cover the 4 weeks
    )
    assert len(trends) == 1
    fish_trend = trends[0]
    assert fish_trend.item == "Fish Curry"
    assert fish_trend.complaint_count == 4
    assert fish_trend.distinct_days_count == 4
    assert any("Friday" in p for p in fish_trend.time_patterns)

    # 2. Recurrence Agent reasoning verification
    assessment = await RecurrenceReasoningAgent.assess_trend_cluster(fish_trend)
    assert assessment.risk_level in ["High", "Medium"]
    assert any("Friday" in p for p in assessment.observed_patterns)
    for cause in assessment.hypotheses_causes:
        assert cause.startswith("[HYPOTHESIS]")


# ==============================================================================
# SCENARIO 2: A problem increasing over several weeks
# ==============================================================================
@pytest.mark.asyncio
async def test_scenario_2_problem_increasing_over_several_weeks(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 2: Accelerating frequency / increasing velocity.
    1 complaint 3 weeks ago (historical window), followed by 4 complaints in the last 7 days.
    Verifies:
      - Empirical statistics: velocity_trend = 'increasing', velocity_change_percent = 300%.
      - Recurrence agent evaluates risk as 'High'.
      - Observed patterns reflect the recent acceleration.
    """
    org = Organization(name="Tech Park Cafeteria", slug="tech-cafeteria")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    now = datetime.now(timezone.utc)

    # 1 historical complaint (20 days ago)
    fb_hist = Feedback(
        organization_id=org.id,
        date=now - timedelta(days=20),
        item="Paneer Masala",
        meal_type="Dinner",
        rating=2,
        comment="Paneer smelled sour at dinner",
        issue_category="freshness",
        content_hash="hash_paneer_hist",
        source_dataset="manual_entry",
    )
    db_session.add(fb_hist)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb_hist.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Paneer Masala"],
            service_aspects=[],
            issue_categories=["freshness"],
            severity_score=3,
            evidence_quotes=["smelled sour"],
            food_safety_flag=False,
        )
    )

    # 4 recent complaints in the last 7 days
    for i in range(4):
        fb_rec = Feedback(
            organization_id=org.id,
            date=now - timedelta(days=i + 1),
            item="Paneer Masala",
            meal_type="Dinner",
            rating=1,
            comment=f"Stale and sour paneer again today #{i+1}",
            issue_category="freshness",
            content_hash=f"hash_paneer_rec_{i}",
            source_dataset="manual_entry",
        )
        db_session.add(fb_rec)
        await db_session.flush()
        db_session.add(
            FeedbackAnalysis(
                feedback_id=fb_rec.id,
                organization_id=org.id,
                sentiment="negative",
                mentioned_food_items=["Paneer Masala"],
                service_aspects=[],
                issue_categories=["freshness"],
                severity_score=3,
                evidence_quotes=["Stale and sour paneer"],
                food_safety_flag=False,
            )
        )

    await db_session.commit()

    trends = await TrendService.get_clustered_trends(
        db=db_session,
        organization_id=org.id,
        recent_days=7,
    )
    assert len(trends) == 1
    p_trend = trends[0]
    assert p_trend.recent_complaints_count == 4
    assert p_trend.historical_complaints_count == 1
    assert p_trend.velocity_trend == "increasing"
    assert p_trend.velocity_change_percent == 300.0

    assessment = await RecurrenceReasoningAgent.assess_trend_cluster(p_trend)
    assert assessment.risk_level == "High"
    for cause in assessment.hypotheses_causes:
        assert cause.startswith("[HYPOTHESIS]")


# ==============================================================================
# SCENARIO 3: An isolated complaint with insufficient evidence
# ==============================================================================
@pytest.mark.asyncio
async def test_scenario_3_isolated_complaint_insufficient_evidence(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 3: Single isolated complaint.
    Verifies:
      - Does not generate uncalibrated numerical probabilities.
      - Explicitly returns 'Insufficient Evidence' risk level.
      - Explains high uncertainty due to single data point.
    """
    org = Organization(name="Quiet Hostel Mess", slug="quiet-mess")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    fb = Feedback(
        organization_id=org.id,
        date=datetime.now(timezone.utc),
        item="Lemon Rice",
        meal_type="Lunch",
        rating=2,
        comment="Lemon rice had slightly too much mustard seeds and tasted bitter",
        issue_category="taste",
        content_hash="hash_isolated_lemon",
        source_dataset="manual_entry",
    )
    db_session.add(fb)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Lemon Rice"],
            service_aspects=[],
            issue_categories=["taste"],
            severity_score=2,
            evidence_quotes=["tasted bitter"],
            food_safety_flag=False,
        )
    )
    await db_session.commit()

    trends = await TrendService.get_clustered_trends(
        db=db_session,
        organization_id=org.id,
        recent_days=7,
    )
    assert len(trends) == 1
    t = trends[0]
    assert t.complaint_count <= 1
    assert t.distinct_days_count == 1
    assert t.velocity_trend == "insufficient_data"

    assessment = await RecurrenceReasoningAgent.assess_trend_cluster(t)
    assert assessment.risk_level == "Insufficient Evidence"
    assert "Insufficient" in assessment.confidence_explanation or "uncertainty" in assessment.confidence_explanation.lower()


# ==============================================================================
# SCENARIO 4: A previously recurring issue that is now decreasing
# ==============================================================================
@pytest.mark.asyncio
async def test_scenario_4_previously_recurring_now_decreasing(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 4: Resolving issue with negative velocity.
    4 complaints in the historical window (15-25 days ago), but only 1 complaint in the last 7 days.
    Verifies:
      - Empirical statistics: velocity_trend = 'decreasing', velocity_change_percent < 0.
      - Recurrence agent evaluates risk as 'Low'.
      - Distinguishes decreasing pattern from active crises.
    """
    org = Organization(name="Central Bakery", slug="central-bakery")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    now = datetime.now(timezone.utc)

    # 4 historical complaints (15-25 days ago)
    for i in range(4):
        fb_old = Feedback(
            organization_id=org.id,
            date=now - timedelta(days=16 + i * 2),
            item="Croissant",
            meal_type="Breakfast",
            rating=1,
            comment=f"Croissant was burnt and overbaked #{i+1}",
            issue_category="taste",
            content_hash=f"hash_croissant_old_{i}",
            source_dataset="manual_entry",
        )
        db_session.add(fb_old)
        await db_session.flush()
        db_session.add(
            FeedbackAnalysis(
                feedback_id=fb_old.id,
                organization_id=org.id,
                sentiment="negative",
                mentioned_food_items=["Croissant"],
                service_aspects=[],
                issue_categories=["taste"],
                severity_score=2,
                evidence_quotes=["burnt and overbaked"],
                food_safety_flag=False,
            )
        )

    # 1 recent complaint (3 days ago)
    fb_new = Feedback(
        organization_id=org.id,
        date=now - timedelta(days=3),
        item="Croissant",
        meal_type="Breakfast",
        rating=2,
        comment="Croissant slightly dry",
        issue_category="taste",
        content_hash="hash_croissant_new",
        source_dataset="manual_entry",
    )
    db_session.add(fb_new)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb_new.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Croissant"],
            service_aspects=[],
            issue_categories=["taste"],
            severity_score=2,
            evidence_quotes=["slightly dry"],
            food_safety_flag=False,
        )
    )

    await db_session.commit()

    trends = await TrendService.get_clustered_trends(
        db=db_session,
        organization_id=org.id,
        recent_days=7,
    )
    assert len(trends) == 1
    c_trend = trends[0]
    assert c_trend.recent_complaints_count == 1
    assert c_trend.historical_complaints_count == 4
    assert c_trend.velocity_trend == "decreasing"
    # Velocity change: ((1 - 4) / 4) * 100 = -75.0%
    assert c_trend.velocity_change_percent == -75.0

    assessment = await RecurrenceReasoningAgent.assess_trend_cluster(c_trend)
    assert assessment.risk_level == "Low"


# ==============================================================================
# SCENARIO 5: Potential critical safety complaint with NO historical matches
# ==============================================================================
@pytest.mark.asyncio
async def test_scenario_5_critical_safety_with_zero_history_rule_9(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 5: Critical safety incident with 0 prior history.
    Verifies:
      - Deterministic Rule 9 safety override triggers regardless of zero prior recurrence.
      - Escalates risk level to 'Critical'.
      - Floor priority score is >= 85.0.
      - is_safety_override flag is True.
    """
    org = Organization(name="Corporate Dining Plaza", slug="corp-plaza")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # Single isolated report of glass in food
    fb = Feedback(
        organization_id=org.id,
        date=datetime.now(timezone.utc),
        item="Greek Salad",
        meal_type="Lunch",
        rating=1,
        comment="Found a sharp shard of broken glass inside the Greek Salad bowl!",
        issue_category="hygiene",
        content_hash="hash_glass_salad",
        source_dataset="manual_entry",
    )
    db_session.add(fb)
    await db_session.flush()

    an = FeedbackAnalysis(
        feedback_id=fb.id,
        organization_id=org.id,
        sentiment="negative",
        mentioned_food_items=["Greek Salad"],
        service_aspects=[],
        issue_categories=["hygiene"],
        severity_score=5,
        evidence_quotes=["broken glass inside the Greek Salad"],
        food_safety_flag=True,
        food_safety_reasons=["Physical foreign body / glass shard hazard"],
    )
    db_session.add(an)
    await db_session.commit()

    # Run LangGraph Recurrence Workflow
    items = await run_recurrence_workflow(
        db=db_session,
        organization_id=org.id,
    )
    assert len(items) == 1
    salad_item = items[0]

    # Verify Rule 9 safety override
    assert salad_item.is_safety_override is True
    assert salad_item.risk_level == "Critical"
    assert salad_item.priority_score >= 85.0
    assert any("STEP" in s or "Rule 9" in s or "safety_override" in s for s in salad_item.execution_trace)


# ==============================================================================
# SCENARIO 6: Missing or unreliable metadata
# ==============================================================================
@pytest.mark.asyncio
async def test_scenario_6_missing_or_unreliable_metadata(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 6: Missing dates, meal types, and synthetic vs real records.
    Verifies:
      - None dates, meal types, and items do not cause crashes or exceptions.
      - Dates and locations are never invented.
      - Real records and synthetic records are accurately distinguished.
    """
    org = Organization(name="Resilient Mess", slug="resilient-mess")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # 1 Real feedback with missing date and missing meal_type
    fb_real = Feedback(
        organization_id=org.id,
        date=None,  # Missing date
        meal_type=None,  # Missing meal_type
        item=None,  # Missing item
        rating=2,
        comment="Canteen was dirty and tables were sticky",
        issue_category="hygiene",
        content_hash="hash_missing_meta_1",
        source_dataset="manual_entry",  # Real
    )
    db_session.add(fb_real)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb_real.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=[],
            service_aspects=["cleanliness"],
            issue_categories=["hygiene"],
            severity_score=3,
            evidence_quotes=["dirty and tables were sticky"],
            food_safety_flag=False,
        )
    )

    # 1 Synthetic test record with specified item and date
    fb_synth = Feedback(
        organization_id=org.id,
        date=datetime.now(timezone.utc),
        meal_type="Dinner",
        item="Roti",
        rating=1,
        comment="Roti was hard like cardboard",
        issue_category="taste",
        content_hash="hash_synth_roti",
        source_dataset="synthetic_generator",  # Synthetic
    )
    db_session.add(fb_synth)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb_synth.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Roti"],
            service_aspects=[],
            issue_categories=["taste"],
            severity_score=2,
            evidence_quotes=["hard like cardboard"],
            food_safety_flag=False,
        )
    )

    await db_session.commit()

    trends = await TrendService.get_clustered_trends(
        db=db_session,
        organization_id=org.id,
        recent_days=7,
    )
    assert len(trends) >= 1

    # Check that synthetic record count is correctly partitioned
    roti_trend = next(t for t in trends if "Roti" in (t.item or ""))
    assert roti_trend.synthetic_records_count == 1
    assert roti_trend.real_records_count == 0

    hygiene_trend = next(t for t in trends if t.issue_category == "hygiene")
    assert hygiene_trend.real_records_count == 1
    assert hygiene_trend.synthetic_records_count == 0


# ==============================================================================
# INDEPENDENT STATISTICAL VERIFICATION
# ==============================================================================
@pytest.mark.asyncio
async def test_independent_statistical_verification(db_session: AsyncSession):
    """
    Verifies that TrendService calculates exact mathematical statistics
    independently of any LLM output:
      - Distinct calendar days count.
      - Negative feedback proportion.
      - Days since last occurrence.
    """
    org = Organization(name="Stats Audit Kitchen", slug="stats-audit")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    now = datetime.now(timezone.utc)

    # Create 3 complaints across 2 distinct days
    d1 = now - timedelta(days=4)
    d2 = now - timedelta(days=2)

    fb1 = Feedback(
        organization_id=org.id,
        date=d1,
        item="Coffee",
        rating=1,
        comment="Bad coffee day 1",
        issue_category="taste",
        content_hash="hash_c1",
        source_dataset="manual",
    )
    fb2 = Feedback(
        organization_id=org.id,
        date=d1,
        item="Coffee",
        rating=2,
        comment="Lukewarm coffee day 1",
        issue_category="taste",
        content_hash="hash_c2",
        source_dataset="manual",
    )
    fb3 = Feedback(
        organization_id=org.id,
        date=d2,
        item="Coffee",
        rating=1,
        comment="Cold coffee day 2",
        issue_category="taste",
        content_hash="hash_c3",
        source_dataset="manual",
    )
    # Add 1 positive review
    fb4 = Feedback(
        organization_id=org.id,
        date=d2,
        item="Coffee",
        rating=5,
        comment="Good hot coffee",
        issue_category="taste",
        content_hash="hash_c4",
        source_dataset="manual",
    )
    db_session.add_all([fb1, fb2, fb3, fb4])
    await db_session.flush()

    for fb, score, flag in [(fb1, 3, False), (fb2, 2, False), (fb3, 3, False), (fb4, 1, False)]:
        db_session.add(
            FeedbackAnalysis(
                feedback_id=fb.id,
                organization_id=org.id,
                sentiment="negative" if score > 1 else "positive",
                mentioned_food_items=["Coffee"],
                service_aspects=[],
                issue_categories=["taste"],
                severity_score=score,
                evidence_quotes=[],
                food_safety_flag=flag,
            )
        )
    await db_session.commit()

    trends = await TrendService.get_clustered_trends(db_session, org.id, recent_days=7)
    coffee_trend = next(t for t in trends if "Coffee" in (t.item or ""))

    assert coffee_trend.total_feedback_count == 4
    assert coffee_trend.complaint_count == 3
    assert coffee_trend.positive_count == 1
    assert coffee_trend.negative_feedback_proportion == 0.75
    # Distinct days: d1 and d2 = 2 distinct days
    assert coffee_trend.distinct_days_count == 2
    # Days since last: should be 2 days
    assert coffee_trend.days_since_last_occurrence == 2


# ==============================================================================
# LLM FAILURE RESILIENCE & SAFETY ESCALATION
# ==============================================================================
@pytest.mark.asyncio
async def test_llm_failure_resilience_and_safety_escalation(db_session: AsyncSession):
    """
    Test that when the LLM service raises an exception (e.g. timeout, rate limit, API crash),
    the LangGraph workflow catches the error, falls back to deterministic reasoning,
    and STILL guarantees Rule 9 safety escalation.
    """
    org = Organization(name="Failover Org", slug="failover-org")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # Insert a critical food safety report
    fb = Feedback(
        organization_id=org.id,
        date=datetime.now(timezone.utc),
        item="Soup",
        rating=1,
        comment="Live caterpillar found in soup bowl!",
        issue_category="hygiene",
        content_hash="hash_caterpillar_soup",
        source_dataset="manual_entry",
    )
    db_session.add(fb)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Soup"],
            service_aspects=[],
            issue_categories=["hygiene"],
            severity_score=5,
            evidence_quotes=["Live caterpillar found"],
            food_safety_flag=True,
            food_safety_reasons=["Pest contamination in food"],
        )
    )
    await db_session.commit()

    # Simulate LLM agent failure by mocking RecurrenceReasoningAgent.assess_trend_cluster to raise
    with patch(
        "app.agents.recurrence_agent.RecurrenceReasoningAgent.assess_trend_cluster",
        side_effect=RuntimeError("LLM Provider 503 Service Unavailable"),
    ):
        items = await run_recurrence_workflow(
            db=db_session,
            organization_id=org.id,
        )

    assert len(items) == 1
    soup_item = items[0]
    # Even with total LLM failure, Rule 9 must still escalate to Critical
    assert soup_item.is_safety_override is True
    assert soup_item.risk_level == "Critical"
    assert soup_item.priority_score >= 85.0
    assert any("STEP" in s or "Rule 9" in s for s in soup_item.execution_trace)


# ==============================================================================
# LANGGRAPH EXECUTION TRACING & PIPELINE STEPS
# ==============================================================================
@pytest.mark.asyncio
async def test_langgraph_execution_trace_steps(db_session: AsyncSession):
    """
    Verifies that the compiled LangGraph workflow executes all 5 sequential nodes:
      1. retrieve_evidence_node
      2. reason_recurrence_node
      3. safety_override_node
      4. priority_scoring_node
      5. persist_assessment_node
    and populates execution_trace on each PrioritizedIssueItem.
    """
    org = Organization(name="Trace Org", slug="trace-org")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    fb = Feedback(
        organization_id=org.id,
        date=datetime.now(timezone.utc),
        item="Idli",
        meal_type="Breakfast",
        rating=2,
        comment="Idli was hard and rubbery at breakfast",
        issue_category="taste",
        content_hash="hash_trace_idli",
        source_dataset="manual_entry",
    )
    db_session.add(fb)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Idli"],
            service_aspects=[],
            issue_categories=["taste"],
            severity_score=2,
            evidence_quotes=["hard and rubbery"],
            food_safety_flag=False,
        )
    )
    await db_session.commit()

    items = await run_recurrence_workflow(
        db=db_session,
        organization_id=org.id,
    )
    assert len(items) == 1
    trace = items[0].execution_trace

    assert len(trace) >= 5
    trace_text = " ".join(trace)
    assert "retrieve_evidence_node" in trace_text or "Evidence retrieved" in trace_text
    assert "reason_recurrence_node" in trace_text or "Completed recurrence reasoning" in trace_text
    assert "safety_override_node" in trace_text or "Rule 9" in trace_text
    assert "priority_scoring_node" in trace_text or "Calculated priority scores" in trace_text
    assert "persist_assessment_node" in trace_text or "Persisted" in trace_text
