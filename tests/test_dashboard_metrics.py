"""Tests for Rule 3: Deterministic SQL & Python analytics metrics."""

import pytest
from datetime import datetime, timezone, timedelta
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.department import Department
from app.services.metrics_service import get_dashboard_kpis


def test_kpi_calculations_are_exact(test_org, test_db):
    """Rule 3: Verify all numbers, ratings, and sentiment scores are exact SQL math."""
    now = datetime.now(timezone.utc)
    dept = Department(org_id=test_org.id, name="Beverages", code="service")
    test_db.add(dept)
    test_db.flush()

    # Add 3 feedbacks: rating 5 (positive), rating 1 (negative), rating 3 (neutral)
    fb1 = Feedback(
        org_id=test_org.id,
        rating=5,
        raw_text="Amazing fresh juice!",
        sentiment="positive",
        sentiment_score=0.9,
        category="service",
        status="resolved"
    )
    fb2 = Feedback(
        org_id=test_org.id,
        rating=1,
        raw_text="Juice was completely stale and warm.",
        sentiment="negative",
        sentiment_score=-0.8,
        category="service",
        status="actioned"
    )
    fb3 = Feedback(
        org_id=test_org.id,
        rating=3,
        raw_text="Average service speed.",
        sentiment="neutral",
        sentiment_score=0.0,
        category="service",
        status="new"
    )
    test_db.add_all([fb1, fb2, fb3])

    # Add 2 tasks: 1 resolved on time, 1 resolved late (sla breached)
    t1 = Task(
        org_id=test_org.id,
        department_id=dept.id,
        title="Restock ice machine",
        description="Check chiller",
        priority="P2",
        status="resolved",
        due_at=now + timedelta(hours=2),
        resolved_at=now,
        sla_breached=False
    )
    t2 = Task(
        org_id=test_org.id,
        department_id=dept.id,
        title="Clean juice dispensers",
        description="Sanitize nozzles",
        priority="P1",
        status="resolved",
        due_at=now - timedelta(hours=1),
        resolved_at=now,
        sla_breached=True
    )
    test_db.add_all([t1, t2])
    test_db.flush()

    kpis = get_dashboard_kpis(test_db, test_org.id)

    # Total feedback = 3
    assert kpis["total_feedback"] == 3
    # Average rating = (5 + 1 + 3) / 3 = 3.0
    assert abs(kpis["avg_rating"] - 3.0) < 0.01
    assert kpis["positive_count"] == 1
    assert kpis["negative_count"] == 1
    assert kpis["neutral_count"] == 1

    # Net Sentiment = (1 positive - 1 negative) / 3 = 0.0
    assert abs(kpis["net_sentiment_score"] - 0.0) < 0.01

    # Total resolved tasks = 2, on time = 1 -> SLA compliance = 50.0%
    assert kpis["resolved_tasks"] == 2
    assert abs(kpis["sla_compliance_pct"] - 50.0) < 0.1
