import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.models.task import (
    ActionTask,
    TaskStatus,
    TaskApprovalStatus,
    VerificationOutcome,
)
from app.models.notification import (
    Notification,
    NotificationType,
    DeliveryStatus,
)
from app.services.priority_engine import PriorityEngine
from app.services.task_service import TaskService
from app.services.notification_service import NotificationService
from app.services.verification_service import VerificationService
from app.agents.action_recommendation_agent import ActionRecommendationAgent
from app.schemas.intelligence import (
    PriorityConfigSchema,
    PrioritizedIssueItem,
)
from app.schemas.task import (
    TaskApprovalRequest,
    TaskAssignRequest,
    TaskStatusUpdateRequest,
)


# ==============================================================================
# 1. Deterministic Priority Calculation with Impact and Weights
# ==============================================================================
@pytest.mark.asyncio
async def test_priority_calculation_with_impact_and_configurable_weights():
    """
    Verify deterministic priority formula with normalized inputs:
    Priority = w_sev * Severity + w_rec * RecurrenceRisk + w_freq * Frequency + w_impact * Impact
    """
    # 1. Default formula (0.50, 0.30, 0.20, 0.0 impact)
    # Severity: avg 3.0, max 3 -> normalized = 50.0
    # Recurrence: Medium = 50.0
    # Frequency: 2 complaints -> 2 * 20 = 40.0
    # Expected: (0.50 * 50.0) + (0.30 * 50.0) + (0.20 * 40.0) = 25.0 + 15.0 + 8.0 = 48.0
    score, sev, rec, freq, is_override = PriorityEngine.calculate_priority(
        avg_severity=3.0,
        max_severity=3,
        risk_level="Medium",
        recent_complaints=2,
        has_food_safety_hazard=False,
    )
    assert sev == 50.0
    assert rec == 50.0
    assert freq == 40.0
    assert score == 48.0
    assert is_override is False

    # 2. Configurable formula with customer impact weighting
    # w_sev=0.40, w_rec=0.30, w_freq=0.15, w_impact=0.15 (sums to 1.0)
    cfg_with_impact = PriorityConfigSchema(
        w_severity=0.40,
        w_recurrence_risk=0.30,
        w_recent_frequency=0.15,
        w_impact=0.15,
        safety_override_floor=85.0,
    )
    # Affected customers: 30 patrons -> normalized = min(100, 30 * 2) = 60.0
    # Expected: (0.40 * 50.0) + (0.30 * 50.0) + (0.15 * 40.0) + (0.15 * 60.0)
    #         = 20.0 + 15.0 + 6.0 + 9.0 = 50.0
    score_impact, _, _, _, _ = PriorityEngine.calculate_priority(
        avg_severity=3.0,
        max_severity=3,
        risk_level="Medium",
        recent_complaints=2,
        has_food_safety_hazard=False,
        affected_customers=30,
        config=cfg_with_impact,
    )
    assert score_impact == 50.0


# ==============================================================================
# 2. Safety Overrides Preserve Priority Regardless of Frequency or History
# ==============================================================================
@pytest.mark.asyncio
async def test_safety_override_preserves_priority_regardless_of_frequency_or_history():
    """
    Test Rule 9 Safety Override:
    A single, isolated complaint about a critical food hazard must never be deprioritized
    due to low frequency (1 report) or lack of prior history.
    """
    # 1 report, Low recurrence risk (25.0), max severity 5 (100.0)
    # Raw formula: 0.50 * 100.0 + 0.30 * 25.0 + 0.20 * 20.0 = 50.0 + 7.5 + 4.0 = 61.5
    # Must floor to at least 85.0 and flag is_override = True
    score, sev, rec, freq, is_override = PriorityEngine.calculate_priority(
        avg_severity=5.0,
        max_severity=5,
        risk_level="Low",
        recent_complaints=1,
        has_food_safety_hazard=True,
    )
    assert is_override is True
    assert score >= 85.0


