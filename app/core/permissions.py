"""Role and permission checking enforcing Rule 2.

RULE 2: Permissions are checked with can(user, perm), never by role name.
Roles and permissions are rows in PostgreSQL.
"""

from typing import Any, Optional, List, Tuple
from fastapi import HTTPException, status, Depends


# Permission catalog constants (Phase 1 Requirement 3)
DASHBOARD_VIEW = "dashboard.view"
FEEDBACK_VIEW = "feedback.view"
TASK_VIEW_ALL = "task.view_all"
TASK_VIEW_DEPT = "task.view_dept"
TASK_VIEW_OWN = "task.view_own"
TASK_ASSIGN = "task.assign"
TASK_COMPLETE = "task.complete"
USERS_MANAGE = "users.manage"
ROLES_MANAGE = "roles.manage"
DEPARTMENTS_MANAGE = "departments.manage"
LOCATIONS_MANAGE = "locations.manage"
SETTINGS_EDIT = "settings.edit"
EXPORT = "export"
KB_MANAGE = "kb.manage"
CHAT_USE = "chat.use"


class Permissions:
    """Namespace for permission constants."""
    DASHBOARD_VIEW = DASHBOARD_VIEW
    FEEDBACK_VIEW = FEEDBACK_VIEW
    TASK_VIEW_ALL = TASK_VIEW_ALL
    TASK_VIEW_DEPT = TASK_VIEW_DEPT
    TASK_VIEW_OWN = TASK_VIEW_OWN
    TASK_ASSIGN = TASK_ASSIGN
    TASK_COMPLETE = TASK_COMPLETE
    USERS_MANAGE = USERS_MANAGE
    ROLES_MANAGE = ROLES_MANAGE
    DEPARTMENTS_MANAGE = DEPARTMENTS_MANAGE
    LOCATIONS_MANAGE = LOCATIONS_MANAGE
    SETTINGS_EDIT = SETTINGS_EDIT
    EXPORT = EXPORT
    KB_MANAGE = KB_MANAGE
    CHAT_USE = CHAT_USE


PERMISSION_CATALOG: List[Tuple[str, str]] = [
    (DASHBOARD_VIEW, "View dashboard overview, analytics and KPIs"),
    (FEEDBACK_VIEW, "View feedback stream, details and analysis"),
    (TASK_VIEW_ALL, "View all tasks across all departments"),
    (TASK_VIEW_DEPT, "View tasks within assigned department"),
    (TASK_VIEW_OWN, "View tasks assigned directly to the user"),
    (TASK_ASSIGN, "Assign tasks to department members"),
    (TASK_COMPLETE, "Resolve, complete, and verify operational tasks"),
    (USERS_MANAGE, "Create and manage organization user accounts"),
    (ROLES_MANAGE, "Configure roles and assign permissions"),
    (DEPARTMENTS_MANAGE, "Manage organization departments and SLAs"),
    (LOCATIONS_MANAGE, "Manage branches, messes and physical locations"),
    (SETTINGS_EDIT, "Update organization settings and operational parameters"),
    (EXPORT, "Export operational reports, analytics, and feedback data"),
    (KB_MANAGE, "Manage knowledge base, operational SOPs, and guidelines"),
    (CHAT_USE, "Access autonomous operations AI assistant and interactive chat"),
]


def can(user: Any, perm: str) -> bool:
    """Check if the user possesses the specific permission.
    
    Never checks role names. Resolves permissions from PostgreSQL rows.
    Supports exact match and namespace wildcards (e.g., 'task.*', 'task:*').
    """
    if not user:
        return False
        
    # Superuser bypass (if flag present)
    if getattr(user, "is_superuser", False):
        return True

    # User active check (supports both active and is_active)
    if not getattr(user, "active", True) or not getattr(user, "is_active", True):
        return False

    # Collect all permission codes assigned to this user through their role or directly
    user_perms = set()
    
    # 1. From user's role relation
    role = getattr(user, "role", None)
    if role and hasattr(role, "permissions"):
        for p in role.permissions:
            code = getattr(p, "code", None) or getattr(p, "permission_code", None)
            if code:
                user_perms.add(code)
                
    # 2. From direct permissions if any
    direct_perms = getattr(user, "permissions", None)
    if direct_perms and isinstance(direct_perms, (list, set)):
        for p in direct_perms:
            if isinstance(p, str):
                user_perms.add(p)
            elif hasattr(p, "code"):
                user_perms.add(p.code)

    # 3. Exact match or delimiter interchange match (. vs :)
    if "*" in user_perms or perm in user_perms:
        return True
    if perm.replace(":", ".") in user_perms or perm.replace(".", ":") in user_perms:
        return True
        
    # 4. Namespace wildcard match (e.g. task.* or task:* matches task.assign or task:assign)
    for delim in (".", ":"):
        if delim in perm:
            prefix = perm.split(delim)[0]
            if f"{prefix}.*" in user_perms or f"{prefix}:*" in user_perms or f"{prefix}.all" in user_perms:
                return True

    return False


def require_permission(perm: str):
    """FastAPI dependency factory enforcing can(user, perm)."""
    # Imported lazily to avoid circular imports
    from app.routers.auth import get_current_user
    
    def dependency(user: Any = Depends(get_current_user)) -> Any:
        if not can(user, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: missing required permission '{perm}'"
            )
        return user
        
    return dependency


# Alias required by specification: require(perm)
require = require_permission
