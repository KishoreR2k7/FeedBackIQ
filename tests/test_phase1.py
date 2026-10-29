"""Phase 1 Foundation Acceptance Tests.

ACCEPTANCE CRITERIA:
1. docker compose up -d, then alembic upgrade head, works on a fresh machine.
2. Signup creates, in one transaction:
   - the org
   - departments from chosen template with routing descriptions
   - four default roles (Admin=all, Manager, Department In-charge, Employee)
   - the first admin
   - one default location
3. Login, logout, signed-cookie session, forced password change when must_change_pw is true.
4. can(user, perm) and require(perm) dependency:
   - nav shows only permitted links
   - a missing permission gives 403
5. A pytest proves Org A can never read Org B rows.
6. A request-scoped DB session that runs SET LOCAL app.current_org = <org id>.
"""

import pytest
from starlette.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import hash_password, verify_password, create_session_token
from app.core.permissions import (
    can,
    require,
    DASHBOARD_VIEW,
    FEEDBACK_VIEW,
    TASK_VIEW_ALL,
    TASK_VIEW_DEPT,
    TASK_VIEW_OWN,
    TASK_ASSIGN,
    TASK_COMPLETE,
    USERS_MANAGE,
    ROLES_MANAGE,
    DEPARTMENTS_MANAGE,
    LOCATIONS_MANAGE,
    SETTINGS_EDIT,
    EXPORT,
    KB_MANAGE,
    CHAT_USE,
    PERMISSION_CATALOG,
)
from app.core.scope import org_scoped_query, scoped_get
from app.core.database import set_local_org, set_request_org_context
from app.models.organization import Organization
from app.models.auth import User, Role, Permission, RolePermission
from app.models.department import Department
from app.models.location import Location
from app.services.signup_service import create_tenant_signup, TEMPLATES
from app.services.auth_service import authenticate_user, change_user_password, build_user_session


def test_signup_creates_complete_tenant_in_one_transaction(test_db: Session):
    """Verify signup creates org, templated departments with descriptions, 4 roles, admin, and location."""
    org, admin = create_tenant_signup(
        db=test_db,
        org_name="Horizon Tech Mess",
        admin_name="Dean Harrison",
        admin_email="dean@horizon.edu",
        admin_password="MasterSecurePassword2026!",
        template_key="college_mess",
        org_slug="horizon-mess"
    )

    # 1. Organization verified
    assert org.id is not None
    assert org.slug == "horizon-mess"
    assert org.org_type == "college_mess"

    # 2. Departments from college_mess template with descriptions verified
    depts = org_scoped_query(test_db, Department, org.id).all()
    dept_names = {d.name for d in depts}
    assert dept_names == {"Kitchen", "Housekeeping", "Service", "Quality & Safety", "Management"}
    for d in depts:
        assert d.description is not None
        assert len(d.description) > 20  # AI routing descriptions present

    # 3. Four default roles verified
    roles = org_scoped_query(test_db, Role, org.id).all()
    role_map = {r.name: r for r in roles}
    assert set(role_map.keys()) == {"Admin", "Manager", "Department In-charge", "Employee"}

    # Admin has all permissions
    admin_perms = {p.code for p in role_map["Admin"].permissions}
    assert len(admin_perms) == len(PERMISSION_CATALOG)
    assert DASHBOARD_VIEW in admin_perms
    assert USERS_MANAGE in admin_perms

    # Employee has limited operational permissions
    emp_perms = {p.code for p in role_map["Employee"].permissions}
    assert FEEDBACK_VIEW in emp_perms
    assert TASK_VIEW_OWN in emp_perms
    assert DASHBOARD_VIEW not in emp_perms
    assert USERS_MANAGE not in emp_perms

    # 4. First Admin User verified
    assert admin.id is not None
    assert admin.name == "Dean Harrison"
    assert admin.email == "dean@horizon.edu"
    assert admin.role_id == role_map["Admin"].id
    assert verify_password("MasterSecurePassword2026!", admin.pw_hash)
    assert admin.active is True
    assert admin.must_change_pw is False

    # 5. One default location verified
    locations = org_scoped_query(test_db, Location, org.id).all()
    assert len(locations) == 1
    assert locations[0].name == "Central Dining Hall"
    assert locations[0].is_active is True


