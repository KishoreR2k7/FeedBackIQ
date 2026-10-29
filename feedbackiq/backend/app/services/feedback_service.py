import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.models.audit import AuditEvent
from app.schemas.feedback import FeedbackCreate, PaginatedFeedbackResponse, FeedbackResponse
from app.schemas.analysis import FeedbackAnalysisResponse, BatchAnalysisResponse
from app.agents.feedback_analyzer import FeedbackAnalyzerAgent
from app.services.synthetic_generator import SyntheticDataGenerator


class FeedbackService:
    """Manages feedback retrieval, synthetic generation, and LangChain analysis executions."""

    @classmethod
    async def list_feedback(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        meal_type: Optional[str] = None,
        item: Optional[str] = None,
        issue_category: Optional[str] = None,
        sentiment: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        channel: Optional[str] = None,
        food_safety_only: bool = False,
    ) -> PaginatedFeedbackResponse:
        # Base filter by tenant organization_id
        conditions = [Feedback.organization_id == organization_id]

        if meal_type:
            conditions.append(Feedback.meal_type.ilike(f"%{meal_type}%"))
        if item:
            conditions.append(Feedback.item.ilike(f"%{item}%"))
        if issue_category:
            conditions.append(Feedback.issue_category.ilike(f"%{issue_category}%"))
        if channel:
            conditions.append(Feedback.channel == channel)
        if date_from:
            conditions.append(func.coalesce(Feedback.date, Feedback.created_at) >= date_from)
        if date_to:
            conditions.append(func.coalesce(Feedback.date, Feedback.created_at) <= date_to)

        query = select(Feedback).options(selectinload(Feedback.analysis)).where(and_(*conditions))
        count_stmt = select(func.count(Feedback.id)).where(and_(*conditions))

        if food_safety_only or sentiment:
            query = query.join(Feedback.analysis)
            count_stmt = count_stmt.join(Feedback.analysis)

        if food_safety_only:
            query = query.where(FeedbackAnalysis.food_safety_flag.is_(True))
            count_stmt = count_stmt.where(FeedbackAnalysis.food_safety_flag.is_(True))

        if sentiment:
            query = query.where(func.lower(FeedbackAnalysis.sentiment) == sentiment.lower())
            count_stmt = count_stmt.where(func.lower(FeedbackAnalysis.sentiment) == sentiment.lower())

        # Total count query
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Pagination
        offset = (page - 1) * page_size
        query = query.order_by(Feedback.created_at.desc()).offset(offset).limit(page_size)

        result = await db.execute(query)
        items = list(result.scalars().all())
        total_pages = max(1, (total + page_size - 1) // page_size)

        return PaginatedFeedbackResponse(
            items=[FeedbackResponse.model_validate(f) for f in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    @classmethod
    async def get_by_id(
        cls,
        db: AsyncSession,
        feedback_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Optional[Feedback]:
        stmt = (
            select(Feedback)
            .options(selectinload(Feedback.analysis))
            .where(Feedback.id == feedback_id, Feedback.organization_id == organization_id)
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @classmethod
    async def create_feedback(
        cls,
        db: AsyncSession,
        payload: FeedbackCreate,
        organization_id: uuid.UUID,
    ) -> Feedback:
        content_hash = SyntheticDataGenerator.compute_content_hash(
            organization_id,
            payload.date.isoformat() if payload.date else "no_date",
            payload.item,
            payload.comment,
        )

        fb = Feedback(
            feedback_id=payload.feedback_id or f"FB-{uuid.uuid4().hex[:8].upper()}",
            organization_id=organization_id,
            location_id=payload.location_id,
            date=payload.date,
            meal_type=payload.meal_type,
            item=payload.item,
            rating=payload.rating,
            comment=payload.comment,
            channel=payload.channel or "web_form",
            issue_category=payload.issue_category,
            source_dataset=payload.source_dataset or "manual_entry",
            content_hash=content_hash,
        )
        db.add(fb)
        await db.commit()
        await db.refresh(fb)
        return fb

    @classmethod
    async def generate_synthetic_data(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        count: int = 50,
        seed_recurring: bool = True,
    ) -> List[Feedback]:
        records = SyntheticDataGenerator.generate_records(
            organization_id=organization_id,
            count=count,
            seed_recurring=seed_recurring,
        )

        # Check existing hashes to avoid duplicate clashes
        stmt = select(Feedback.content_hash).where(Feedback.organization_id == organization_id)
        res = await db.execute(stmt)
        existing_hashes = set(res.scalars().all())

        new_feedbacks = []
        for r in records:
            if r["content_hash"] in existing_hashes:
                continue
            existing_hashes.add(r["content_hash"])
            fb = Feedback(**r)
            new_feedbacks.append(fb)

        if new_feedbacks:
            db.add_all(new_feedbacks)
            await db.commit()

        # Return latest persisted items
        stmt = (
            select(Feedback)
            .options(selectinload(Feedback.analysis))
            .where(Feedback.organization_id == organization_id)
            .order_by(Feedback.created_at.desc())
            .limit(count)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def analyze_feedback_item(
        cls,
        db: AsyncSession,
        feedback: Feedback,
        force_reanalyze: bool = False,
    ) -> FeedbackAnalysis:
        """Invokes FeedbackAnalyzerAgent and persists structured analytical output.
        Avoids reprocessing unchanged feedback unless force_reanalyze is True."""
        # Check if already analyzed
        stmt = select(FeedbackAnalysis).where(FeedbackAnalysis.feedback_id == feedback.id)
        res = await db.execute(stmt)
        existing = res.scalars().first()

        if existing and not force_reanalyze:
            return existing

        # Run LangChain agent
        structured_out = await FeedbackAnalyzerAgent.analyze(
            comment=feedback.comment or "",
            rating=feedback.rating,
            item=feedback.item,
            meal_type=feedback.meal_type,
        )

        if existing:
            existing.sentiment = structured_out.sentiment
            existing.mentioned_food_items = structured_out.mentioned_food_items
            existing.service_aspects = structured_out.service_aspects
            existing.issue_categories = structured_out.issue_categories
            existing.severity_score = structured_out.severity_score
            existing.evidence_quotes = structured_out.evidence_quotes
            existing.food_safety_flag = structured_out.food_safety_flag
            existing.food_safety_reasons = structured_out.food_safety_reasons
            existing.language = structured_out.language
            existing.uncertainty_score = structured_out.uncertainty_score
            existing.raw_model_response = structured_out.model_dump()
            await db.commit()
            await db.refresh(existing)
            analysis_obj = existing
        else:
            analysis_obj = FeedbackAnalysis(
                feedback_id=feedback.id,
                organization_id=feedback.organization_id,
                sentiment=structured_out.sentiment,
                mentioned_food_items=structured_out.mentioned_food_items,
                service_aspects=structured_out.service_aspects,
                issue_categories=structured_out.issue_categories,
                severity_score=structured_out.severity_score,
                evidence_quotes=structured_out.evidence_quotes,
                food_safety_flag=structured_out.food_safety_flag,
                food_safety_reasons=structured_out.food_safety_reasons,
                language=structured_out.language,
                uncertainty_score=structured_out.uncertainty_score,
                model_name=settings.LLM_PROVIDER,
                raw_model_response=structured_out.model_dump(),
            )
            db.add(analysis_obj)
            await db.commit()
            await db.refresh(analysis_obj)

        # Log safety escalation if triggered (Rule 9)
        if analysis_obj.food_safety_flag:
            audit = AuditEvent(
                organization_id=feedback.organization_id,
                event_type="SAFETY_ESCALATION",
                entity_type="feedback_analysis",
                entity_id=str(analysis_obj.id),
                event_payload={
                    "feedback_id": str(feedback.id),
                    "item": feedback.item,
                    "reasons": analysis_obj.food_safety_reasons,
                    "severity": analysis_obj.severity_score,
                },
            )
            db.add(audit)
            await db.commit()

        return analysis_obj

    @classmethod
    async def batch_analyze(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        feedback_ids: Optional[List[uuid.UUID]] = None,
        limit: int = 20,
    ) -> BatchAnalysisResponse:
        """Runs batch analysis on feedback records for an organization."""
        query = (
            select(Feedback)
            .outerjoin(Feedback.analysis)
            .where(Feedback.organization_id == organization_id)
        )

        if feedback_ids:
            query = query.where(Feedback.id.in_(feedback_ids))
        else:
            # Pick records that haven't been analyzed yet
            query = query.where(FeedbackAnalysis.id.is_(None))

        query = query.limit(limit)
        result = await db.execute(query)
        feedbacks = list(result.scalars().all())

        successful = []
        failed = 0
        safety_alerts = 0

        for fb in feedbacks:
            try:
                analysis = await cls.analyze_feedback_item(db, fb)
                successful.append(FeedbackAnalysisResponse.model_validate(analysis))
                if analysis.food_safety_flag:
                    safety_alerts += 1
            except Exception:
                failed += 1

        return BatchAnalysisResponse(
            total_requested=len(feedbacks),
            successful_analyzed=len(successful),
            failed_analyzed=failed,
            safety_alerts_triggered=safety_alerts,
            results=successful,
        )
