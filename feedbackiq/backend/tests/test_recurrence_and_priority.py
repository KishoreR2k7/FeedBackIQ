import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization
from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.models.recurrence import RecurrenceAssessment
from app.services.priority_engine import PriorityEngine
from app.schemas.intelligence import PriorityConfigSchema, RecurrenceAssessmentOutput
from app.agents.recurrence_agent import RecurrenceReasoningAgent


@pytest.mark.asyncio
async def test_priority_engine_normalization_and_formula():
    """Verify deterministic priority arithmetic and component normalization."""
    # 1. Normalization tests
    # Severity: (5 max, 5 avg) -> effective 5.0 -> ((5-1)/4)*100 = 100.0
    norm_sev_max = PriorityEngine.normalize_severity(avg_severity=5.0, max_severity=5)
    assert norm_sev_max == 100.0

    # Severity: (1 max, 1 avg) -> effective 1.0 -> 0.0
    norm_sev_min = PriorityEngine.normalize_severity(avg_severity=1.0, max_severity=1)
    assert norm_sev_min == 0.0

    # Recurrence risk normalization
    assert PriorityEngine.normalize_recurrence_risk("Critical") == 100.0
    assert PriorityEngine.normalize_recurrence_risk("High") == 75.0
    assert PriorityEngine.normalize_recurrence_risk("Medium") == 50.0
    assert PriorityEngine.normalize_recurrence_risk("Low") == 25.0
    assert PriorityEngine.normalize_recurrence_risk("Insufficient Evidence") == 10.0

    # Recent frequency normalization: 3 complaints -> 3 * 20 = 60.0
    assert PriorityEngine.normalize_recent_frequency(3) == 60.0
    # 6 complaints -> clamped to 100.0
    assert PriorityEngine.normalize_recent_frequency(6) == 100.0

    # 2. Formula test: Default weights (0.50, 0.30, 0.20)
    # Severity: 3.0 avg, 3 max -> ((3-1)/4)*100 = 50.0
    # Recurrence: High = 75.0
    # Frequency: 3 complaints = 60.0
    # Expected: (0.50 * 50.0) + (0.30 * 75.0) + (0.20 * 60.0) = 25.0 + 22.5 + 12.0 = 59.5
    score, sev, rec, freq, is_override = PriorityEngine.calculate_priority(
        avg_severity=3.0,
        max_severity=3,
        risk_level="High",
        recent_complaints=3,
        has_food_safety_hazard=False,
    )
    assert sev == 50.0
    assert rec == 75.0
    assert freq == 60.0
    assert score == 59.5
    assert is_override is False

    # 3. Custom weights test
    custom_cfg = PriorityConfigSchema(
        w_severity=0.60,
        w_recurrence_risk=0.20,
        w_recent_frequency=0.20,
        safety_override_floor=85.0,
    )
    # Expected: (0.60 * 50.0) + (0.20 * 75.0) + (0.20 * 60.0) = 30.0 + 15.0 + 12.0 = 57.0
    score_custom, _, _, _, _ = PriorityEngine.calculate_priority(
        avg_severity=3.0,
        max_severity=3,
        risk_level="High",
        recent_complaints=3,
        has_food_safety_hazard=False,
        config=custom_cfg,
    )
    assert score_custom == 57.0


@pytest.mark.asyncio
async def test_rule_9_safety_override_floor():
    """
    Test Rule 9 Safety Override:
    An isolated single complaint about a food safety hazard (e.g., broken glass, pest)
    must NEVER be deprioritized due to limited historical frequency.
    """
    # Severity 5 max, but low historical frequency (1 recent complaint = 20.0), Low risk (25.0)
    # Raw formula: 0.50 * 100 + 0.30 * 25 + 0.20 * 20 = 50 + 7.5 + 4 = 61.5
    # With safety override: must be floored to at least 85.0 and is_safety_override = True
    score, sev, rec, freq, is_override = PriorityEngine.calculate_priority(
        avg_severity=5.0,
        max_severity=5,
        risk_level="Low",
        recent_complaints=1,
        has_food_safety_hazard=True,
    )
    assert is_override is True
    assert score >= 85.0


