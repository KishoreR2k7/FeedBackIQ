"""Tests for Rule 1: Multi-tenant org-scoping enforcement."""

import pytest
from app.core.scope import (
    org_scoped_query,
    scoped_get,
    scoped_create,
    scoped_filter,
    scoped_delete,
    ScopingError,
)
from app.models.department import Department
from app.models.feedback import Feedback


def test_org_scoped_query_isolates_tenants(test_db, test_org, test_org_second):
    """Verify org_scoped_query never returns records from another organization."""
    # Create departments in org 1
    d1 = Department(org_id=test_org.id, name="Kitchen Org 1", code="kitchen_1")
    # Create departments in org 2
    d2 = Department(org_id=test_org_second.id, name="Kitchen Org 2", code="kitchen_2")
    test_db.add_all([d1, d2])
    test_db.flush()

    # Query org 1
    results_org1 = org_scoped_query(test_db, Department, test_org.id).all()
    assert len(results_org1) == 1
    assert results_org1[0].name == "Kitchen Org 1"
    assert results_org1[0].org_id == test_org.id

    # Query org 2
    results_org2 = org_scoped_query(test_db, Department, test_org_second.id).all()
    assert len(results_org2) == 1
    assert results_org2[0].name == "Kitchen Org 2"
    assert results_org2[0].org_id == test_org_second.id


def test_scoped_get_prevents_cross_tenant_access(test_db, test_org, test_org_second):
    """Verify scoped_get returns None when requesting an ID belonging to a different org."""
    d1 = Department(org_id=test_org.id, name="Bakery Org 1", code="bakery_1")
    test_db.add(d1)
    test_db.flush()

    # Accessing with correct org_id
    found = scoped_get(test_db, Department, test_org.id, d1.id)
    assert found is not None
    assert found.id == d1.id

    # Attempting to access with another org_id must return None
    blocked = scoped_get(test_db, Department, test_org_second.id, d1.id)
    assert blocked is None


def test_scoped_create_disallows_client_org_spoofing(test_db, test_org, test_org_second):
    """Verify scoped_create overrides any client-supplied org_id with the authoritative org_id."""
    # Malicious client tries to inject test_org_second.id into kwargs
    client_payload = {
        "org_id": test_org_second.id,
        "name": "Security Grill",
        "code": "security_grill"
    }
    spoofed = scoped_create(
        test_db,
        Department,
        org_id=test_org.id,
        data=client_payload
    )
    test_db.flush()
    assert spoofed.org_id == test_org.id
    assert spoofed.org_id != test_org_second.id


def test_invalid_org_id_raises_scoping_error(test_db):
    """Verify invalid org_id values raise ScopingError."""
    with pytest.raises(ScopingError):
        org_scoped_query(test_db, Department, -1)

    with pytest.raises(ScopingError):
        scoped_create(test_db, Department, org_id=0, name="Invalid", code="inv")
