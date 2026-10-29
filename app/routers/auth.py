"""Authentication routes and current_user dependency enforcing Rule 1 & Rule 2."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Form, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db, set_request_org_context
from app.core.security import (
    verify_session_token,
    generate_csrf_token,
    verify_csrf_token,
)
from app.models.auth import User, Role
from app.models.organization import Organization
from app.services.auth_service import authenticate_user, build_user_session, change_user_password
from app.services.signup_service import create_tenant_signup

router = APIRouter(tags=["Authentication"])
templates = Jinja2Templates(directory="app/templates")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """Resolve authenticated user and tenant context from signed session token.
    
    Never trusts client-provided org_id (Rule 1).
    Sets app.current_org for request-scoped isolation (Rule 7).
    """
    token = request.cookies.get("fiq_session")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
        
    payload = verify_session_token(token)
    if not payload or not payload.get("user_id") or not payload.get("org_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )

    # Rule 7: Set app.current_org for the request
    set_request_org_context(db, payload["org_id"])

    user = (
        db.query(User)
        .options(
            joinedload(User.role).joinedload(Role.permissions),
            joinedload(User.organization)
        )
        .filter(User.id == payload["user_id"])
        .first()
    )

    if not user or not getattr(user, "active", getattr(user, "is_active", True)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled"
        )

    # Enforce forced password change when must_change_pw is true
    if getattr(user, "must_change_pw", False):
        path = request.url.path
        if path not in ["/change-password", "/logout"] and not path.startswith("/static"):
            accept_header = request.headers.get("accept", "")
            if "text/html" in accept_header and request.method == "GET":
                raise HTTPException(
                    status_code=status.HTTP_303_SEE_OTHER,
                    headers={"Location": "/change-password"}
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Password change required"
            )

    # Attach verified session org_id
    user.active_org_id = payload["org_id"]
    return user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Soft current user resolver for landing pages and public views."""
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None


@router.get("/signup", response_class=HTMLResponse)
def show_signup_page(
    request: Request,
    error: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_user)
):
    """Render tenant organization onboarding & signup screen."""
    if user and not getattr(user, "must_change_pw", False):
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)

    client_id = request.client.host if request.client else "anon"
    csrf_token = generate_csrf_token(client_id)
    return templates.TemplateResponse(
        request=request,
        name="signup.html",
        context={
            "error": error,
            "csrf_token": csrf_token
        }
    )


