"""Feedback management router for internal organization staff (Rule 1 & Rule 2)."""

from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import require, FEEDBACK_VIEW, can
from app.core.templates import templates
from app.core.scope import org_scoped_query, scoped_get
from app.models.auth import User
from app.models.organization import Organization
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.department import Department
from app.models.agent_run import AgentRun
from app.routers.auth import get_current_user

router = APIRouter(prefix="/feedback", tags=["Feedback Management"])


@router.get("", response_class=HTMLResponse)
def list_feedback(
    request: Request,
    rating: Optional[int] = None,
    department_id: Optional[int] = None,
    sentiment: Optional[str] = None,
    urgency: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(require(FEEDBACK_VIEW)),
    db: Session = Depends(get_db)
):
    if not (can(current_user, FEEDBACK_VIEW) or can(current_user, "feedback:view")):
        raise HTTPException(status_code=403, detail="Permission denied: feedback.view required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    query = org_scoped_query(db, Feedback, org_id)

    if rating:
        query = query.filter(Feedback.rating == rating)
    if department_id:
        query = query.filter(Feedback.department_id == department_id)
    if sentiment:
        query = query.filter(Feedback.sentiment == sentiment)
    if urgency:
        query = query.filter(Feedback.urgency == urgency)
    if status_filter:
        query = query.filter(Feedback.status == status_filter)

    feedbacks = query.order_by(Feedback.id.desc()).limit(100).all()
    departments = org_scoped_query(db, Department, org_id).all()

    return templates.TemplateResponse(
        request=request,
        name="feedback_list.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "feedback",
            "feedbacks": feedbacks,
            "departments": departments,
            "filters": {
                "rating": rating,
                "department_id": department_id,
                "sentiment": sentiment,
                "urgency": urgency,
                "status": status_filter
            }
        }
    )


@router.get("/{feedback_id}", response_class=HTMLResponse)
def view_feedback_detail(
    feedback_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Detailed view showing AI classification breakdown, mapped tasks, and agent logs."""
    if not can(current_user, "feedback:view"):
        raise HTTPException(status_code=403, detail="Permission denied.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    feedback = scoped_get(db, Feedback, org_id, feedback_id)
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found in this organization.")

    # Associated tasks
    tasks = org_scoped_query(db, Task, org_id).filter(Task.feedback_id == feedback.id).all()

    # Agent Run execution audit log for this organization
    agent_logs = (
        org_scoped_query(db, AgentRun, org_id)
        .order_by(AgentRun.id.desc())
        .limit(5)
        .all()
    )

    return templates.TemplateResponse(
        request=request,
        name="feedback_detail.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "feedback",
            "feedback": feedback,
            "tasks": tasks,
            "agent_logs": agent_logs
        }
    )
