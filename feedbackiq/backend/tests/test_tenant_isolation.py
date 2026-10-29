import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.organization import Organization, OrgTemplateType
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository


@pytest.mark.asyncio
async def test_organization_creation_and_templates(client: AsyncClient):
    # 1. Fetch available templates
    res = await client.get("/api/v1/organizations/templates")
    assert res.status_code == 200
    templates = res.json()
    assert "college" in templates
    assert "restaurant" in templates
    assert "corporate_cafeteria" in templates
    assert "meal_slots" in templates["college"]

    # 2. Create College Tenant
    org_payload = {
        "name": "St. Andrews Campus Mess",
        "slug": "st-andrews-mess",
        "template_type": "college",
        "settings": {"hostel_blocks": ["A", "B", "C"]},
    }
    create_res = await client.post("/api/v1/organizations", json=org_payload)
    assert create_res.status_code == 201
    org_data = create_res.json()
    assert org_data["slug"] == "st-andrews-mess"
    assert org_data["template_type"] == "college"
    assert "meal_slots" in org_data["settings"]  # Defaults merged

    # 3. Prevent duplicate slug
    dup_res = await client.post("/api/v1/organizations", json=org_payload)
    assert dup_res.status_code == 409

    # 4. Create Restaurant Tenant
    rest_payload = {
        "name": "Downtown Bistro",
        "slug": "downtown-bistro",
        "template_type": "restaurant",
        "settings": {},
    }
    rest_res = await client.post("/api/v1/organizations", json=rest_payload)
    assert rest_res.status_code == 201
    assert rest_res.json()["slug"] == "downtown-bistro"

    # 5. List organizations
    list_res = await client.get("/api/v1/organizations")
    assert list_res.status_code == 200
    orgs = list_res.json()
    assert len(orgs) == 2


@pytest.mark.asyncio
async def test_tenant_data_isolation(db_session: AsyncSession):
    # Setup Tenant 1: Apex University
    org1 = Organization(
        id=uuid.uuid4(),
        name="Apex University",
        slug="apex-uni",
        template_type=OrgTemplateType.COLLEGE,
        settings={"tier": "enterprise"},
    )
    # Setup Tenant 2: Metro Tech Cafeteria
    org2 = Organization(
        id=uuid.uuid4(),
        name="Metro Tech Cafeteria",
        slug="metro-tech",
        template_type=OrgTemplateType.CORPORATE_CAFETERIA,
        settings={"tier": "standard"},
    )
    db_session.add_all([org1, org2])
    await db_session.flush()

    # Create Users for Tenant 1
    u1 = User(
        id=uuid.uuid4(),
        email="chef1@apex.edu",
        hashed_password="hash",
        full_name="Chef One",
        role=UserRole.OPERATIONS_STAFF,
        organization_id=org1.id,
    )
    # Create Users for Tenant 2
    u2 = User(
        id=uuid.uuid4(),
        email="chef2@metrotech.com",
        hashed_password="hash",
        full_name="Chef Two",
        role=UserRole.OPERATIONS_STAFF,
        organization_id=org2.id,
    )
    db_session.add_all([u1, u2])
    await db_session.commit()

    # Query with tenant isolation via BaseRepository
    repo = BaseRepository(User, db_session)
    
    org1_users = await repo.list(organization_id=org1.id)
    assert len(org1_users) == 1
    assert org1_users[0].email == "chef1@apex.edu"
    assert org1_users[0].organization_id == org1.id

    org2_users = await repo.list(organization_id=org2.id)
    assert len(org2_users) == 1
    assert org2_users[0].email == "chef2@metrotech.com"
    assert org2_users[0].organization_id == org2.id

    # Cross-tenant query assertion: Org 1 users list must NEVER contain Org 2 user
    assert u2.id not in [u.id for u in org1_users]
