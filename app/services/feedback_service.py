"""Feedback processing service executing the AI Multi-Agent pipeline."""

from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.scope import org_scoped_query, scoped_create
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.department import Department
from app.models.recurring import RecurringIssue
from app.schemas.feedback import FeedbackCreate, FeedbackPublicResponse
from app.agents.pipeline import feedback_graph
from app.agents.task_generator import calculate_sla_deadline


def ingest_feedback(
    db: Session,
    org_id: int,
    data: FeedbackCreate
) -> FeedbackPublicResponse:
    """Ingest public customer feedback and orchestrate multi-agent analysis."""
    # 1. Fetch departments for this tenant
    departments = org_scoped_query(db, Department, org_id).all()
    dept_by_code = {d.code: d for d in departments}

    # 2. Query recent complaints to evaluate recurring patterns (Rule 3)
    recent_feedbacks = (
        org_scoped_query(db, Feedback, org_id)
        .order_by(Feedback.id.desc())
        .limit(15)
        .all()
    )
    recent_texts = [f.raw_text for f in recent_feedbacks if f.rating <= 3]
    freq_count = len(recent_texts) + 1

    # 3. Execute LangGraph Pipeline
    pipeline_input = {
        "org_id": org_id,
        "raw_text": data.raw_text,
        "rating": data.rating,
        "meal_type": data.meal_type,
        "location_table": data.location_table,
        "department_id": None,
        "department_name": None,
        "recent_category_complaints": recent_texts,
        "frequency_count": freq_count,
        "classification": None,
        "task_output": None,
        "recurring_output": None,
        "db": db
    }

    pipeline_result = feedback_graph.invoke(pipeline_input)
    classification = pipeline_result.get("classification") or {}
    task_out = pipeline_result.get("task_output")
    recurring_out = pipeline_result.get("recurring_output")

    # 4. Map to target department
    dept_code = classification.get("department_code", "food_quality")
    matched_dept = dept_by_code.get(dept_code) or (departments[0] if departments else None)
    dept_id = matched_dept.id if matched_dept else None

    # 5. Persist Feedback record (Rule 1 & Rule 5)
    feedback_record = scoped_create(
        db,
        Feedback,
        org_id=org_id,
        rating=data.rating,
        raw_text=data.raw_text,
        customer_name=data.customer_name,
        customer_contact=data.customer_contact,
        channel=data.channel,
        location_table=data.location_table,
        meal_type=data.meal_type,
        category=classification.get("category", "general"),
        department_id=dept_id,
        sentiment=classification.get("sentiment", "neutral"),
        sentiment_score=classification.get("sentiment_score", 0.0),
        urgency=classification.get("urgency", "P3"),
        status="actioned" if task_out else ("resolved" if data.rating >= 4 else "new"),
        ai_analysis=classification
    )
    db.flush()

    # 6. If Agent 2 produced a task, persist it with code-computed SLA (Rule 3)
    if task_out and matched_dept:
        priority = task_out.get("priority", "P3")
        due_at = calculate_sla_deadline(matched_dept, priority)
        
        scoped_create(
            db,
            Task,
            org_id=org_id,
            feedback_id=feedback_record.id,
            department_id=matched_dept.id,
            assigned_to_user_id=matched_dept.in_charge_user_id,
            title=task_out.get("title", f"Action for feedback #{feedback_record.id}"),
            description=task_out.get("description", data.raw_text),
            priority=priority,
            status="pending",
            due_at=due_at,
            sla_breached=False
        )

    # 7. If Agent 3 predicted a recurring pattern, persist / update RecurringIssue
    if recurring_out and recurring_out.get("recurring_pattern_identified"):
        fingerprint = recurring_out.get("fingerprint", f"pattern_{dept_code}")
        existing_issue = (
            org_scoped_query(db, RecurringIssue, org_id)
            .filter(RecurringIssue.issue_fingerprint == fingerprint)
            .first()
        )
        if existing_issue:
            existing_issue.frequency_count += 1
            existing_issue.last_occurred_at = datetime.now(timezone.utc)
            current_ids = list(existing_issue.evidence_feedback_ids or [])
            if feedback_record.id not in current_ids:
                current_ids.append(feedback_record.id)
                existing_issue.evidence_feedback_ids = current_ids
        else:
            scoped_create(
                db,
                RecurringIssue,
                org_id=org_id,
                department_id=dept_id,
                issue_fingerprint=fingerprint,
                title=recurring_out.get("title", "Recurring Quality Anomaly"),
                frequency_count=freq_count,
                predicted_root_cause=recurring_out.get("predicted_root_cause", "Operational variance"),
                recommended_action=recurring_out.get("recommended_preventive_action", "Conduct SOP audit"),
                status="active",
                evidence_feedback_ids=[feedback_record.id],
                last_occurred_at=datetime.now(timezone.utc)
            )

    db.commit()

    return FeedbackPublicResponse(
        id=feedback_record.id,
        status="received",
        message="Thank you! Your feedback has been received and analyzed by our management team.",
        sentiment=classification.get("sentiment"),
        urgency=classification.get("urgency")
    )
