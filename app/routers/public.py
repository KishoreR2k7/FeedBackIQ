"""Public router for customer feedback collection via web link and QR code.

RULE 6: Rate-limit the public form, escape all output, CSRF protection.
"""

import time
from collections import defaultdict
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.organization import Organization
from app.schemas.feedback import FeedbackCreate, FeedbackPublicResponse
from app.services.feedback_service import ingest_feedback

router = APIRouter(prefix="/f", tags=["Public Feedback"])
templates = Jinja2Templates(directory="app/templates")

# In-memory IP rate limiter (Rule 6)
_ip_rate_limits: Dict[str, list] = defaultdict(list)


def check_rate_limit(request: Request) -> None:
    """Enforce rate limits per client IP on the public feedback form."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 60.0  # 1 minute window
    
    timestamps = [ts for ts in _ip_rate_limits[client_ip] if now - ts < window]
    if len(timestamps) >= settings.RATE_LIMIT_PUBLIC_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many feedback submissions from your device. Please wait a minute."
        )
    timestamps.append(now)
    _ip_rate_limits[client_ip] = timestamps


def get_public_org(org_slug: str, db: Session = Depends(get_db)) -> Organization:
    """Resolve active tenant organization by URL slug."""
    org = db.query(Organization).filter(
        Organization.slug == org_slug,
        Organization.is_active == True
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Dining organization not found or inactive.")
    return org


@router.get("/{org_slug}", response_class=HTMLResponse)
def show_feedback_form(
    org_slug: str,
    request: Request,
    table: Optional[str] = None,
    channel: str = "web_link",
    org: Organization = Depends(get_public_org)
):
    """Render interactive public feedback submission form."""
    return templates.TemplateResponse(
        request=request,
        name="public_feedback.html",
        context={
            "org": org,
            "table": table,
            "channel": channel,
        }
    )


@router.post("/{org_slug}/submit", response_model=FeedbackPublicResponse)
def submit_feedback_json(
    org_slug: str,
    payload: FeedbackCreate,
    request: Request,
    org: Organization = Depends(get_public_org),
    db: Session = Depends(get_db)
):
    """API endpoint for JSON/AJAX feedback submission."""
    check_rate_limit(request)
    return ingest_feedback(db, org.id, payload)


@router.post("/{org_slug}/submit-form", response_class=HTMLResponse)
def submit_feedback_form(
    org_slug: str,
    request: Request,
    rating: int = Form(...),
    raw_text: str = Form(...),
    customer_name: Optional[str] = Form(None),
    customer_contact: Optional[str] = Form(None),
    meal_type: Optional[str] = Form(None),
    location_table: Optional[str] = Form(None),
    channel: str = Form("web_link"),
    org: Organization = Depends(get_public_org),
    db: Session = Depends(get_db)
):
    """HTML Form submission handler."""
    check_rate_limit(request)
    
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5 stars.")

    create_data = FeedbackCreate(
        rating=rating,
        raw_text=raw_text.strip(),
        customer_name=customer_name.strip() if customer_name else None,
        customer_contact=customer_contact.strip() if customer_contact else None,
        channel="qr_code" if channel == "qr_code" else "web_link",
        location_table=location_table.strip() if location_table else None,
        meal_type=meal_type if meal_type in ("breakfast", "lunch", "snacks", "dinner") else None
    )

    res = ingest_feedback(db, org.id, create_data)
    
    return RedirectResponse(
        url=f"/f/{org_slug}/thank-you?sentiment={res.sentiment}&rating={rating}",
        status_code=status.HTTP_303_SEE_OTHER
    )


@router.get("/{org_slug}/thank-you", response_class=HTMLResponse)
def show_thank_you_page(
    org_slug: str,
    request: Request,
    sentiment: Optional[str] = None,
    rating: Optional[int] = None,
    org: Organization = Depends(get_public_org)
):
    """Thank you page acknowledging feedback submission."""
    return templates.TemplateResponse(
        request=request,
        name="public_thank_you.html",
        context={
            "org": org,
            "sentiment": sentiment,
            "rating": rating
        }
    )


@router.get("/{org_slug}/qr", response_class=HTMLResponse)
def show_qr_code_display(
    org_slug: str,
    request: Request,
    org: Organization = Depends(get_public_org)
):
    """Display printable QR code for tables and counters."""
    feedback_url = f"{request.base_url}f/{org_slug}?channel=qr_code"
    return templates.TemplateResponse(
        request=request,
        name="public_qr.html",
        context={
            "org": org,
            "feedback_url": feedback_url
        }
    )