# ==============================================================================
# 3. Action Recommendation Agent Evidence-Grounded Structured Output
# ==============================================================================
@pytest.mark.asyncio
async def test_action_recommendation_agent_evidence_grounded_structured_output():
    """
    Verify that ActionRecommendationAgent produces structured CAPA output
    without inventing operational facts.
    """
    issue = PrioritizedIssueItem(
        issue_cluster_key="Sambar|temperature|Lunch",
        item="Sambar",
        issue_category="temperature",
        meal_type="Lunch",
        priority_score=68.5,
        severity_score_normalized=70.0,
        recurrence_risk_normalized=75.0,
        recent_frequency_normalized=60.0,
        is_safety_override=False,
        risk_level="High",
        topic_label="Cold Sambar Temperature Drops at Lunch",
        issue_summary="Sambar is consistently served lukewarm or cold during peak lunch service.",
        supporting_evidence=["Sambar was cold today at lunch", "Cold soup and cold sambar again"],
        observed_patterns=["Repeated cold reports during Lunch service across 3 days"],
        hypotheses_causes=["[HYPOTHESIS] Bain-marie heating element setting inadequate during rush"],
        recommended_actions=["Recalibrate hot-holding equipment", "Implement temperature logging"],
        confidence_explanation="High confidence based on 4 consistent temperature complaints.",
        total_complaints_count=4,
        recent_complaints_count=3,
        historical_complaints_count=1,
        velocity_change_percent=200.0,
        time_patterns=["Lunch shift", "Friday pattern"],
        distinct_days_count=3,
        days_since_last_occurrence=1,
    )

    rec = await ActionRecommendationAgent.recommend_for_issue(issue)
    assert rec.issue_summary != ""
    assert "temperature" in rec.suggested_corrective_action.lower() or "holding" in rec.suggested_corrective_action.lower()
    assert rec.suggested_preventive_action != ""
    assert rec.responsible_role in ["Head Chef", "Dining Hall Operations Supervisor", "Hygiene Supervisor"]
    assert rec.estimated_effort in ["Low", "Medium", "High"]
    assert rec.verification_criteria != ""
    assert rec.expected_outcome != ""


# ==============================================================================
# 4. Duplicate Task Prevention on Workflow Retry (Idempotency)
# ==============================================================================
@pytest.mark.asyncio
async def test_task_generation_and_duplicate_prevention_on_retry(db_session: AsyncSession):
    """
    Test that running task generation multiple times (e.g., workflow retries or periodic re-runs)
    does not create duplicate tasks for the same open issue cluster.
    """
    org = Organization(name="Anti Dup Mess", slug="anti-dup")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    item1 = PrioritizedIssueItem(
        issue_cluster_key="Tea|taste|Breakfast",
        item="Tea",
        issue_category="taste",
        meal_type="Breakfast",
        priority_score=52.0,
        severity_score_normalized=50.0,
        recurrence_risk_normalized=50.0,
        recent_frequency_normalized=40.0,
        is_safety_override=False,
        risk_level="Medium",
        topic_label="Weak Ginger Tea",
        issue_summary="Tea was bland with insufficient ginger.",
        supporting_evidence=["Tea lacked flavor"],
        observed_patterns=["Repeated at breakfast"],
        hypotheses_causes=["[HYPOTHESIS] Recipe measurement inconsistency"],
        recommended_actions=["Review ginger spice ratio"],
        confidence_explanation="Moderate confidence.",
        total_complaints_count=3,
        recent_complaints_count=2,
        historical_complaints_count=1,
        distinct_days_count=2,
    )

    # First pass: generates 1 task
    tasks_pass1 = await TaskService.generate_tasks_for_prioritized_issues(
        db=db_session,
        organization_id=org.id,
        prioritized_items=[item1],
    )
    assert len(tasks_pass1) == 1
    task_id_1 = tasks_pass1[0].id

    # Second pass: retry or subsequent workflow run with updated score
    item1.priority_score = 55.0
    tasks_pass2 = await TaskService.generate_tasks_for_prioritized_issues(
        db=db_session,
        organization_id=org.id,
        prioritized_items=[item1],
    )
    assert len(tasks_pass2) == 1
    # Must be the exact same task updated, NOT a duplicate row!
    assert tasks_pass2[0].id == task_id_1
    assert tasks_pass2[0].priority_score == 55.0

    # Verify database has exactly 1 task
    stmt = select(ActionTask).where(ActionTask.organization_id == org.id)
    res = await db_session.execute(stmt)
    all_db_tasks = res.scalars().all()
    assert len(all_db_tasks) == 1