@router.post("/signup")
def process_signup(
    request: Request,
    response: Response,
    org_name: str = Form(...),
    org_slug: Optional[str] = Form(None),
    template_type: str = Form("college_mess"),
    admin_name: str = Form(...),
    admin_email: str = Form(...),
    admin_password: str = Form(...),
    csrf_token: str = Form(...),
    db: Session = Depends(get_db)
):
    """Process tenant signup in one atomic transaction and issue session cookie."""
    client_id = request.client.host if request.client else "anon"
    if not verify_csrf_token(csrf_token, client_id):
        raise HTTPException(status_code=400, detail="Invalid CSRF token")

    try:
        org, admin_user = create_tenant_signup(
            db=db,
            org_name=org_name,
            admin_name=admin_name,
            admin_email=admin_email,
            admin_password=admin_password,
            template_key=template_type,
            org_slug=org_slug,
            must_change_pw=False
        )
    except ValueError as e:
        return templates.TemplateResponse(
            request=request,
            name="signup.html",
            context={
                "error": str(e),
                "csrf_token": generate_csrf_token(client_id)
            },
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # Issue signed session cookie
    session_token = build_user_session(admin_user)
    redirect_resp = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    redirect_resp.set_cookie(
        key="fiq_session",
        value=session_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return redirect_resp


@router.get("/login", response_class=HTMLResponse)
def show_login_page(
    request: Request,
    error: Optional[str] = None,
    user: Optional[User] = Depends(get_optional_user)
):
    """Render SaaS management portal login screen."""
    if user and not getattr(user, "must_change_pw", False):
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
        
    client_id = request.client.host if request.client else "anon"
    csrf_token = generate_csrf_token(client_id)
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={
            "error": error,
            "csrf_token": csrf_token
        }
    )


@router.post("/login")
def process_login(
    request: Request,
    response: Response,
    email: str = Form(...),
    password: str = Form(...),
    csrf_token: str = Form(...),
    db: Session = Depends(get_db)
):
    """Process user login and issue signed HTTP-only cookie."""
    client_id = request.client.host if request.client else "anon"
    if not verify_csrf_token(csrf_token, client_id):
        raise HTTPException(status_code=400, detail="Invalid CSRF token")

    user = authenticate_user(db, email.strip().lower(), password)
    if not user:
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={
                "error": "Invalid email or password. Please try again.",
                "csrf_token": generate_csrf_token(client_id)
            },
            status_code=status.HTTP_401_UNAUTHORIZED
        )

    session_token = build_user_session(user)
    
    # If user must change password, route directly to /change-password
    target_url = "/change-password" if getattr(user, "must_change_pw", False) else "/dashboard"
    redirect_resp = RedirectResponse(url=target_url, status_code=status.HTTP_303_SEE_OTHER)
    redirect_resp.set_cookie(
        key="fiq_session",
        value=session_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return redirect_resp


@router.get("/logout")
def process_logout():
    """Clear session cookie and redirect to login."""
    redirect_resp = RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    redirect_resp.delete_cookie(key="fiq_session")
    return redirect_resp


@router.get("/change-password", response_class=HTMLResponse)
def show_change_password_page(
    request: Request,
    error: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Render forced password change screen."""
    client_id = request.client.host if request.client else "anon"
    csrf_token = generate_csrf_token(client_id)
    return templates.TemplateResponse(
        request=request,
        name="change_password.html",
        context={
            "error": error,
            "csrf_token": csrf_token,
            "current_user": current_user
        }
    )


@router.post("/change-password")
def process_change_password(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    csrf_token: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate current password, set new password, and clear must_change_pw."""
    client_id = request.client.host if request.client else "anon"
    if not verify_csrf_token(csrf_token, client_id):
        raise HTTPException(status_code=400, detail="Invalid CSRF token")

    if new_password != confirm_password:
        return templates.TemplateResponse(
            request=request,
            name="change_password.html",
            context={
                "error": "New passwords do not match. Please verify.",
                "csrf_token": generate_csrf_token(client_id),
                "current_user": current_user
            },
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if len(new_password) < 8:
        return templates.TemplateResponse(
            request=request,
            name="change_password.html",
            context={
                "error": "New password must be at least 8 characters long.",
                "csrf_token": generate_csrf_token(client_id),
                "current_user": current_user
            },
            status_code=status.HTTP_400_BAD_REQUEST
        )

    try:
        success = change_user_password(db, current_user, current_password, new_password)
        if not success:
            return templates.TemplateResponse(
                request=request,
                name="change_password.html",
                context={
                    "error": "Current temporary password incorrect.",
                    "csrf_token": generate_csrf_token(client_id),
                    "current_user": current_user
                },
                status_code=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        return templates.TemplateResponse(
            request=request,
            name="change_password.html",
            context={
                "error": str(e),
                "csrf_token": generate_csrf_token(client_id),
                "current_user": current_user
            },
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # Re-issue updated session cookie without must_change_pw flag
    new_session_token = build_user_session(current_user)
    redirect_resp = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    redirect_resp.set_cookie(
        key="fiq_session",
        value=new_session_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return redirect_resp


@router.post("/switch-org")
def switch_active_org(
    target_org_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Switch active organization context for multi-tenant administrators."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only administrators can switch tenants")

    target_org = db.query(Organization).filter(Organization.id == target_org_id).first()
    if not target_org:
        raise HTTPException(status_code=404, detail="Target organization does not exist")

    # Update session token with new authoritative org_id
    current_user.org_id = target_org.id
    new_token = build_user_session(current_user)

    redirect_resp = RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)
    redirect_resp.set_cookie(
        key="fiq_session",
        value=new_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE
    )
    return redirect_resp