@pytest.mark.asyncio
async def test_topic_trends_sql_python_calculation(client: AsyncClient, db_session: AsyncSession):
    """
    Test SQL/Python facts: complaint count, negative proportion, velocity % change,
    and temporal pattern detection for repeated complaints.
    """
    # Create Organization
    org = Organization(name="Catering College Org", slug="catering-college")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    now = datetime.now(timezone.utc)

    # Seed 1 historical complaint (15 days ago)
    fb_hist = Feedback(
        organization_id=org.id,
        date=now - timedelta(days=15),
        item="Dal Tadka",
        meal_type="Lunch",
        rating=2,
        comment="Dal Tadka was served completely cold at lunch",
        issue_category="temperature",
        content_hash="hash_dal_hist",
    )
    db_session.add(fb_hist)
    await db_session.flush()

    an_hist = FeedbackAnalysis(
        feedback_id=fb_hist.id,
        organization_id=org.id,
        sentiment="negative",
        mentioned_food_items=["Dal Tadka"],
        service_aspects=["temperature upkeep"],
        issue_categories=["temperature"],
        severity_score=3,
        evidence_quotes=["completely cold at lunch"],
        food_safety_flag=False,
    )
    db_session.add(an_hist)

    # Seed 3 recent complaints (within last 3 days)
    for i in range(3):
        fb_recent = Feedback(
            organization_id=org.id,
            date=now - timedelta(days=i + 1),
            item="Dal Tadka",
            meal_type="Lunch",
            rating=1,
            comment=f"Cold sambar and cold Dal Tadka again today #{i+1}",
            issue_category="temperature",
            content_hash=f"hash_dal_rec_{i}",
        )
        db_session.add(fb_recent)
        await db_session.flush()

        an_recent = FeedbackAnalysis(
            feedback_id=fb_recent.id,
            organization_id=org.id,
            sentiment="negative",
            mentioned_food_items=["Dal Tadka"],
            service_aspects=["temperature upkeep"],
            issue_categories=["temperature"],
            severity_score=3,
            evidence_quotes=["cold Dal Tadka again today"],
            food_safety_flag=False,
        )
        db_session.add(an_recent)

    # Seed 1 positive review for balance
    fb_pos = Feedback(
        organization_id=org.id,
        date=now - timedelta(days=2),
        item="Dal Tadka",
        meal_type="Lunch",
        rating=5,
        comment="Nice hot rice and dal",
        issue_category="temperature",
        content_hash="hash_dal_pos",
    )
    db_session.add(fb_pos)
    await db_session.flush()

    an_pos = FeedbackAnalysis(
        feedback_id=fb_pos.id,
        organization_id=org.id,
        sentiment="positive",
        mentioned_food_items=["Dal Tadka"],
        service_aspects=["temperature upkeep"],
        issue_categories=["temperature"],
        severity_score=1,
        evidence_quotes=[],
        food_safety_flag=False,
    )
    db_session.add(an_pos)
    await db_session.commit()

    # Query trends API
    response = await client.get(
        "/api/v1/intelligence/trends",
        headers={"X-Organization-Id": str(org.id)},
    )
    assert response.status_code == 200
    trends = response.json()
    assert len(trends) >= 1

    dal_trend = next(t for t in trends if "Dal Tadka" in t["item"])
    assert dal_trend["total_feedback_count"] == 5
    assert dal_trend["complaint_count"] == 4
    assert dal_trend["positive_count"] == 1
    assert dal_trend["recent_complaints_count"] == 3
    assert dal_trend["historical_complaints_count"] == 1
    assert dal_trend["velocity_trend"] == "increasing"
    # Velocity change: ((3 - 1) / 1) * 100 = 200.0%
    assert dal_trend["velocity_change_percent"] == 200.0
    # Negative proportion: 4 / 5 = 0.8
    assert dal_trend["negative_feedback_proportion"] == 0.8
    # Lunch pattern detected
    assert any("Lunch" in p for p in dal_trend["time_patterns"])


