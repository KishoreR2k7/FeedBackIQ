import enum
from typing import Any, Dict, List
from sqlalchemy import String, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin


class OrgTemplateType(str, enum.Enum):
    COLLEGE = "college"
    RESTAURANT = "restaurant"
    CORPORATE_CAFETERIA = "corporate_cafeteria"
    CUSTOM = "custom"


class Organization(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Tenant entity. All tenant-owned records (feedback, issues, actions, users)
    are strictly scoped to an Organization.
    """
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    template_type: Mapped[OrgTemplateType] = mapped_column(
        SQLEnum(OrgTemplateType),
        default=OrgTemplateType.COLLEGE,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Configurable tenant settings: categories, meal slots, SLA hours, safety keywords
    settings: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
