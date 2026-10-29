"""Organization model for multi-tenant SaaS."""

from typing import Optional, Dict, Any, List
from sqlalchemy import BigInteger, String, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, TimestampMixin


class Organization(Base, IdMixin, TimestampMixin):
    """Tenant organization (college mess, restaurant chain, cafeteria, hospital)."""
    __tablename__ = "organizations"

    # Self-reference for uniform org_id query helper support (Rule 1)
    org_id: Mapped[int] = mapped_column(
        BigInteger,
        nullable=True,
        index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    org_type: Mapped[str] = mapped_column(String(50), nullable=False)
    settings: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "org_type IN ('college_mess', 'restaurant_chain', 'cafeteria', 'hospital', 'other')",
            name="check_org_type_valid"
        ),
        Index("ix_organizations_org_id_created_at", "org_id", "created_at"),
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="organization",
        cascade="all, delete-orphan",
        primaryjoin="Organization.id == User.org_id"
    )
    departments: Mapped[List["Department"]] = relationship(
        "Department",
        back_populates="organization",
        cascade="all, delete-orphan",
        primaryjoin="Organization.id == Department.org_id"
    )
    locations: Mapped[List["Location"]] = relationship(
        "Location",
        back_populates="organization",
        cascade="all, delete-orphan",
        primaryjoin="Organization.id == Location.org_id"
    )
