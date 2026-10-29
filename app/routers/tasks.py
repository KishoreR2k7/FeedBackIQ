"""Task management router and Kanban board enforcing Rule 1, Rule 2 & Rule 3."""

from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, Form, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.permissions import can, TASK_VIEW_ALL, TASK_VIEW_DEPT, TASK_VIEW_OWN, TASK_ASSIGN, TASK_COMPLETE
from app.core.templates import templates
from app.core.scope import org_scoped_query, scoped_get
from app.models.auth import User
from app.models.organization import Organization
from app.models.task import Task
from app.models.department import Department
from app.models.verification import Verification
from app.routers.auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["Operational Tasks"])


@router.get("", response_class=HTMLResponse)
def show_task_board(
    request: Request,
    department_id: Optional[int] = None,
    priority: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Render operational Kanban board with live SLA clocks (Rule 1 & Rule 3)."""
    has_view_perm = (
        can(current_user, TASK_VIEW_ALL) or
        can(current_user, TASK_VIEW_DEPT) or
        can(current_user, TASK_VIEW_OWN) or
        can(current_user, "task:view")
    )
    if not has_view_perm:
        raise HTTPException(status_code=403, detail="Permission denied: task.view permission required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    query = (
        org_scoped_query(db, Task, org_id)
        .options(
            joinedload(Task.department),
            joinedload(Task.assigned_to),
            joinedload(Task.feedback)
        )
    )

    # Scoped task views based on granular permission
    if not can(current_user, TASK_VIEW_ALL) and not current_user.is_superuser:
        if can(current_user, TASK_VIEW_DEPT) and current_user.department_id:
            query = query.filter(Task.department_id == current_user.department_id)
        elif can(current_user, TASK_VIEW_OWN):
            query = query.filter(Task.assigned_to_user_id == current_user.id)

    if department_id:
        query = query.filter(Task.department_id == department_id)
    if priority:
        query = query.filter(Task.priority == priority)

    all_tasks = query.order_by(Task.due_at.asc()).all()

    # Rule 3: Compute SLA clocks deterministically in Python
    now = datetime.now(timezone.utc)
    for t in all_tasks:
        if t.status in ("resolved", "verified"):
            t.sla_status = "completed"
            t.hours_remaining = 0
            t.is_overdue = t.sla_breached
        else:
            diff_hours = (t.due_at - now).total_seconds() / 3600.0
            t.hours_remaining = round(diff_hours, 1)
            t.is_overdue = diff_hours < 0

    # Categorize into Kanban Columns
    pending_tasks = [t for t in all_tasks if t.status == "pending"]
    in_progress_tasks = [t for t in all_tasks if t.status == "in_progress"]
    resolved_tasks = [t for t in all_tasks if t.status == "resolved"]
    verified_tasks = [t for t in all_tasks if t.status == "verified"]

    # Organization users for assignment dropdown
    staff_users = org_scoped_query(db, User, org_id).filter(User.is_active == True).all()
    departments = org_scoped_query(db, Department, org_id).all()

    return templates.TemplateResponse(
        request=request,
        name="tasks_board.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "tasks",
            "pending_tasks": pending_tasks,
            "in_progress_tasks": in_progress_tasks,
            "resolved_tasks": resolved_tasks,
            "verified_tasks": verified_tasks,
            "staff_users": staff_users,
            "departments": departments,
            "filter_dept": department_id,
            "filter_priority": priority,
            "can_assign": can(current_user, TASK_ASSIGN) or can(current_user, "task:assign"),
            "can_resolve": can(current_user, TASK_COMPLETE) or can(current_user, "task:resolve"),
            "can_verify": can(current_user, "verification:execute"),
        }
    )


@router.post("/{task_id}/assign")
def assign_task(
    task_id: int,
    assigned_user_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign task to employee and transition to in_progress (Rule 2)."""
    if not (can(current_user, TASK_ASSIGN) or can(current_user, "task:assign")):
        raise HTTPException(status_code=403, detail="Permission denied: task.assign required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    task = scoped_get(db, Task, org_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in this organization.")

    task.assigned_to_user_id = assigned_user_id
    if task.status == "pending":
        task.status = "in_progress"
    db.commit()

    return RedirectResponse(url="/tasks", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/{task_id}/resolve")
def resolve_task(
    task_id: int,
    resolution_notes: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark task resolved, evaluate SLA breach, and create verification audit (Rule 3)."""
    if not can(current_user, "task:resolve"):
        raise HTTPException(status_code=403, detail="Permission denied: task:resolve required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    task = scoped_get(db, Task, org_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in this organization.")

    now = datetime.now(timezone.utc)
    task.status = "resolved"
    task.resolved_at = now
    task.resolution_notes = resolution_notes.strip()

    # Rule 3: Deterministic SLA check
    if now > task.due_at:
        task.sla_breached = True
    else:
        task.sla_breached = False

    # Auto-create quality verification record
    existing_v = org_scoped_query(db, Verification, org_id).filter(Verification.task_id == task.id).first()
    if not existing_v:
        before_score = task.feedback.sentiment_score if task.feedback else -0.5
        v = Verification(
            org_id=org_id,
            task_id=task.id,
            status="pending_audit",
            before_sentiment_score=before_score,
            recurrence_detected=False
        )
        db.add(v)

    db.commit()
    return RedirectResponse(url="/tasks", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/{task_id}/verify")
def verify_task(
    task_id: int,
    audit_status: str = Form(...),
    audit_notes: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Audit verification execution by Quality Auditor (Rule 2)."""
    if not can(current_user, "verification:execute"):
        raise HTTPException(status_code=403, detail="Permission denied: verification:execute required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    task = scoped_get(db, Task, org_id, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    v = org_scoped_query(db, Verification, org_id).filter(Verification.task_id == task.id).first()
    if not v:
        v = Verification(org_id=org_id, task_id=task.id)
        db.add(v)

    v.status = audit_status if audit_status in ("passed", "failed", "reopened") else "passed"
    v.verified_by_user_id = current_user.id
    v.audit_notes = audit_notes.strip()
    v.recurrence_detected = (audit_status in ("failed", "reopened"))

    if v.status == "passed":
        task.status = "verified"
    elif v.status in ("failed", "reopened"):
        task.status = "in_progress"

    db.commit()
    return RedirectResponse(url="/tasks", status_code=status.HTTP_303_SEE_OTHER)
