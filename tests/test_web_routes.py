"""Tests for FastAPI HTTP routes, CSRF security, and auth."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.services.auth_service import build_user_session


@pytest.fixture
def client(test_db):
    """Provide FastAPI TestClient overriding get_db with test_db fixture."""
    def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health_check(client):
    """Verify health endpoint returns 200 and application info."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_public_feedback_form_renders(client, test_org):
    """Verify public feedback web form renders successfully with org branding."""
    resp = client.get(f"/f/{test_org.slug}")
    assert resp.status_code == 200
    assert test_org.name in resp.text
    assert "Rate your meal" in resp.text


def test_public_qr_standee_renders(client, test_org):
    """Verify public QR standee card renders printable view."""
    resp = client.get(f"/f/{test_org.slug}/qr")
    assert resp.status_code == 200
    assert "Scan & Rate Your Meal" in resp.text
    assert test_org.name in resp.text


def test_login_page_renders_with_csrf(client):
    """Rule 6: Verify login page renders with CSRF token protection."""
    resp = client.get("/login")
    assert resp.status_code == 200
    assert 'name="csrf_token"' in resp.text
    assert "FeedbackIQ Portal" in resp.text


def test_unauthenticated_dashboard_redirects_or_denies(client):
    """Verify unauthenticated access to /dashboard is blocked."""
    resp = client.get("/dashboard", follow_redirects=False)
    assert resp.status_code == 401


def test_authenticated_dashboard_access(client, test_org, test_rbac):
    """Verify authenticated session with valid cookies accesses tenant dashboard."""
    admin_user = test_rbac["admin_user"]
    session_token = build_user_session(admin_user)

    client.cookies.set("fiq_session", session_token)
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "Operations Overview" in resp.text
    assert test_org.name in resp.text