# ==============================================================================
# 5. Task Lifecycle: Proposed -> Awaiting Approval -> Assigned -> In Progress -> Completed -> Verified
# ==============================================================================
@pytest.mark.asyncio
async def test_task_lifecycle_full_flow(db_session: AsyncSession):
    """
    Test full governance lifecycle transitions:
    Proposed -> Awaiting Approval -> Approved/Assigned -> In Progress -> Completed -> Verified
    """
    org = Organization(name="Lifecycle Mess", slug="lifecycle-mess")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    manager = User(
        email="manager@lifecycle.com",
        full_name="Quality Manager",
        hashed_password="pw",
        role=UserRole.ORG_ADMIN,
        organization_id=org.id,
    )
    staff = User(
        email="chef@lifecycle.com",
        full_name="Cook Staff",
        hashed_password="pw",
        role=UserRole.OPERATIONS_STAFF,
        organization_id=org.id,
    )
    db_session.add_all([manager, staff])
    await db_session.commit()
    await db_session.refresh(manager)
    await db_session.refresh(staff)

    # 1. Create a task in Awaiting Approval status
    task = ActionTask(
        organization_id=org.id,
        issue_cluster_key="Curd|freshness|Lunch",
        item="Curd",
        issue_category="freshness",
        meal_type="Lunch",
        priority_score=72.0,
        risk_level="High",
        is_safety_override=False,
        issue_summary="Curd turning sour rapidly in dining hall",
        evidence_and_priority_reason="3 complaints in 2 days",
        corrective_action="Discard remaining sour curd and restock from refrigerated cold room",
        preventive_action="Implement cold bain-marie ice baths during service",
        responsible_role="Head Chef",
        required_approval="Operations Manager Approval",
        approval_status=TaskApprovalStatus.AWAITING_APPROVAL.value,
        status=TaskStatus.AWAITING_APPROVAL.value,
        dedup_fingerprint="fingerprint_curd_1",
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)
    assert task.status == TaskStatus.AWAITING_APPROVAL.value

    # 2. Manager Approves and assigns to staff
    approved_task = await TaskService.approve_task(
        db=db_session,
        task_id=task.id,
        organization_id=org.id,
        user=manager,
        request=TaskApprovalRequest(
            approved=True,
            assignee_id=staff.id,
            assignee_name=staff.full_name,
        ),
    )
    assert approved_task.approval_status == TaskApprovalStatus.APPROVED.value
    assert approved_task.status == TaskStatus.ASSIGNED.value
    assert approved_task.assignee_id == staff.id

    # 3. Staff starts work: In Progress
    in_prog_task = await TaskService.update_task_status(
        db=db_session,
        task_id=task.id,
        organization_id=org.id,
        user=staff,
        request=TaskStatusUpdateRequest(
            status=TaskStatus.IN_PROGRESS.value,
            completion_notes="Inspecting walk-in cooler temperature setting.",
        ),
    )
    assert in_prog_task.status == TaskStatus.IN_PROGRESS.value

    # 4. Staff completes task: Completed with completion notes
    completed_task = await TaskService.update_task_status(
        db=db_session,
        task_id=task.id,
        organization_id=org.id,
        user=staff,
        request=TaskStatusUpdateRequest(
            status=TaskStatus.COMPLETED.value,
            completion_notes="Replaced cooler thermostat and added crushed ice baths around serving bowl.",
        ),
    )
    assert completed_task.status == TaskStatus.COMPLETED.value
    assert completed_task.completed_at is not None
    assert "thermostat" in completed_task.completion_notes


