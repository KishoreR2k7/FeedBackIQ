import uuid
from typing import Optional, List
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin, GUID


class Location(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Physical or logical facility within an organization (e.g., Dining Hall A, Counter 2, Table 12).
    """
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    feedbacks: Mapped[List["Feedback"]] = relationship(
        "Feedback",
        back_populates="location",
        cascade="all, delete-orphan",
    )
