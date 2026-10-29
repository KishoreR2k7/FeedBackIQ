"""Metrics and analytics calculations enforcing Rule 3.

RULE 3: Code counts, LLM thinks: all numbers (counts, trends, scores, SLA clocks)
are computed in SQL or Python. The LLM classifies, judges severity, and writes text.
"""

from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session

from app.core.scope import org_scoped_query
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.department import Department
from app.models.recurring import RecurringIssue


def get_dashboard_kpis(db: Session, org_id: int) -> Dict[str, Any]:
    """Compute all quantitative dashboard metrics deterministically in SQL/Python."""
    # 1. Feedback Totals and Average Rating
    fb_stats = (
        org_scoped_query(db, Feedback, org_id)
        .with_entities(
            func.count(Feedback.id).label("total_feedback"),
            func.avg(Feedback.rating).label("avg_rating"),
            func.count(case((Feedback.sentiment == "positive", 1))).label("positive_count"),
            func.count(case((Feedback.sentiment == "neutral", 1))).label("neutral_count"),
            func.count(case((Feedback.sentiment.in_(["negative", "critical"]), 1))).label("negative_count"),
        )
        .first()
    )

    total_fb = fb_stats.total_feedback or 0
    avg_rating = float(fb_stats.avg_rating or 0.0)
    pos_count = fb_stats.positive_count or 0
    neu_count = fb_stats.neutral_count or 0
    neg_count = fb_stats.negative_count or 0

    # Net Sentiment Score (NSS = % Positive - % Negative, range -1.0 to +1.0)
    if total_fb > 0:
        net_sentiment = round((pos_count - neg_count) / total_fb, 2)
    else:
        net_sentiment = 0.0

    # 2. Task Operational SLA Metrics
    task_stats = (
        org_scoped_query(db, Task, org_id)
        .with_entities(
            func.count(Task.id).label("total_tasks"),
            func.count(case((Task.status.in_(["pending", "in_progress"]), 1))).label("open_tasks"),
            func.count(case((Task.status.in_(["resolved", "verified"]), 1))).label("resolved_tasks"),
            func.count(case((and_(Task.status.in_(["resolved", "verified"]), Task.sla_breached == False), 1))).label("on_time_resolved"),
            func.count(case((Task.priority == "P1", 1))).label("p1_count"),
            func.count(case((Task.priority == "P2", 1))).label("p2_count"),
            func.count(case((Task.priority == "P3", 1))).label("p3_count"),
            func.count(case((Task.priority == "P4", 1))).label("p4_count"),
        )
        .first()
    )

    total_tasks = task_stats.total_tasks or 0
    open_tasks = task_stats.open_tasks or 0
    resolved_tasks = task_stats.resolved_tasks or 0
    on_time_resolved = task_stats.on_time_resolved or 0

    if resolved_tasks > 0:
        sla_compliance_pct = round((on_time_resolved / resolved_tasks) * 100.0, 1)
    else:
        sla_compliance_pct = 100.0

    # 3. Active Recurring Issues
    active_recurring = (
        org_scoped_query(db, RecurringIssue, org_id)
        .filter(RecurringIssue.status == "active")
        .count()
    )

    # 4. Category Distribution
    cat_rows = (
        org_scoped_query(db, Feedback, org_id)
        .filter(Feedback.category.isnot(None))
        .with_entities(Feedback.category, func.count(Feedback.id))
        .group_by(Feedback.category)
        .all()
    )
    category_counts = {row[0]: row[1] for row in cat_rows}

    # 5. Department Breakdown Metrics
    depts = org_scoped_query(db, Department, org_id).all()
    dept_metrics = []
    for d in depts:
        d_tasks = (
            org_scoped_query(db, Task, org_id)
            .filter(Task.department_id == d.id)
            .all()
        )
        d_total = len(d_tasks)
        d_open = sum(1 for t in d_tasks if t.status in ("pending", "in_progress"))
        d_resolved = [t for t in d_tasks if t.status in ("resolved", "verified")]
        d_on_time = sum(1 for t in d_resolved if not t.sla_breached)
        d_sla_pct = round((d_on_time / len(d_resolved)) * 100.0, 1) if d_resolved else 100.0
        
        dept_metrics.append({
            "id": d.id,
            "name": d.name,
            "code": d.code,
            "total_tasks": d_total,
            "open_tasks": d_open,
            "resolved_tasks": len(d_resolved),
            "sla_compliance_pct": d_sla_pct,
            "in_charge_name": d.in_charge_user.full_name if d.in_charge_user else "Unassigned"
        })

    # 6. Daily Feedback Volume (Past 7 Days for Chart.js)
    now = datetime.now(timezone.utc)
    daily_labels = []
    daily_counts = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        cnt = (
            org_scoped_query(db, Feedback, org_id)
            .filter(Feedback.created_at >= day_start, Feedback.created_at < day_end)
            .count()
        )
        daily_labels.append(day_start.strftime("%b %d"))
        daily_counts.append(cnt)

    return {
        "total_feedback": total_fb,
        "avg_rating": round(avg_rating, 2),
        "positive_count": pos_count,
        "neutral_count": neu_count,
        "negative_count": neg_count,
        "net_sentiment_score": net_sentiment,
        "total_tasks": total_tasks,
        "open_tasks": open_tasks,
        "resolved_tasks": resolved_tasks,
        "sla_compliance_pct": sla_compliance_pct,
        "p1_count": task_stats.p1_count or 0,
        "p2_count": task_stats.p2_count or 0,
        "p3_count": task_stats.p3_count or 0,
        "p4_count": task_stats.p4_count or 0,
        "active_recurring_count": active_recurring,
        "category_counts": category_counts,
        "dept_metrics": dept_metrics,
        "daily_labels": daily_labels,
        "daily_counts": daily_counts,
    }