def test_signup_restaurant_template_departments(test_db: Session):
    """Verify restaurant template creates correct restaurant departments and descriptions."""
    org, admin = create_tenant_signup(
        db=test_db,
        org_name="Urban Fork Restaurant",
        admin_name="Chef Marco",
        admin_email="marco@urbanfork.com",
        admin_password="MasterSecurePassword2026!",
        template_key="restaurant",
        org_slug="urban-fork"
    )

    depts = org_scoped_query(test_db, Department, org.id).all()
    dept_names = {d.name for d in depts}
    assert dept_names == {"Kitchen", "Front of House", "Delivery & Packaging", "Hygiene & Safety", "Management"}


def test_login_and_signed_cookie_session(test_db: Session):
    """Verify authenticating user and building signed session token."""
    org, admin = create_tenant_signup(
        db=test_db,
        org_name="Session Test Mess",
        admin_name="Session Admin",
        admin_email="session_admin@test.edu",
        admin_password="Password123!",
        template_key="college_mess"
    )

    # Valid authentication
    auth_user = authenticate_user(test_db, "session_admin@test.edu", "Password123!")
    assert auth_user is not None
    assert auth_user.id == admin.id

    # Invalid password returns None
    assert authenticate_user(test_db, "session_admin@test.edu", "WrongPassword!") is None

    # Signed session token generation
    token = build_user_session(auth_user)
    assert token is not None
    assert len(token) > 20


def test_forced_password_change_when_must_change_pw_is_true(test_db: Session):
    """Verify must_change_pw flag enforcement and password change."""
    org, user = create_tenant_signup(
        db=test_db,
        org_name="Force PW Org",
        admin_name="Temp User",
        admin_email="temp_user@test.edu",
        admin_password="InitialTempPass123!",
        must_change_pw=True
    )
    assert user.must_change_pw is True

    # Change password
    success = change_user_password(test_db, user, "InitialTempPass123!", "BrandNewSecurePass123!")
    assert success is True
    assert user.must_change_pw is False

    # Old password fails, new password succeeds
    assert authenticate_user(test_db, "temp_user@test.edu", "InitialTempPass123!") is None
    new_auth = authenticate_user(test_db, "temp_user@test.edu", "BrandNewSecurePass123!")
    assert new_auth is not None


def test_can_and_require_permissions(test_db: Session):
    """Verify can(user, perm) returns True for granted and False for denied."""
    org, admin = create_tenant_signup(
        db=test_db,
        org_name="RBAC Org",
        admin_name="RBAC Admin",
        admin_email="rbac_admin@test.edu",
        admin_password="Password123!"
    )
    # Admin has all permissions
    assert can(admin, DASHBOARD_VIEW) is True
    assert can(admin, FEEDBACK_VIEW) is True
    assert can(admin, USERS_MANAGE) is True
    assert can(admin, DEPARTMENTS_MANAGE) is True

    # Create an employee with Employee role
    emp_role = test_db.query(Role).filter(Role.org_id == org.id, Role.name == "Employee").first()
    employee = User(
        org_id=org.id,
        name="John Employee",
        email="john_emp@test.edu",
        pw_hash=hash_password("EmpPass123!"),
        role_id=emp_role.id,
        active=True
    )
    test_db.add(employee)
    test_db.flush()

    # Refresh relationship
    employee.role = emp_role

    # Employee can view feedback & own tasks
    assert can(employee, FEEDBACK_VIEW) is True
    assert can(employee, TASK_VIEW_OWN) is True

    # Employee CANNOT view dashboard or manage departments
    assert can(employee, DASHBOARD_VIEW) is False
    assert can(employee, DEPARTMENTS_MANAGE) is False
    assert can(employee, USERS_MANAGE) is False


