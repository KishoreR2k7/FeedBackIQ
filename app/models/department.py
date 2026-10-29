"""Department model for organizational routing and SLA tracking."""

from typing import Optional, List
from sqlalchemy import BigInteger, String, Integer, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class Department(Base, IdMixin, OrgMixin, TimestampMixin):
    """Department in charge of specific feedback categories and tasks."""
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    incharge_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Deterministic SLA targets in hours per priority level (Rule 3)
    sla_hours_p1: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    sla_hours_p2: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    sla_hours_p3: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    sla_hours_p4: Mapped[int] = mapped_column(Integer, default=48, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_departments_org_code"),
        Index("ix_departments_org_id_created_at", "org_id", "created_at"),
    )

    def __init__(self, **kwargs):
        if "in_charge_user_id" in kwargs and "incharge_id" not in kwargs:
            kwargs["incharge_id"] = kwargs.pop("in_charge_user_id")
        super().__init__(**kwargs)

    @property
    def in_charge_user_id(self) -> Optional[int]:
        return self.incharge_id

    @in_charge_user_id.setter
    def in_charge_user_id(self, value: Optional[int]):
        self.incharge_id = value

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="departments",
        primaryjoin="Department.org_id == Organization.id"
    )
    in_charge_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[incharge_id], post_update=True
    )
    feedback_items: Mapped[List["Feedback"]] = relationship("Feedback", back_populates="department")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="department")
