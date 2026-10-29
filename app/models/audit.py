"""Audit log model for security tracking and compliance."""

from typing import Optional, Dict, Any
from sqlalchemy import BigInteger, String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class AuditLog(Base, IdMixin, OrgMixin, TimestampMixin):
    """System-wide audit trail for administrative operations."""
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index("ix_audit_logs_org_id_created_at", "org_id", "created_at"),
        Index("ix_audit_logs_org_action", "org_id", "action"),
    )
