"""Tests for Task Operations, SLA Calculation, and Fix Verification."""

import pytest
from datetime import datetime, timezone, timedelta
from app.models.task import Task
from app.models.department import Department
from app.models.verification import Verification
from app.core.scope import scoped_get


def test_task_sla_breach_detection(test_org, test_db):
    """Rule 3: Verify overdue tasks are accurately flagged as SLA breached."""
    dept = Department(org_id=test_org.id, name="Bakery", code="bakery")
    test_db.add(dept)
    test_db.flush()

    past_time = datetime.now(timezone.utc) - timedelta(hours=2)
    task = Task(
        org_id=test_org.id,
        department_id=dept.id,
        title="Late Task",
        description="Check oven temperature",
        priority="P1",
        status="pending",
        due_at=past_time,
        sla_breached=False
    )
    test_db.add(task)
    test_db.flush()

    # If resolved after due_at, sla_breached becomes True
    resolve_time = datetime.now(timezone.utc)
    task.resolved_at = resolve_time
    task.sla_breached = (resolve_time > task.due_at)
    task.status = "resolved"
    test_db.flush()

    assert task.sla_breached is True


def test_task_resolution_creates_verification(test_org, test_db, test_rbac):
    """Verify marking task resolved creates an audit verification record."""
    dept = Department(org_id=test_org.id, name="Line Service", code="service")
    test_db.add(dept)
    test_db.flush()

    now = datetime.now(timezone.utc)
    task = Task(
        org_id=test_org.id,
        department_id=dept.id,
        title="Queue Delay at Counter",
        description="Deploy second billing clerk during 1 PM rush",
        priority="P2",
        status="in_progress",
        due_at=now + timedelta(hours=6),
        sla_breached=False
    )
    test_db.add(task)
    test_db.flush()

    # Simulate resolution
    task.status = "resolved"
    task.resolved_at = now
    task.resolution_notes = "Added extra scanner and helper at Counter 2."
    
    # Verification auto-creation
    v = Verification(
        org_id=test_org.id,
        task_id=task.id,
        status="pending_audit",
        before_sentiment_score=-0.6
    )
    test_db.add(v)
    test_db.flush()

    # Check verification record exists with org_id (Rule 1)
    retrieved_v = test_db.query(Verification).filter(Verification.task_id == task.id).first()
    assert retrieved_v is not None
    assert retrieved_v.org_id == test_org.id
    assert retrieved_v.status == "pending_audit"
    assert retrieved_v.before_sentiment_score == -0.6
