"""Dashboard router rendering real-time operational analytics enforcing Rule 1, 2 & 3."""

from typing import List
from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import require, DASHBOARD_VIEW
from app.core.templates import templates
from app.core.scope import org_scoped_query
from app.models.auth import User
from app.models.organization import Organization
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.recurring import RecurringIssue
from app.services.metrics_service import get_dashboard_kpis

router = APIRouter(prefix="/dashboard", tags=["Operations Dashboard"])


@router.get("", response_class=HTMLResponse)
def show_dashboard(
    request: Request,
    current_user: User = Depends(require(DASHBOARD_VIEW)),
    db: Session = Depends(get_db)
):
    """Render executive operations command center with code-computed KPI metrics."""
    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    
    # Authoritative tenant lookup
    current_org = db.query(Organization).filter(Organization.id == org_id).first()
    all_orgs = db.query(Organization).all() if current_user.is_superuser else []

    # Deterministic metrics computed strictly in code/SQL (Rule 3)
    kpis = get_dashboard_kpis(db, org_id)

    # Recent feedback stream for quick triage
    recent_feedbacks = (
        org_scoped_query(db, Feedback, org_id)
        .order_by(Feedback.id.desc())
        .limit(6)
        .all()
    )

    # Critical P1/P2 operational tasks
    critical_tasks = (
        org_scoped_query(db, Task, org_id)
        .filter(Task.priority.in_(["P1", "P2"]), Task.status.in_(["pending", "in_progress"]))
        .order_by(Task.due_at.asc())
        .limit(5)
        .all()
    )

    # Active Recurring Issue Warnings
    recurring_alerts = (
        org_scoped_query(db, RecurringIssue, org_id)
        .filter(RecurringIssue.status == "active")
        .order_by(RecurringIssue.frequency_count.desc())
        .limit(4)
        .all()
    )

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "all_orgs": all_orgs,
            "active_tab": "dashboard",
            "kpis": kpis,
            "recent_feedbacks": recent_feedbacks,
            "critical_tasks": critical_tasks,
            "recurring_alerts": recurring_alerts,
        }
    )

