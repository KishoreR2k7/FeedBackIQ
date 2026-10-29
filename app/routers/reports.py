"""Executive Reports router synthesizing code-computed facts into AI narratives (Rule 3 & 4)."""

from typing import Optional
from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import can, EXPORT, DASHBOARD_VIEW
from app.core.templates import templates
from app.core.scope import org_scoped_query
from app.models.auth import User
from app.models.organization import Organization
from app.services.metrics_service import get_dashboard_kpis
from app.agents.report_generator import generate_executive_report
from app.routers.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Executive Reports"])

# In-memory storage for generated reports in this session
_generated_reports = []


@router.get("", response_class=HTMLResponse)
def show_reports_center(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View executive reports and metrics overview (Rule 2)."""
    if not (can(current_user, EXPORT) or can(current_user, DASHBOARD_VIEW) or can(current_user, "report:view")):
        raise HTTPException(status_code=403, detail="Permission denied: export or dashboard.view required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    # Rule 3: Compute all quantitative metrics in SQL
    kpis = get_dashboard_kpis(db, org_id)

    # Filter generated reports for this org
    org_reports = [r for r in _generated_reports if r.get("org_id") == org_id]

    return templates.TemplateResponse(
        request=request,
        name="reports_view.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "reports",
            "kpis": kpis,
            "reports": org_reports,
            "latest_report": org_reports[0] if org_reports else None,
            "can_generate": can(current_user, "report:generate"),
        }
    )


@router.post("/generate", response_class=HTMLResponse)
def generate_new_report(
    request: Request,
    timeframe: str = Form("Past 7 Days"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate fresh executive synthesis report via Agent 5 (Rule 3 & 4)."""
    if not can(current_user, "report:generate"):
        raise HTTPException(status_code=403, detail="Permission denied: report:generate required.")

    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    # Rule 3: Code counts
    kpis = get_dashboard_kpis(db, org_id)

    # Rule 4: LLM thinks
    synthesis = generate_executive_report(
        org_id=org_id,
        org_name=current_org.name,
        timeframe=timeframe,
        metrics=kpis,
        db=db
    )

    report_record = {
        "org_id": org_id,
        "timeframe": timeframe,
        "title": synthesis.title,
        "executive_summary": synthesis.executive_summary,
        "highlights": synthesis.operational_highlights,
        "recommendations": synthesis.preventive_recommendations,
        "kpis": kpis
    }
    _generated_reports.insert(0, report_record)

    org_reports = [r for r in _generated_reports if r.get("org_id") == org_id]

    return templates.TemplateResponse(
        request=request,
        name="reports_view.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "reports",
            "kpis": kpis,
            "reports": org_reports,
            "latest_report": report_record,
            "can_generate": True,
            "success_msg": "Executive report generated successfully by Agent 5!"
        }
    )
