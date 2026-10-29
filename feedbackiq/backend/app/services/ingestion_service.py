import csv
import io
import re
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.feedback import Feedback
from app.models.import_job import ImportJob, ImportJobStatus
from app.models.audit import AuditEvent


class IngestionService:
    """
    Reusable data ingestion engine with flexible field normalization,
    duplicate prevention, batch commits, and Zomato Bangalore dataset support.
    """

    # Flexible column aliases
    COLUMN_ALIASES = {
        "feedback_id": ["feedback_id", "id", "review_id", "complaint_id", "fb_id"],
        "date": ["date", "timestamp", "created_at", "time", "date_time", "review_date"],
        "meal_type": ["meal_type", "meal", "slot", "meal_slot", "service_type"],
        "item": ["item", "dish", "dish_name", "food_item", "menu_item", "dish_liked", "item_name", "food"],
        "rating": ["rating", "rate", "stars", "score", "user_rating"],
        "comment": ["comment", "review", "review_text", "feedback", "reviews_list", "text", "description"],
        "channel": ["channel", "source", "submission_channel", "type"],
        "issue_category": ["issue_category", "category", "issue", "complaint_category", "complaint_type"],
    }

    @classmethod
    def compute_content_hash(
        cls,
        organization_id: uuid.UUID,
        date_val: Optional[datetime],
        item: Optional[str],
        comment: Optional[str],
    ) -> str:
        d_str = date_val.isoformat() if date_val else "no_date"
        i_str = (item or "").strip().lower()
        c_str = (comment or "").strip().lower()
        payload = f"{organization_id}:{d_str}:{i_str}:{c_str}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def parse_rating(cls, raw: Any) -> Optional[int]:
        """Normalize ratings to 1-5 integer scale (handles '4.1/5', '4.0', '3', 'NEW', '-')"""
        if raw is None:
            return None
        text = str(raw).strip()
        if not text or text in ["NEW", "-", "nan", "None"]:
            return None
        match = re.search(r"(\d+(\.\d+)?)", text)
        if match:
            try:
                flt = float(match.group(1))
                return max(1, min(5, round(flt)))
            except ValueError:
                return None
        return None

    @classmethod
    def parse_datetime(cls, raw: Any) -> Optional[datetime]:
        """Parse various date/datetime string formats into timezone-aware datetime."""
        if not raw:
            return None
        text = str(raw).strip()
        if not text or text.lower() in ["nan", "none", "null"]:
            return None

        # Common format patterns
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(text, fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue

        return None

    @classmethod
    def detect_column_mapping(cls, headers: List[str]) -> Dict[str, str]:
        """Detect column mapping from CSV header names."""
        mapping: Dict[str, str] = {}
        lower_headers = {h.strip().lower(): h for h in headers}

        for canonical_field, aliases in cls.COLUMN_ALIASES.items():
            for alias in aliases:
                if alias in lower_headers:
                    mapping[canonical_field] = lower_headers[alias]
                    break

        return mapping

    @classmethod
    def is_zomato_dataset(cls, headers: List[str]) -> bool:
        """Identify if CSV matches Zomato Bangalore Kaggle dataset structure."""
        lower = [h.strip().lower() for h in headers]
        return "rate" in lower and ("reviews_list" in lower or "dish_liked" in lower or "cuisines" in lower)

    @classmethod
    def parse_zomato_row(
        cls,
        row: Dict[str, Any],
        organization_id: uuid.UUID,
    ) -> Optional[Dict[str, Any]]:
        """
        Special parser for Zomato Bangalore Kaggle records.
        Strict rule: Map ONLY available fields. Do NOT invent meal types, dates, or missing dishes.
        """
        raw_comment = row.get("reviews_list") or row.get("review") or row.get("comment") or ""
        # Clean Zomato review list syntax if present (e.g. "[('Rated 4.0', 'RATED\\n  Food was good...')]")
        clean_comment = raw_comment
        if "Rated" in raw_comment and "RATED" in raw_comment:
            parts = re.findall(r"RATED\\n\s*(.*?)(?='|\"|\)|$)", raw_comment)
            if parts:
                clean_comment = " ".join(parts[:2]).replace("\\n", " ").strip()

        if not clean_comment:
            return None

        rating = cls.parse_rating(row.get("rate") or row.get("rating"))
        item = (
            row.get("dish_liked")
            or row.get("dish")
            or row.get("name")  # Restaurant name as fallback item
            or "Restaurant Food"
        )
        if isinstance(item, str) and "," in item:
            item = item.split(",")[0].strip()

        return {
            "feedback_id": f"ZOM-{uuid.uuid4().hex[:8].upper()}",
            "organization_id": organization_id,
            "date": None,  # Zomato Kaggle doesn't provide standard timestamps per review row; do not invent
            "meal_type": None,  # Do not invent meal type
            "item": item,
            "rating": rating,
            "comment": clean_comment[:2000],
            "channel": "zomato_review",
            "issue_category": None,
            "source_dataset": "zomato_bangalore",
        }

    @classmethod
    async def process_csv_content(
        cls,
        db: AsyncSession,
        csv_text: str,
        organization_id: uuid.UUID,
        filename: str,
        user_id: Optional[uuid.UUID] = None,
        batch_size: int = 100,
    ) -> ImportJob:
        """
        Full CSV ingestion pipeline:
        1. Parse CSV & validate headers
        2. Detect dataset schema (Standard vs Zomato)
        3. Deduplicate via content hash
        4. Batch insert into database
        5. Record ImportJob and AuditEvent
        """
        job = ImportJob(
            organization_id=organization_id,
            source_name=filename,
            filename=filename,
            status=ImportJobStatus.PROCESSING,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        reader = csv.DictReader(io.StringIO(csv_text))
        headers = reader.fieldnames or []
        is_zomato = cls.is_zomato_dataset(headers)
        mapping = cls.detect_column_mapping(headers)

        rows = list(reader)
        job.total_records = len(rows)

        # Pre-fetch existing hashes for this organization to accelerate deduplication
        stmt = select(Feedback.content_hash).where(Feedback.organization_id == organization_id)
        res = await db.execute(stmt)
        existing_hashes = set(res.scalars().all())

        new_feedbacks: List[Feedback] = []
        errors: List[Dict[str, Any]] = []
        duplicates = 0
        successful = 0
        batch_now = datetime.now(timezone.utc)

        for idx, row in enumerate(rows, start=1):
            try:
                date_val: Optional[datetime] = None
                if is_zomato:
                    parsed = cls.parse_zomato_row(row, organization_id)
                    if not parsed:
                        continue
                    date_val = parsed.get("date")
                else:
                    comment = row.get(mapping.get("comment", ""), "").strip()
                    item = row.get(mapping.get("item", ""), "").strip() or None
                    if not comment and not item:
                        # Skip empty rows
                        continue

                    date_val = cls.parse_datetime(row.get(mapping.get("date", "")))
                    rating = cls.parse_rating(row.get(mapping.get("rating", "")))
                    meal_type = row.get(mapping.get("meal_type", ""), "").strip() or None
                    channel = row.get(mapping.get("channel", ""), "").strip() or "csv_import"
                    issue_cat = row.get(mapping.get("issue_category", ""), "").strip() or None
                    fb_id = row.get(mapping.get("feedback_id", ""), "").strip() or f"CSV-{uuid.uuid4().hex[:8].upper()}"

                    parsed = {
                        "feedback_id": fb_id,
                        "organization_id": organization_id,
                        "date": date_val or batch_now,
                        "meal_type": meal_type,
                        "item": item,
                        "rating": rating,
                        "comment": comment,
                        "channel": channel,
                        "issue_category": issue_cat,
                        "source_dataset": "csv_import",
                    }

                # Compute content hash on original date_val (or None if not provided)
                content_hash = cls.compute_content_hash(
                    organization_id=organization_id,
                    date_val=date_val,
                    item=parsed["item"],
                    comment=parsed["comment"],
                )

                # Deduplication check
                if content_hash in existing_hashes:
                    duplicates += 1
                    continue

                existing_hashes.add(content_hash)
                feedback_obj = Feedback(
                    feedback_id=parsed["feedback_id"],
                    organization_id=organization_id,
                    date=parsed["date"],
                    meal_type=parsed["meal_type"],
                    item=parsed["item"],
                    rating=parsed["rating"],
                    comment=parsed["comment"],
                    channel=parsed["channel"],
                    issue_category=parsed["issue_category"],
                    source_dataset=parsed["source_dataset"],
                    content_hash=content_hash,
                )
                new_feedbacks.append(feedback_obj)
                successful += 1

                # Flush in batches
                if len(new_feedbacks) >= batch_size:
                    db.add_all(new_feedbacks)
                    await db.commit()
                    new_feedbacks.clear()

            except Exception as e:
                errors.append({"row": idx, "error": str(e)})

        # Commit remaining records
        if new_feedbacks:
            db.add_all(new_feedbacks)
            await db.commit()

        # Update Job Metrics
        job.processed_records = len(rows)
        job.successful_records = successful
        job.duplicate_records = duplicates
        job.failed_records = len(errors)
        job.errors = errors[:50]  # Store up to 50 sample errors
        job.status = ImportJobStatus.COMPLETED if len(errors) < len(rows) else ImportJobStatus.FAILED
        await db.commit()
        await db.refresh(job)

        # Audit Event Log
        audit = AuditEvent(
            organization_id=organization_id,
            user_id=user_id,
            event_type="CSV_INGESTION",
            entity_type="import_job",
            entity_id=str(job.id),
            event_payload={
                "filename": filename,
                "successful": successful,
                "duplicates": duplicates,
                "failed": len(errors),
            },
        )
        db.add(audit)
        await db.commit()

        return job
