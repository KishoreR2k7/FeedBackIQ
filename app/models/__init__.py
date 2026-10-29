"""Models package registering all PostgreSQL domain tables."""

from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin
from app.models.organization import Organization
from app.models.auth import Role, Permission, RolePermission, User
from app.models.department import Department
from app.models.location import Location
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.recurring import RecurringIssue
from app.models.verification import Verification
from app.models.agent_run import AgentRun
from app.models.audit import AuditLog

__all__ = [
    "Base",
    "IdMixin",
    "OrgMixin",
    "TimestampMixin",
    "Organization",
    "Role",
    "Permission",
    "RolePermission",
    "User",
    "Department",
    "Location",
    "Feedback",
    "Task",
    "RecurringIssue",
    "Verification",
    "AgentRun",
    "AuditLog",
]
