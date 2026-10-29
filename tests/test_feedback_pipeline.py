"""Tests for Phase 2: Public Feedback Ingestion & Multi-Agent Pipeline."""

import pytest
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.department import Department
from app.schemas.feedback import FeedbackCreate
from app.services.feedback_service import ingest_feedback
from app.agents.classifier import classify_feedback
from app.agents.task_generator import should_generate_task, calculate_sla_deadline
from app.agents.recurring_predictor import predict_recurring_issue
from app.agents.fix_verifier import verify_task_resolution
from app.schemas.agent_schemas import ClassificationOutput


def test_classifier_agent_identifies_category_and_urgency(test_org, test_db):
    """Verify Classifier Agent assigns category, sentiment, and P-level priority."""
    res = classify_feedback(
        org_id=test_org.id,
        raw_text="Found a small insect in the soup bowl. Completely unacceptable hygiene!",
        rating=1,
        meal_type="dinner",
        location_table="Table 5",
        db=test_db
    )
    assert res.category in ("hygiene", "food_quality")
    assert res.urgency in ("P1", "P2")
    assert res.sentiment in ("critical", "negative")


def test_task_generator_triggers_on_negative_feedback(test_org, test_db):
    """Verify should_generate_task deterministically flags tasks on poor ratings/sentiment."""
    dummy_neg = ClassificationOutput(
        category="food_quality",
        department_code="food_quality",
        sentiment="negative",
        sentiment_score=-0.7,
        urgency="P2",
        summary="Cold food complaint",
        keywords=["cold", "dal"]
    )
    assert should_generate_task(rating=2, classification=dummy_neg) is True

    dummy_pos = ClassificationOutput(
        category="food_quality",
        department_code="food_quality",
        sentiment="positive",
        sentiment_score=0.9,
        urgency="P4",
        summary="Delicious meal",
        keywords=["great", "delicious"]
    )
    assert should_generate_task(rating=5, classification=dummy_pos) is False


def test_sla_calculation_is_code_computed(test_org, test_db):
    """Rule 3: Verify SLA due dates are calculated in code based on department hours."""
    dept = Department(
        org_id=test_org.id,
        name="Kitchen",
        code="food_quality",
        sla_hours_p1=2,
        sla_hours_p2=6
    )
    test_db.add(dept)
    test_db.flush()

    due_p1 = calculate_sla_deadline(dept, "P1")
    due_p2 = calculate_sla_deadline(dept, "P2")
    
    # Difference between P2 and P1 due times should equal exactly 4 hours (6h - 2h)
    diff_hours = (due_p2 - due_p1).total_seconds() / 3600.0
    assert abs(diff_hours - 4.0) < 0.1


def test_full_pipeline_ingests_and_creates_tasks(test_org, test_db):
    """Verify end-to-end ingestion creates Feedback and Task records with org_id."""
    # Ensure a department exists for routing
    dept = Department(
        org_id=test_org.id,
        name="Food Quality",
        code="food_quality",
        sla_hours_p1=2,
        sla_hours_p2=4,
        sla_hours_p3=12,
        sla_hours_p4=24
    )
    test_db.add(dept)
    test_db.flush()

    create_data = FeedbackCreate(
        rating=1,
        raw_text="The biryani was cold and the chicken was undercooked. Terrible quality.",
        customer_name="Test Student",
        customer_contact="student@test.edu",
        channel="qr_code",
        location_table="Table 4",
        meal_type="lunch"
    )

    response = ingest_feedback(test_db, test_org.id, create_data)
    assert response.status == "received"
    assert response.id is not None

    # Verify Feedback persisted in test_db with org_id (Rule 1)
    fb = test_db.query(Feedback).filter(Feedback.id == response.id).first()
    assert fb is not None
    assert fb.org_id == test_org.id
    assert fb.rating == 1
    assert fb.category is not None

    # Verify Task was automatically created for negative feedback (Agent 2)
    task = test_db.query(Task).filter(Task.feedback_id == fb.id).first()
    assert task is not None
    assert task.org_id == test_org.id
    assert task.status == "pending"
    assert task.priority in ("P1", "P2", "P3", "P4")
    assert task.due_at is not None