def test_org_a_can_never_read_org_b_rows(test_db: Session):
    """PROVE Org A can never read Org B rows via org_scoped_query and scoped_get."""
    org_a, admin_a = create_tenant_signup(
        db=test_db,
        org_name="Organization Alpha",
        admin_name="Alpha Admin",
        admin_email="alpha@test.edu",
        admin_password="Password123!"
    )
    org_b, admin_b = create_tenant_signup(
        db=test_db,
        org_name="Organization Beta",
        admin_name="Beta Admin",
        admin_email="beta@test.edu",
        admin_password="Password123!"
    )

    # Add private departments to both orgs
    dept_a = Department(org_id=org_a.id, name="Alpha Special Kitchen", code="ALPHA-KITCHEN")
    dept_b = Department(org_id=org_b.id, name="Beta VIP Lounge", code="BETA-VIP")
    test_db.add_all([dept_a, dept_b])
    test_db.flush()

    # Query scoped to Org A
    results_a = org_scoped_query(test_db, Department, org_a.id).all()
    ids_a = {d.id for d in results_a}
    assert dept_a.id in ids_a
    assert dept_b.id not in ids_a  # Org B row completely invisible to Org A

    # Query scoped to Org B
    results_b = org_scoped_query(test_db, Department, org_b.id).all()
    ids_b = {d.id for d in results_b}
    assert dept_b.id in ids_b
    assert dept_a.id not in ids_b  # Org A row completely invisible to Org B

    # scoped_get directly requesting other org's row returns None
    cross_access = scoped_get(test_db, Department, org_a.id, dept_b.id)
    assert cross_access is None


def test_request_scoped_db_session_sets_app_current_org(test_db: Session):
    """Verify request-scoped session variable app.current_org is set in PostgreSQL."""
    set_request_org_context(test_db, 101)
    val = test_db.execute(text("SELECT current_setting('app.current_org', true)")).scalar()
    assert val == "101"

    # Test local org inside transaction
    set_local_org(test_db, 202)
    val2 = test_db.execute(text("SELECT current_setting('app.current_org', true)")).scalar()
    assert val2 == "202"


def test_missing_permission_gives_403_and_nav_shows_only_permitted_links(test_db: Session):
    """Verify missing permission returns 403 Forbidden and nav hides forbidden links."""
    org, admin = create_tenant_signup(
        db=test_db,
        org_name="Nav Test Org",
        admin_name="Nav Admin",
        admin_email="nav_admin@test.edu",
        admin_password="Password123!"
    )
    emp_role = test_db.query(Role).filter(Role.org_id == org.id, Role.name == "Employee").first()
    employee = User(
        org_id=org.id,
        name="Staff Worker",
        email="worker@test.edu",
        pw_hash=hash_password("Pass123!"),
        role_id=emp_role.id,
        active=True
    )
    test_db.add(employee)
    test_db.flush()

    from app.core.database import get_db
    app.dependency_overrides[get_db] = lambda: test_db

    client = TestClient(app, cookies={"fiq_session": build_user_session(admin)})

    # Admin visits /dashboard -> 200 OK, see all nav tabs
    resp_admin = client.get("/dashboard")
    assert resp_admin.status_code == 200
    assert "id=\"nav-dashboard\"" in resp_admin.text
    assert "id=\"nav-feedback\"" in resp_admin.text
    assert "id=\"nav-departments\"" in resp_admin.text

    # Admin visits /departments -> 200 OK
    resp_dept = client.get("/departments")
    assert resp_dept.status_code == 200

    # Switch to Employee session
    emp_client = TestClient(app, cookies={"fiq_session": build_user_session(employee)})

    # Missing permission gives 403 Forbidden!
    resp_forbidden_dept = emp_client.get("/departments")
    assert resp_forbidden_dept.status_code == 403
    assert "Permission denied: missing required permission 'departments.manage'" in resp_forbidden_dept.json()["detail"]

    resp_forbidden_dash = emp_client.get("/dashboard")
    assert resp_forbidden_dash.status_code == 403
    assert "Permission denied: missing required permission 'dashboard.view'" in resp_forbidden_dash.json()["detail"]

    # Permitted link (/feedback) succeeds with 200 OK
    resp_emp_feedback = emp_client.get("/feedback")
    assert resp_emp_feedback.status_code == 200

    # Nav bar hides forbidden links for Employee!
    assert "id=\"nav-dashboard\"" not in resp_emp_feedback.text
    assert "id=\"nav-departments\"" not in resp_emp_feedback.text
    assert "id=\"nav-feedback\"" in resp_emp_feedback.text
    assert "id=\"nav-tasks\"" in resp_emp_feedback.text

    app.dependency_overrides.clear()