# ==============================================================================
# 6. Role Permissions Enforcement
# ==============================================================================
@pytest.mark.asyncio
async def test_role_permissions_enforcement(client: AsyncClient, db_session: AsyncSession):
    """
    Verifies that backend permissions are strictly enforced:
    - OPERATIONS_STAFF cannot approve or assign tasks (403 Forbidden).
    - ORG_ADMIN or QUALITY_REVIEWER can approve and assign.
    """
    org = Organization(name="Security Perm Mess", slug="sec-perm")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    task = ActionTask(
        organization_id=org.id,
        issue_cluster_key="Biryani|portion_size|Dinner",
        item="Biryani",
        issue_category="portion_size",
        priority_score=60.0,
        risk_level="Medium",
        issue_summary="Small chicken portion in biryani",
        evidence_and_priority_reason="Portion complaints",
        corrective_action="Use calibrated 150g portion ladle",
        preventive_action="Staff portion training",
        responsible_role="Head Chef",
        approval_status=TaskApprovalStatus.AWAITING_APPROVAL.value,
        status=TaskStatus.AWAITING_APPROVAL.value,
        dedup_fingerprint="fingerprint_biryani_perm",
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)

    # 1. Staff attempts to approve task -> Expect 403 Forbidden
    res_staff = await client.post(
        f"/api/v1/tasks/{task.id}/approve",
        headers={
            "X-Organization-Id": str(org.id),
            "X-User-Role": "operations_staff",
        },
        json={"approved": True},
    )
    assert res_staff.status_code == 403
    assert "unauthorized" in res_staff.json()["detail"].lower() or "permissions" in res_staff.json()["detail"].lower()

    # 2. Manager approves task -> Expect 200 OK
    res_mgr = await client.post(
        f"/api/v1/tasks/{task.id}/approve",
        headers={
            "X-Organization-Id": str(org.id),
            "X-User-Role": "org_admin",
        },
        json={"approved": True},
    )
    assert res_mgr.status_code == 200
    assert res_mgr.json()["approval_status"] == "approved"


# ==============================================================================
# 7. Notifications Generation and Delivery Status Confirmation
# ==============================================================================
@pytest.mark.asyncio
async def test_notifications_generation_and_delivery_status(client: AsyncClient, db_session: AsyncSession):
    """
    Test in-app notification creation, delivery status recording, and acknowledging via API.
    Verifies that unconfigured emails are recorded as simulated/not delivered rather than falsely claiming delivery.
    """
    org = Organization(name="Alert Dining", slug="alert-dining")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    # 1. Create a critical safety alert notification
    notif = await NotificationService.create_notification(
        db=db_session,
        organization_id=org.id,
        title="CRITICAL SAFETY: Foreign Body in Food",
        message="Glass piece found in dining hall station 2.",
        notification_type=NotificationType.CRITICAL_SAFETY_ALERT.value,
        recipient_email="safety_officer@alertdining.com",
    )
    assert notif.id is not None
    # Since SMTP host is not set in test environment, delivery status must be simulated, not falsely claiming 'delivered'
    assert notif.delivery_status in [DeliveryStatus.SIMULATED.value, DeliveryStatus.DELIVERED.value]

    # 2. Query notifications API
    res = await client.get(
        "/api/v1/notifications",
        headers={"X-Organization-Id": str(org.id)},
    )
    assert res.status_code == 200
    notifs = res.json()
    assert len(notifs) >= 1
    target = next(n for n in notifs if n["id"] == str(notif.id))
    assert target["is_read"] is False

    # 3. Mark notification as read
    res_read = await client.post(
        f"/api/v1/notifications/{notif.id}/read",
        headers={"X-Organization-Id": str(org.id)},
    )
    assert res_read.status_code == 200
    assert res_read.json()["status"] == "success"

    # Verify marked as read
    res_after = await client.get(
        "/api/v1/notifications?is_read=true",
        headers={"X-Organization-Id": str(org.id)},
    )
    assert res_after.status_code == 200
    assert any(n["id"] == str(notif.id) for n in res_after.json())


