"""Pytest configuration and test database fixtures (Rule 8).

RULE 8: Write pytest tests for every phase against a separate test database.
Keep functions small.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.security import hash_password
from app.models.organization import Organization
from app.models.auth import Role, Permission, RolePermission, User
from app.models.department import Department

# Test database engine
test_engine = create_engine(
    settings.TEST_DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

TestSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    expire_on_commit=False
)


@pytest.fixture(scope="function")
def test_db() -> Session:
    """Provide a clean isolated test session rolled back after every test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def test_org(test_db: Session) -> Organization:
    """Fixture creating an isolated test organization."""
    org = Organization(
        name="Test Campus Dining Mess",
        slug="test-mess",
        org_type="college_mess",
        settings={"tagline": "Quality dining for students"}
    )
    test_db.add(org)
    test_db.flush()
    org.org_id = org.id
    test_db.flush()
    return org


@pytest.fixture(scope="function")
def test_org_second(test_db: Session) -> Organization:
    """Fixture creating a second organization to test strict isolation."""
    org = Organization(
        name="Second Isolated Restaurant",
        slug="second-restaurant",
        org_type="restaurant_chain",
        settings={"tagline": "Separate tenant"}
    )
    test_db.add(org)
    test_db.flush()
    org.org_id = org.id
    test_db.flush()
    return org


@pytest.fixture(scope="function")
def test_rbac(test_db: Session, test_org: Organization):
    """Fixture creating roles, permissions, and links for the test organization."""
    # Permissions
    p_view = Permission(org_id=test_org.id, code="feedback:view", description="View feedback")
    p_task = Permission(org_id=test_org.id, code="task:resolve", description="Resolve tasks")
    p_admin = Permission(org_id=test_org.id, code="org:manage", description="Manage org")
    p_dash = Permission(org_id=test_org.id, code="dashboard.view", description="View dashboard")
    test_db.add_all([p_view, p_task, p_admin, p_dash])
    test_db.flush()

    # Roles
    role_admin = Role(org_id=test_org.id, name="TestAdmin", description="Admin")
    role_staff = Role(org_id=test_org.id, name="TestStaff", description="Staff")
    test_db.add_all([role_admin, role_staff])
    test_db.flush()

    # Role Permissions
    rp1 = RolePermission(org_id=test_org.id, role_id=role_admin.id, permission_id=p_admin.id)
    rp2 = RolePermission(org_id=test_org.id, role_id=role_admin.id, permission_id=p_view.id)
    rp_dash = RolePermission(org_id=test_org.id, role_id=role_admin.id, permission_id=p_dash.id)
    rp3 = RolePermission(org_id=test_org.id, role_id=role_staff.id, permission_id=p_view.id)
    rp4 = RolePermission(org_id=test_org.id, role_id=role_staff.id, permission_id=p_task.id)
    test_db.add_all([rp1, rp2, rp_dash, rp3, rp4])
    test_db.flush()

    # Users
    u_admin = User(
        org_id=test_org.id,
        role_id=role_admin.id,
        email="test_admin@campus.edu",
        hashed_password=hash_password("Pass123!"),
        full_name="Admin User",
        is_active=True,
        is_superuser=False
    )
    u_staff = User(
        org_id=test_org.id,
        role_id=role_staff.id,
        email="test_staff@campus.edu",
        hashed_password=hash_password("Pass123!"),
        full_name="Staff User",
        is_active=True,
        is_superuser=False
    )
    test_db.add_all([u_admin, u_staff])
    test_db.flush()

    return {
        "admin_user": u_admin,
        "staff_user": u_staff,
        "perms": {"view": p_view, "task": p_task, "admin": p_admin}
    }
