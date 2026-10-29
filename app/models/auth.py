"""Authentication, RBAC and User models enforcing Rule 1 & Rule 2."""

from typing import Optional, List
from sqlalchemy import BigInteger, String, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class Role(Base, IdMixin, OrgMixin, TimestampMixin):
    """Customizable roles per organization (Admin, Dept In-Charge, Staff, Auditor)."""
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_roles_org_name"),
        Index("ix_roles_org_id_created_at", "org_id", "created_at"),
    )

    # Relationships
    permissions: Mapped[List["Permission"]] = relationship(
        "Permission",
        secondary="role_permissions",
        back_populates="roles"
    )
    users: Mapped[List["User"]] = relationship("User", back_populates="role")


class Permission(Base, IdMixin, OrgMixin, TimestampMixin):
    """Granular permission catalog per organization or global system."""
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_permissions_org_code"),
        Index("ix_permissions_org_id_created_at", "org_id", "created_at"),
    )

    # Relationships
    roles: Mapped[List["Role"]] = relationship(
        "Role",
        secondary="role_permissions",
        back_populates="permissions"
    )


class RolePermission(Base, IdMixin, OrgMixin, TimestampMixin):
    """Mapping table linking roles to permissions with org_id."""
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    permission_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
        Index("ix_role_permissions_org_id_created_at", "org_id", "created_at"),
    )


class User(Base, IdMixin, OrgMixin, TimestampMixin):
    """User accounts (Administrators, Department In-Charges, Staff)."""
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    pw_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    role_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    manager_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_pw: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        Index("ix_users_org_id_created_at", "org_id", "created_at"),
    )

    def __init__(self, **kwargs):
        name_val = kwargs.get("name") or kwargs.get("full_name") or ""
        pw_val = kwargs.get("pw_hash") or kwargs.get("hashed_password") or ""
        active_val = kwargs.get("active") if "active" in kwargs else kwargs.get("is_active", True)

        kwargs["name"] = name_val
        kwargs["full_name"] = name_val
        kwargs["pw_hash"] = pw_val
        kwargs["hashed_password"] = pw_val
        kwargs["active"] = active_val
        if "is_active" in kwargs:
            kwargs.pop("is_active")
        super().__init__(**kwargs)

    @property
    def is_active(self) -> bool:
        return self.active

    @is_active.setter
    def is_active(self, value: bool):
        self.active = value

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="users",
        primaryjoin="User.org_id == Organization.id"
    )
    role: Mapped[Optional["Role"]] = relationship("Role", back_populates="users")
    department: Mapped[Optional["Department"]] = relationship(
        "Department", foreign_keys=[department_id], post_update=True
    )
    manager: Mapped[Optional["User"]] = relationship(
        "User", remote_side="User.id", foreign_keys=[manager_id]
    )