@pytest.mark.asyncio
async def test_isolated_complaint_and_insufficient_evidence(client: AsyncClient, db_session: AsyncSession):
    """
    Verify that an isolated single complaint handles small dataset without misleading conclusions:
    results in 'Insufficient Evidence' or 'Low' risk and velocity 'insufficient_data'.
    """
    org = Organization(name="Bistro Alpha", slug="bistro-alpha")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    fb = Feedback(
        organization_id=org.id,
        date=datetime.now(timezone.utc),
        item="Masala Chai",
        meal_type="Breakfast",
        rating=3,
        comment="Chai had slightly less ginger than usual",
        issue_category="taste",
        content_hash="hash_isolated_chai",
    )
    db_session.add(fb)
    await db_session.flush()

    an = FeedbackAnalysis(
        feedback_id=fb.id,
        organization_id=org.id,
        sentiment="neutral",
        mentioned_food_items=["Masala Chai"],
        service_aspects=[],
        issue_categories=["taste"],
        severity_score=2,
        evidence_quotes=["slightly less ginger"],
        food_safety_flag=False,
    )
    db_session.add(an)
    await db_session.commit()

    # Query trends
    res = await client.get("/api/v1/intelligence/trends", headers={"X-Organization-Id": str(org.id)})
    assert res.status_code == 200
    trends = res.json()
    chai_trend = next(t for t in trends if "Masala Chai" in t["item"])
    assert chai_trend["total_feedback_count"] == 1
    assert chai_trend["velocity_trend"] == "insufficient_data"

    # Assess recurrence
    res_rec = await client.post(
        "/api/v1/intelligence/assess-recurrence",
        headers={"X-Organization-Id": str(org.id)},
        json={"days_recent_window": 7, "days_historical_window": 30},
    )
    assert res_rec.status_code == 200
    items = res_rec.json()
    chai_item = next(i for i in items if "Masala Chai" in i["item"])
    assert chai_item["risk_level"] in ["Insufficient Evidence", "Low"]
    assert "High uncertainty" in chai_item["confidence_explanation"] or "Insufficient" in chai_item["confidence_explanation"]


@pytest.mark.asyncio
async def test_recurrence_agent_separates_facts_from_hypotheses():
    """Verify that the recurrence reasoning agent explicitly labels all causes with [HYPOTHESIS]."""
    reasoning_text = """Item: Sambar
Category: temperature
Complaint Count: 4
Total Feedback Count: 5
Velocity: increasing
Food Safety Hazard: False
Evidence Quotes:
- "Sambar was cold at lunch"
- "Cold again today"
Observed Time Patterns:
- Predominantly Lunch service (100% of reports)
"""
    output = RecurrenceReasoningAgent.deterministic_reasoning(reasoning_text)
    assert output.risk_level == "High"
    assert len(output.hypotheses_causes) > 0
    # Every cause must be explicitly labeled as a hypothesis
    for cause in output.hypotheses_causes:
        assert cause.startswith("[HYPOTHESIS]"), f"Cause does not have [HYPOTHESIS] prefix: {cause}"
    # Recommendations should be operational
    assert len(output.recommended_actions) > 0