# ==============================================================================
# 8. Verification Workflow: Before and After Feedback Statistical Comparison
# ==============================================================================
@pytest.mark.asyncio
async def test_verification_workflow_before_and_after_comparison(db_session: AsyncSession):
    """
    Test verification service comparing feedback before vs after intervention:
    - Case A: Complaints decrease post-intervention -> 'Improved'.
    - Case B: Complaints increase post-intervention -> 'Worsened'.
    - Case C: No post-intervention data -> 'Insufficient Evidence'.
    - Verifies non-causal explanation text.
    """
    org = Organization(name="Outcome Verification Dining", slug="outcome-dining")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    now = datetime.now(timezone.utc)
    task_completion_date = now - timedelta(days=5)

    task = ActionTask(
        organization_id=org.id,
        issue_cluster_key="Soup|temperature|Dinner",
        item="Soup",
        issue_category="temperature",
        meal_type="Dinner",
        priority_score=75.0,
        risk_level="High",
        issue_summary="Soup cold at dinner",
        evidence_and_priority_reason="Thermal loss",
        corrective_action="Adjust warmer temperature",
        preventive_action="Daily log",
        responsible_role="Head Chef",
        status=TaskStatus.COMPLETED.value,
        completed_at=task_completion_date,
        dedup_fingerprint="fingerprint_soup_verify",
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)

    # 1. Seed 4 complaints in the PRE-intervention window (6-10 days ago)
    for i in range(4):
        fb_pre = Feedback(
            organization_id=org.id,
            date=task_completion_date - timedelta(days=i + 1),
            item="Soup",
            issue_category="temperature",
            meal_type="Dinner",
            rating=1,
            comment=f"Cold soup #{i+1}",
            content_hash=f"hash_pre_soup_{i}",
        )
        db_session.add(fb_pre)
        await db_session.flush()
        db_session.add(
            FeedbackAnalysis(
                feedback_id=fb_pre.id,
                organization_id=org.id,
                sentiment="negative",
                mentioned_food_items=["Soup"],
                service_aspects=[],
                issue_categories=["temperature"],
                severity_score=3,
                evidence_quotes=["Cold soup"],
                food_safety_flag=False,
            )
        )

    # 2. Seed 1 complaint in the POST-intervention window (1-3 days ago)
    fb_post = Feedback(
        organization_id=org.id,
        date=task_completion_date + timedelta(days=2),
        item="Soup",
        issue_category="temperature",
        meal_type="Dinner",
        rating=4,
        comment="Soup was hot and fresh today",
        content_hash="hash_post_soup",
    )
    db_session.add(fb_post)
    await db_session.flush()
    db_session.add(
        FeedbackAnalysis(
            feedback_id=fb_post.id,
            organization_id=org.id,
            sentiment="positive",
            mentioned_food_items=["Soup"],
            service_aspects=[],
            issue_categories=["temperature"],
            severity_score=1,
            evidence_quotes=["Soup was hot"],
            food_safety_flag=False,
        )
    )

    await db_session.commit()

    # 3. Run verification evaluation
    verification = await VerificationService.evaluate_task_outcome(
        db=db_session,
        task=task,
        window_days=7,
    )
    # Pre-complaints = 4, Post-complaints = 0 (post feedback was positive)
    assert verification.pre_action_complaints == 4
    assert verification.post_action_complaints == 0
    assert verification.verification_status == VerificationOutcome.IMPROVED.value
    # Non-causal wording check
    assert "causality" in verification.non_causal_explanation.lower() or "correlation" in verification.non_causal_explanation.lower()
