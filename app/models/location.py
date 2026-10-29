"""Location model for multi-location organizations enforcing Rule 1."""

from typing import Optional, List
from sqlalchemy import BigInteger, String, Boolean, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class Location(Base, IdMixin, OrgMixin, TimestampMixin):
    """Physical branch, mess hall, dining room, or cafeteria outlet."""
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_locations_org_code"),
        Index("ix_locations_org_id_created_at", "org_id", "created_at"),
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="locations",
        primaryjoin="Location.org_id == Organization.id"
    )
