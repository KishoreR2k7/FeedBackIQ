import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization, OrgTemplateType
from app.models.feedback import Feedback
from app.models.task import ActionTask, TaskStatus
from app.services.feedback_service import FeedbackService
from app.services.intelligence_service import IntelligenceService
from app.services.task_service import TaskService
from app.services.analytics_service import AnalyticsService


async def create_test_org(db: AsyncSession) -> Organization:
    org = Organization(
        id=uuid.uuid4(),
        name=f"PS 2.5 Test Campus Mess - {uuid.uuid4().hex[:6]}",
        slug=f"ps25-test-{uuid.uuid4().hex[:8]}",
        template_type=OrgTemplateType.COLLEGE,
        is_active=True,
        settings={
            "feedback_channels": ["student_form", "complaint", "qr_scan"],
            "service_slots": ["Breakfast", "Lunch", "Evening Snacks", "Dinner"],
        },
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.mark.asyncio
async def test_scenario_1_new_negative_feedback_saved_analyzed(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 1: New feedback
    Submit negative feedback about cold rice.
    Expected: Feedback is saved, analyzed and included in analytics.
    """
    test_org = await create_test_org(db_session)
    payload = {
        "item": "Rice",
        "meal_type": "Lunch",
        "rating": 1,
        "comment": "The rice was cold again during lunch. This is happening almost every day.",
        "channel": "student_form",
        "issue_category": "Food Temperature",
        "source_dataset": "canteen_form",
    }
    res = await client.post(
        "/api/v1/feedback",
        json=payload,
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["item"] == "Rice"
    assert data["rating"] == 1
    assert data["analysis"] is not None
    assert data["analysis"]["sentiment"] == "negative"
    assert data["analysis"]["severity_score"] >= 2

    # Verify it reflects in analytics overview
    overview_res = await client.get(
        "/api/v1/analytics/overview",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert overview["total_feedback"] >= 1
    assert overview["negative_count"] >= 1
    assert overview["student_canteen_count"] >= 1


@pytest.mark.asyncio
async def test_scenario_2_recurring_feedback_detection(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 2: Recurring feedback
    Submit similar cold rice complaints across multiple dates.
    Expected: The system identifies a recurring food temperature issue and provides supporting evidence.
    """
    test_org = await create_test_org(db_session)
    now = datetime.now(timezone.utc)
    # Submit complaints across 4 distinct dates
    for days_ago in [7, 5, 3, 1]:
        dt = now - timedelta(days=days_ago)
        payload = {
            "item": "Rice",
            "meal_type": "Lunch",
            "rating": 1,
            "comment": f"Cold rice served at station B on day -{days_ago}.",
            "channel": "student_form",
            "issue_category": "Food Temperature",
            "date": dt.isoformat(),
            "source_dataset": "canteen_form",
        }
        res = await client.post(
            "/api/v1/feedback",
            json=payload,
            headers={"X-Organization-Id": str(test_org.id)},
        )
        assert res.status_code == 201

    # Run recurrence assessment
    assess_res = await client.post(
        "/api/v1/intelligence/assess-recurrence",
        json={"days_recent_window": 7},
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert assess_res.status_code == 200
    items = assess_res.json()
    assert len(items) > 0

    # Find the Rice temperature cluster
    rice_cluster = next((i for i in items if "rice" in (i["item"] or "").lower()), None)
    assert rice_cluster is not None
    assert rice_cluster["risk_level"] in ["Critical", "High", "Medium"]
    assert rice_cluster["total_complaints_count"] >= 4
    assert len(rice_cluster["supporting_evidence"]) > 0

    # Check prediction output endpoint
    pred_res = await client.get(
        "/api/v1/issues/predictions",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert pred_res.status_code == 200
    predictions = pred_res.json()
    rice_pred = next((p for p in predictions if "rice" in p["affected_food_item"].lower()), None)
    assert rice_pred is not None
    assert rice_pred["number_of_occurrences"] >= 4
    assert rice_pred["risk_category"] in ["Critical", "High", "Medium"]
    assert len(rice_pred["supporting_evidence"]) > 0


@pytest.mark.asyncio
async def test_scenario_3_critical_hygiene_issue_rule_9_override(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 3: Critical issue
    Submit food hygiene complaint with biological contamination / undercooked meat hazard.
    Expected: The issue receives appropriate critical attention and a high-priority corrective action (Rule 9).
    """
    test_org = await create_test_org(db_session)
    payload = {
        "item": "Chicken Biryani",
        "meal_type": "Lunch",
        "rating": 1,
        "comment": "Chicken was raw and pink inside near bone! Severe food poisoning hazard.",
        "channel": "complaint",
        "issue_category": "Hygiene & Cleanliness",
        "source_dataset": "canteen_form",
    }
    res = await client.post(
        "/api/v1/feedback",
        json=payload,
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["analysis"]["food_safety_flag"] is True

    # Run recurrence & priority pipeline
    assess_res = await client.post(
        "/api/v1/intelligence/assess-recurrence",
        json={"days_recent_window": 7},
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert assess_res.status_code == 200
    items = assess_res.json()
    safety_item = next((i for i in items if "chicken" in (i["item"] or "").lower()), None)
    assert safety_item is not None
    # Rule 9 guarantees score >= 85.0 and Critical risk
    assert safety_item["is_safety_override"] is True
    assert safety_item["priority_score"] >= 85.0
    assert safety_item["risk_level"] == "Critical"

    # Check action generation
    actions_res = await client.post(
        "/api/v1/actions",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert actions_res.status_code == 200
    actions = actions_res.json()
    safety_action = next((a for a in actions if "chicken" in (a["item"] or "").lower()), None)
    assert safety_action is not None
    assert safety_action["priority_score"] >= 85.0


@pytest.mark.asyncio
async def test_scenario_4_positive_feedback_and_satisfaction(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 4: Positive feedback
    Submit positive feedback about food quality.
    Expected: Positive sentiment and satisfaction metrics update correctly.
    """
    test_org = await create_test_org(db_session)
    payload = {
        "item": "Masala Dosa",
        "meal_type": "Breakfast",
        "rating": 5,
        "comment": "Crisp golden dosa, perfectly spiced potato filling, and hot sambar. Excellent!",
        "channel": "student_form",
        "issue_category": None,
        "source_dataset": "canteen_form",
    }
    res = await client.post(
        "/api/v1/feedback",
        json=payload,
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert res.status_code == 201
    fb = res.json()
    assert fb["analysis"]["sentiment"] == "positive"

    # Verify analytics report
    report_res = await client.get(
        "/api/v1/analytics/report",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert report_res.status_code == 200
    report = report_res.json()
    assert report["overview"]["positive_count"] >= 1
    assert report["overview"]["satisfaction_percentage"] > 0


@pytest.mark.asyncio
async def test_scenario_5_action_lifecycle_and_verification(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 5: Action resolution
    Assign a corrective action, update its status, record resolution notes, and verify outcome.
    Expected: The action lifecycle is persisted and displayed correctly.
    """
    test_org = await create_test_org(db_session)
    # Create feedback
    await client.post(
        "/api/v1/feedback",
        json={
            "item": "Dal Tadka",
            "meal_type": "Lunch",
            "rating": 1,
            "comment": "Too much salt in the dal tadka today.",
            "channel": "student_form",
            "issue_category": "Taste & Flavor",
        },
        headers={"X-Organization-Id": str(test_org.id)},
    )
    actions_res = await client.post(
        "/api/v1/actions",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    actions = actions_res.json()
    assert len(actions) > 0
    action = actions[0]
    action_id = action["id"]

    # Assign action
    assign_res = await client.post(
        f"/api/v1/actions/{action_id}/assign",
        json={"assignee_name": "Chef Mohan", "operational_notes": "Calibrate spice measures"},
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert assign_res.status_code == 200
    assigned = assign_res.json()
    assert assigned["assignee_name"] == "Chef Mohan"
    assert assigned["status"] == "assigned"

    # Resolve action with notes
    resolve_res = await client.post(
        f"/api/v1/actions/{action_id}/resolve",
        json={"resolution_notes": "Replaced faulty salt dispenser and trained cook on standard recipe ratios."},
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert resolve_res.status_code == 200
    resolved = resolve_res.json()
    assert resolved["status"] == "completed"
    assert "dispenser" in resolved["completion_notes"]

    # Verify action outcome
    verify_res = await client.post(
        f"/api/v1/actions/{action_id}/verify?window_days=7",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert verify_res.status_code == 200
    ver_data = verify_res.json()
    assert ver_data["verification_status"] in ["Improved", "No Clear Improvement", "Insufficient Evidence"]


@pytest.mark.asyncio
async def test_scenario_6_insufficient_historical_data_handling(client: AsyncClient, db_session: AsyncSession):
    """
    Scenario 6: Insufficient historical data
    Submit feedback about an issue with no meaningful history.
    Expected: The system does not invent a recurrence prediction and indicates insufficient evidence.
    """
    test_org = await create_test_org(db_session)
    # Submit single isolated feedback
    await client.post(
        "/api/v1/feedback",
        json={
            "item": "Exotic Fruit Custard",
            "meal_type": "Dinner",
            "rating": 3,
            "comment": "Custard was slightly runny today.",
            "channel": "student_form",
            "issue_category": "Food Quality",
        },
        headers={"X-Organization-Id": str(test_org.id)},
    )

    pred_res = await client.get(
        "/api/v1/issues/predictions",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert pred_res.status_code == 200
    preds = pred_res.json()
    custard_pred = next((p for p in preds if "custard" in p["affected_food_item"].lower()), None)
    if custard_pred:
        assert custard_pred["has_insufficient_evidence"] is True
        assert custard_pred["risk_category"] in ["Insufficient Evidence", "Low"]


@pytest.mark.asyncio
async def test_dataset_discrimination_restaurant_vs_student(client: AsyncClient, db_session: AsyncSession):
    """
    Verifies that Kaggle restaurant reviews and synthetic student canteen records
    are strictly distinguished and never conflated.
    """
    test_org = await create_test_org(db_session)
    # Student canteen
    await client.post(
        "/api/v1/feedback",
        json={
            "item": "Upma",
            "meal_type": "Breakfast",
            "rating": 4,
            "comment": "Good warm upma.",
            "channel": "student_form",
            "source_dataset": "canteen_form",
        },
        headers={"X-Organization-Id": str(test_org.id)},
    )
    # Kaggle Zomato
    await client.post(
        "/api/v1/feedback",
        json={
            "item": "Pasta",
            "meal_type": None,
            "rating": 5,
            "comment": "[Italian Bistro] Great creamy pasta.",
            "channel": "zomato_review",
            "source_dataset": "zomato_bangalore",
        },
        headers={"X-Organization-Id": str(test_org.id)},
    )

    overview_res = await client.get(
        "/api/v1/analytics/overview",
        headers={"X-Organization-Id": str(test_org.id)},
    )
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert overview["student_canteen_count"] >= 1
    assert overview["zomato_count"] >= 1
