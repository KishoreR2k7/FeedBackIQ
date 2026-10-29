"""Department management router enforcing Rule 1 & Rule 3."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.permissions import require, DEPARTMENTS_MANAGE
from app.core.templates import templates
from app.core.scope import org_scoped_query
from app.models.auth import User
from app.models.organization import Organization
from app.models.department import Department
from app.services.metrics_service import get_dashboard_kpis

router = APIRouter(prefix="/departments", tags=["Department Management"])


@router.get("", response_class=HTMLResponse)
def list_departments(
    request: Request,
    current_user: User = Depends(require(DEPARTMENTS_MANAGE)),
    db: Session = Depends(get_db)
):
    """View organizational departments, SLA standards, and resolution rates (Rule 1 & Rule 3)."""
    org_id = getattr(current_user, "active_org_id", current_user.org_id)
    current_org = db.query(Organization).filter(Organization.id == org_id).first()

    departments = (
        org_scoped_query(db, Department, org_id)
        .options(joinedload(Department.in_charge_user))
        .all()
    )

    kpis = get_dashboard_kpis(db, org_id)
    dept_metrics_by_id = {d["id"]: d for d in kpis.get("dept_metrics", [])}

    return templates.TemplateResponse(
        request=request,
        name="departments_view.html",
        context={
            "current_user": current_user,
            "current_org": current_org,
            "active_tab": "departments",
            "departments": departments,
            "dept_metrics": dept_metrics_by_id,
        }
    )
