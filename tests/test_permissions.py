"""Tests for Rule 2: Permission checking via can(user, perm)."""

import pytest
from app.core.permissions import can


def test_can_evaluates_row_permissions(test_rbac):
    """Verify can(user, perm) inspects database rows, not role name strings."""
    admin_user = test_rbac["admin_user"]
    staff_user = test_rbac["staff_user"]

    # Admin has org:manage and feedback:view
    assert can(admin_user, "org:manage") is True
    assert can(admin_user, "feedback:view") is True
    assert can(admin_user, "task:resolve") is False

    # Staff has task:resolve and feedback:view
    assert can(staff_user, "task:resolve") is True
    assert can(staff_user, "feedback:view") is True
    assert can(staff_user, "org:manage") is False


def test_can_denies_unassigned_permissions(test_rbac):
    """Verify non-existent or unassigned permissions return False."""
    staff_user = test_rbac["staff_user"]
    assert can(staff_user, "non_existent:action") is False
    assert can(staff_user, "billing:refund") is False


def test_inactive_user_cannot_perform_action(test_rbac):
    """Verify deactivated user loses all permissions even if rows exist."""
    staff_user = test_rbac["staff_user"]
    staff_user.is_active = False
    assert can(staff_user, "feedback:view") is False
    assert can(staff_user, "task:resolve") is False


def test_superuser_bypass(test_rbac):
    """Verify is_superuser flag grants full permissions."""
    admin_user = test_rbac["admin_user"]
    admin_user.is_superuser = True
    assert can(admin_user, "any:arbitrary:permission") is True
