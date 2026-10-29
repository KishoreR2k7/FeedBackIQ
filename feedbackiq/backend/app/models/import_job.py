import enum
from typing import Any, Dict, List
from sqlalchemy import String, Integer, JSON, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin


class ImportJobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportJob(Base, UUIDPrimaryKeyMixin, TimestampMixin, TenantScopedMixin):
    """
    Tracks CSV bulk ingestion, progress, deduplication, and error statistics.
    """
    __tablename__ = "import_jobs"

    source_name: Mapped[str] = mapped_column(String(100), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    successful_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    errors: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[ImportJobStatus] = mapped_column(
        SQLEnum(ImportJobStatus),
        default=ImportJobStatus.PENDING,
        nullable=False,
        index=True,
    )
