"""Base models and mixins enforcing PostgreSQL conventions (Rule 5 & Rule 1).

RULE 1: Every table has org_id.
RULE 5: PostgreSQL conventions: bigint identity keys, timestamptz in UTC,
JSONB for structured data, CHECK constraints for fixed value sets,
indexes on (org_id, created_at) and on every foreign key.
"""

from datetime import datetime, timezone
from sqlalchemy import BigInteger, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def utc_now() -> datetime:
    """Current UTC timestamp."""
    return datetime.now(timezone.utc)


class IdMixin:
    """Bigint auto-incrementing identity primary key."""
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)


class OrgMixin:
    """Enforces org_id foreign key on every tenant-scoped table (Rule 1)."""
    org_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )


class TimestampMixin:
    """UTC timestamptz for creation and modification tracking."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False
    )
