import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict, Counter

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.schemas.intelligence import (
    TopicTrendSummary,
    TrendFilterParams,
    VelocityTrendType,
)

logger = logging.getLogger("feedbackiq.services.trend_service")


class TrendService:
    """
    Topic and trend intelligence service.
    Aggregates feedback by item, category, location, meal type, and date windows.
    Computes exact facts using SQL/Python and grounds summaries in actual quotes.
    """

    @classmethod
    async def get_clustered_trends(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        filters: Optional[TrendFilterParams] = None,
        recent_days: int = 7,
    ) -> List[TopicTrendSummary]:
        """
        Groups tenant feedback into topic clusters and calculates empirical historical trend facts.
        """
        # Base query with tenant scoping and eager load of analysis
        query = (
            select(Feedback)
            .options(selectinload(Feedback.analysis))
            .where(Feedback.organization_id == organization_id)
        )

        # Apply filters
        if filters:
            if filters.location_id:
                query = query.where(Feedback.location_id == filters.location_id)
            if filters.date_from:
                query = query.where(Feedback.date >= filters.date_from)
            if filters.date_to:
                query = query.where(Feedback.date <= filters.date_to)
            if filters.issue_category:
                query = query.where(Feedback.issue_category == filters.issue_category)
            if filters.meal_type:
                query = query.where(Feedback.meal_type == filters.meal_type)
            if filters.channel:
                query = query.where(Feedback.channel == filters.channel)

        result = await db.execute(query)
        feedbacks = result.scalars().all()

        if not feedbacks:
            return []

        # Determine cutoff for recent vs historical window
        now = datetime.now(timezone.utc)
        # Normalize all dates to timezone-aware UTC to prevent SQLite/Postgres naive/aware mismatch
        dates_present = [
            (f.date.replace(tzinfo=timezone.utc) if f.date.tzinfo is None else f.date)
            for f in feedbacks
            if f.date is not None
        ]
        ref_date = max(dates_present) if dates_present else now
        recent_cutoff = ref_date - timedelta(days=recent_days)

        # Group feedback into clusters: (normalized_item, normalized_category, optional_meal)
        clusters: Dict[str, List[Feedback]] = defaultdict(list)

        for fb in feedbacks:
            analysis = fb.analysis

            # Extract item
            item_name = (fb.item or "").strip()
            if not item_name and analysis and analysis.mentioned_food_items:
                item_name = analysis.mentioned_food_items[0].strip()
            if not item_name:
                item_name = "General Food Service"

            # Extract category
            cat_name = (fb.issue_category or "").strip().lower()
            if not cat_name and analysis and analysis.issue_categories:
                cat_name = analysis.issue_categories[0].strip().lower()
            if not cat_name:
                cat_name = "general"

            # Meal type
            meal = (fb.meal_type or "").strip()

            # Cluster key
            cluster_key = f"{item_name}|{cat_name}"
            if meal:
                cluster_key += f"|{meal}"

            clusters[cluster_key].append(fb)

        # Calculate statistics for each cluster
        trend_summaries: List[TopicTrendSummary] = []

        for cluster_key, group in clusters.items():
            parts = cluster_key.split("|")
            item = parts[0] if len(parts) > 0 else "General"
            category = parts[1] if len(parts) > 1 else "general"
            meal = parts[2] if len(parts) > 2 else None

            total_count = len(group)
            ratings = [f.rating for f in group if f.rating is not None]
            avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 3.0

            # Count complaints: negative sentiment or rating <= 2 or severity >= 3
            complaints: List[Feedback] = []
            positives: List[Feedback] = []
            quotes: List[str] = []
            severities: List[int] = []
            has_food_safety = False
            safety_reasons: List[str] = []

            day_counter: Counter = Counter()
            meal_counter: Counter = Counter()

            recent_complaints = 0
            historical_complaints = 0

            for fb in group:
                analysis = fb.analysis
                is_complaint = False
                sev = 1

                if analysis:
                    sev = analysis.severity_score
                    severities.append(sev)
                    if analysis.food_safety_flag:
                        has_food_safety = True
                        safety_reasons.extend(analysis.food_safety_reasons)
                    if analysis.evidence_quotes:
                        quotes.extend(analysis.evidence_quotes)
                    if analysis.sentiment in ["negative", "mixed"] or sev >= 3:
                        is_complaint = True
                
                if fb.rating is not None and fb.rating <= 2:
                    is_complaint = True
                elif fb.rating is not None and fb.rating >= 4:
                    positives.append(fb)

                if fb.comment and fb.comment.strip():
                    if not quotes or len(quotes) < 5:
                        quotes.append(fb.comment.strip())

                if is_complaint:
                    complaints.append(fb)
                    # Window calculation
                    fb_date = fb.date
                    if fb_date:
                        if fb_date.tzinfo is None:
                            fb_date = fb_date.replace(tzinfo=timezone.utc)
                        if fb_date >= recent_cutoff:
                            recent_complaints += 1
                        else:
                            historical_complaints += 1
                        
                        day_counter[fb_date.strftime("%A")] += 1
                    else:
                        recent_complaints += 1

                if fb.meal_type:
                    meal_counter[fb.meal_type] += 1

            complaint_count = len(complaints)
            positive_count = len(positives)
            neg_prop = round(complaint_count / total_count, 3) if total_count > 0 else 0.0
            avg_sev = round(sum(severities) / len(severities), 2) if severities else 1.0
            max_sev = max(severities) if severities else 1

            # Velocity % calculation
            velocity_change_percent: Optional[float] = None
            velocity_trend: VelocityTrendType = "stable"

            if total_count < 2:
                velocity_trend = "insufficient_data"
            elif historical_complaints == 0 and recent_complaints > 0:
                velocity_trend = "new"
                velocity_change_percent = 100.0
            elif historical_complaints > 0:
                diff = recent_complaints - historical_complaints
                velocity_change_percent = round((diff / historical_complaints) * 100.0, 1)
                if velocity_change_percent > 15.0:
                    velocity_trend = "increasing"
                elif velocity_change_percent < -15.0:
                    velocity_trend = "decreasing"
                else:
                    velocity_trend = "stable"
            else:
                velocity_trend = "stable"
                velocity_change_percent = 0.0

            # Derive temporal patterns
            time_patterns: List[str] = []
            if day_counter:
                top_days = day_counter.most_common(2)
                for day_name, count in top_days:
                    if count > 1:
                        time_patterns.append(f"Frequent on {day_name}s ({count} complaints)")
            if meal_counter:
                top_meals = meal_counter.most_common(1)
                for m_name, count in top_meals:
                    pct = int((count / total_count) * 100)
                    if pct >= 50:
                        time_patterns.append(f"Predominantly {m_name} service ({pct}% of reports)")

            # Evidence quotes deduplicated & trimmed
            dedup_quotes = list(dict.fromkeys([q for q in quotes if len(q) > 4]))[:5]

            # Grounded topic label and summary
            topic_label = cls._synthesize_topic_label(item, category, meal)
            topic_summary = cls._synthesize_grounded_summary(
                item=item,
                category=category,
                complaint_count=complaint_count,
                total_count=total_count,
                quotes=dedup_quotes,
                has_safety_issue=has_food_safety,
            )

            trend_summaries.append(
                TopicTrendSummary(
                    issue_cluster_key=cluster_key,
                    item=item,
                    issue_category=category,
                    meal_type=meal,
                    topic_label=topic_label,
                    topic_summary=topic_summary,
                    total_feedback_count=total_count,
                    complaint_count=complaint_count,
                    positive_count=positive_count,
                    average_rating=avg_rating,
                    negative_feedback_proportion=neg_prop,
                    recent_complaints_count=recent_complaints,
                    historical_complaints_count=historical_complaints,
                    velocity_change_percent=velocity_change_percent,
                    velocity_trend=velocity_trend,
                    time_patterns=time_patterns,
                    evidence_quotes=dedup_quotes,
                    has_food_safety_hazard=has_food_safety,
                    food_safety_reasons=list(dict.fromkeys(safety_reasons)),
                    average_severity=avg_sev,
                    max_severity=max_sev,
                    supporting_feedback_ids=[str(fb.id) for fb in group],
                )
            )

        # Sort clusters by complaint count descending
        trend_summaries.sort(key=lambda s: (s.has_food_safety_hazard, s.complaint_count), reverse=True)
        return trend_summaries

    @classmethod
    def _synthesize_topic_label(cls, item: str, category: str, meal: Optional[str]) -> str:
        canonical_topics = {
            "temperature": "Cold Food",
            "taste": "Poor Taste",
            "undercooked": "Undercooked Food",
            "portion_size": "Small Portions",
            "hygiene": "Hygiene Concerns",
            "service": "Slow Service",
            "freshness": "Stale / Spoiled Food",
            "billing": "Billing Issues",
            "ambience": "Ambience Concerns",
        }
        topic_name = canonical_topics.get(category.lower(), category.replace("_", " ").title())
        if item and item not in ("General", "General Food Service"):
            if meal:
                return f"{item} ({meal}) — {topic_name}"
            return f"{item} — {topic_name}"
        if meal:
            return f"{topic_name} ({meal})"
        return topic_name

    @classmethod
    async def get_feedback_for_topic(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        cluster_key: str,
    ) -> List[Feedback]:
        """
        Retrieves all supporting feedback records corresponding to a specific topic cluster key.
        Cluster key format: item|category or item|category|meal.
        """
        parts = cluster_key.split("|")
        item = parts[0].strip() if len(parts) > 0 else None
        category = parts[1].strip() if len(parts) > 1 else None
        meal = parts[2].strip() if len(parts) > 2 else None

        all_clustered = await cls.get_clustered_trends(db, organization_id)
        matching_cluster = next((t for t in all_clustered if t.issue_cluster_key == cluster_key), None)
        if matching_cluster and matching_cluster.supporting_feedback_ids:
            uids = [uuid.UUID(fid) for fid in matching_cluster.supporting_feedback_ids]
            fb_res = await db.execute(
                select(Feedback)
                .options(selectinload(Feedback.analysis))
                .where(Feedback.id.in_(uids))
                .order_by(Feedback.created_at.desc())
            )
            return list(fb_res.scalars().all())

        query = (
            select(Feedback)
            .options(selectinload(Feedback.analysis))
            .where(Feedback.organization_id == organization_id)
        )
        if item and item not in ("General", "General Food Service"):
            query = query.where(Feedback.item.ilike(f"%{item}%"))
        if category and category != "general":
            query = query.where(Feedback.issue_category.ilike(f"%{category}%"))
        if meal:
            query = query.where(Feedback.meal_type.ilike(f"%{meal}%"))

        query = query.order_by(Feedback.created_at.desc())
        res = await db.execute(query)
        return list(res.scalars().all())

    @classmethod
    def _synthesize_grounded_summary(
        cls,
        item: str,
        category: str,
        complaint_count: int,
        total_count: int,
        quotes: List[str],
        has_safety_issue: bool,
    ) -> str:
        """
        Creates an evidence-grounded summary without hallucinating counts or statistics.
        Quotes are cited directly.
        """
        if complaint_count == 0:
            return f"Patron feedback for {item} is predominantly positive with no recorded complaint patterns."

        safety_prefix = "CRITICAL FOOD SAFETY HAZARD: " if has_safety_issue else ""
        quote_sample = f' Evidence quotes include: "{quotes[0]}"' if quotes else ""

        if complaint_count == 1 and total_count == 1:
            return f"{safety_prefix}Isolated report regarding {item} {category}.{quote_sample}"

        return (
            f"{safety_prefix}Multiple reports indicating recurring {category} issues with {item}."
            f"{quote_sample}"
        )
