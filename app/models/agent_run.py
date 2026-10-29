"""AgentRun model logging every LLM execution enforcing Rule 4."""

from typing import Optional, Dict, Any
from sqlalchemy import BigInteger, String, Integer, ForeignKey, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.base import IdMixin, OrgMixin, TimestampMixin


class AgentRun(Base, IdMixin, OrgMixin, TimestampMixin):
    """Audit log recording every LLM invocation, fallback attempt, and JSON output."""
    __tablename__ = "agent_runs"

    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_preview: Mapped[str] = mapped_column(String(1000), nullable=False)
    response_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fallback_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('success', 'failed', 'fallback', 'rules')",
            name="check_agent_run_status_valid"
        ),
        Index("ix_agent_runs_org_id_created_at", "org_id", "created_at"),
        Index("ix_agent_runs_org_agent", "org_id", "agent_name"),
    )
