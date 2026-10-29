"""Recurring issue intelligence router enforcing Rule 1 & Rule 2."""

from typing import Optional
from fastapi import APIRouter, Depends, Request, Form, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import can, DASHBOARD_VIEW, FEEDBACK_VIEW
from app.core.templates import templates
from app.core.scope import org_scoped_query, scoped_get
from app.models.auth import User
from app.models.organization import Organization
from app.models.recurring import RecurringIssue
from app.routers.auth import get_current_user

router = APIRouter(prefix="/recurring", tags=["Recurring Issue Intelligence"])


@router.get("", response_class=HTMLResponse)
def list_recurring_issues(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View predicted recurring dining issues, root causes, and SOP actions."""
    if not (can(current_user, DASHBOARD_VIEW) or can(current_user, FEEDBACK_VIEW) or can(current_user, "recurring:view")):
        raise HTTPException(status_code=403, detail="Permission denied: dashboard.view or feedback.view required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    issues = (
        org_scoped_query(db, RecurringIssue, org_id)
        .order_by(RecurringIssue.frequency_count.desc())
        .all()
    )

    return templates.TemplateResponse(
        request=request,
        name="recurring_list.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "recurring",
            "issues": issues,
            "can_manage": can(current_user, "recurring:manage"),
        }
    )


@router.post("/{issue_id}/status")
def update_recurring_status(
    issue_id: int,
    new_status: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update status of recurring issue (active -> mitigated / monitoring)."""
    if not can(current_user, "recurring:manage"):
        raise HTTPException(status_code=403, detail="Permission denied: recurring:manage required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    issue = scoped_get(db, RecurringIssue, org_id, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Recurring issue not found.")

    if new_status in ("active", "mitigated", "monitoring"):
        issue.status = new_status
        db.commit()

    return RedirectResponse(url="/recurring", status_code=status.HTTP_303_SEE_OTHER)