@pytest.mark.asyncio
async def test_prioritized_issues_api_and_tenant_isolation(client: AsyncClient, db_session: AsyncSession):
    """
    Test that Prioritized Issues API returns properly sorted lists with breakdowns,
    and that Organization A and Organization B cannot see each other's data.
    """
    org_a = Organization(name="College North Mess", slug="college-north")
    org_b = Organization(name="Corporate Tech Mess", slug="corp-tech")
    db_session.add_all([org_a, org_b])
    await db_session.commit()
    await db_session.refresh(org_a)
    await db_session.refresh(org_b)

    # Ingest 1 critical food safety issue for Org A
    fb_a = Feedback(
        organization_id=org_a.id,
        date=datetime.now(timezone.utc),
        item="Chicken Curry",
        rating=1,
        comment="Found a metal wire in the chicken curry!",
        issue_category="hygiene",
        content_hash="hash_org_a_wire",
    )
    db_session.add(fb_a)
    await db_session.flush()
    an_a = FeedbackAnalysis(
        feedback_id=fb_a.id,
        organization_id=org_a.id,
        sentiment="negative",
        mentioned_food_items=["Chicken Curry"],
        service_aspects=[],
        issue_categories=["hygiene"],
        severity_score=5,
        food_safety_flag=True,
        food_safety_reasons=["Physical foreign body contamination detected"],
    )
    db_session.add(an_a)

    # Ingest 1 normal issue for Org B
    fb_b = Feedback(
        organization_id=org_b.id,
        date=datetime.now(timezone.utc),
        item="Coffee",
        rating=3,
        comment="Coffee machine is slightly slow in the morning",
        issue_category="service",
        content_hash="hash_org_b_coffee",
    )
    db_session.add(fb_b)
    await db_session.flush()
    an_b = FeedbackAnalysis(
        feedback_id=fb_b.id,
        organization_id=org_b.id,
        sentiment="neutral",
        mentioned_food_items=["Coffee"],
        service_aspects=["queue/wait time"],
        issue_categories=["service"],
        severity_score=2,
        food_safety_flag=False,
    )
    db_session.add(an_b)
    await db_session.commit()

    # Assess and retrieve Org A prioritized issues
    res_a = await client.post(
        "/api/v1/intelligence/assess-recurrence",
        headers={"X-Organization-Id": str(org_a.id)},
        json={"days_recent_window": 7, "days_historical_window": 30},
    )
    assert res_a.status_code == 200
    items_a = res_a.json()
    assert len(items_a) == 1
    assert items_a[0]["item"] == "Chicken Curry"
    assert items_a[0]["is_safety_override"] is True
    assert items_a[0]["priority_score"] >= 85.0

    # Retrieve Org B issues
    res_b = await client.get(
        "/api/v1/intelligence/prioritized-issues",
        headers={"X-Organization-Id": str(org_b.id)},
    )
    assert res_b.status_code == 200
    items_b = res_b.json()
    assert len(items_b) == 1
    assert items_b[0]["item"] == "Coffee"
    assert items_b[0]["is_safety_override"] is False

    # Verify Org B does NOT contain Chicken Curry
    assert not any("Chicken Curry" in i["item"] for i in items_b)
    # Verify Org A does NOT contain Coffee
    assert not any("Coffee" in i["item"] for i in items_a)


@pytest.mark.asyncio
async def test_priority_config_api(client: AsyncClient):
    """Test retrieving and updating priority weights."""
    # GET default config
    get_res = await client.get("/api/v1/intelligence/priority-config")
    assert get_res.status_code == 200
    cfg = get_res.json()
    assert cfg["w_severity"] == 0.50
    assert cfg["w_recurrence_risk"] == 0.30
    assert cfg["w_recent_frequency"] == 0.20

    # PUT invalid config (weights don't sum to 1)
    bad_res = await client.put(
        "/api/v1/intelligence/priority-config",
        json={
            "w_severity": 0.80,
            "w_recurrence_risk": 0.80,
            "w_recent_frequency": 0.80,
            "safety_override_floor": 85.0,
        },
    )
    assert bad_res.status_code == 422

    # PUT valid updated config
    good_res = await client.put(
        "/api/v1/intelligence/priority-config",
        json={
            "w_severity": 0.40,
            "w_recurrence_risk": 0.40,
            "w_recent_frequency": 0.20,
            "safety_override_floor": 90.0,
        },
    )
    assert good_res.status_code == 200
    updated = good_res.json()
    assert updated["w_severity"] == 0.40
    assert updated["w_recurrence_risk"] == 0.40
    assert updated["safety_override_floor"] == 90.0

    # Reset back to default
    await client.put(
        "/api/v1/intelligence/priority-config",
        json={
            "w_severity": 0.50,
            "w_recurrence_risk": 0.30,
            "w_recent_frequency": 0.20,
            "safety_override_floor": 85.0,
        },
    )
