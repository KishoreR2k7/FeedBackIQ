import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.feedback import Feedback
from app.models.analysis import FeedbackAnalysis
from app.models.recurrence import RecurrenceAssessment
from app.models.task import ActionTask, TaskStatus
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    SentimentByMealItem,
    SentimentTrendItem,
    FoodItemStat,
    CommonComplaintStat,
    CategoryDistributionItem,
    ExtractedTopicItem,
    AnalyticsReportResponse,
    RecurrencePredictionItem,
)
from app.services.trend_service import TrendService
from app.services.intelligence_service import IntelligenceService

logger = logging.getLogger("feedbackiq.services.analytics")


STANDARD_CATEGORIES = [
    "Food Temperature",
    "Taste & Flavor",
    "Food Freshness & Spoilage",
    "Hygiene & Cleanliness",
    "Portion & Quantity",
    "Food Quality",
    "Serving Delay",
    "Staff Behavior",
]


class AnalyticsService:
    """
    Deterministic Analytics & Intelligence Engine.
    Computes exact facts, proportions, timelines, and distributions using SQL and Python.
    Strictly upholds Rule 3: Code counts, LLM thinks.
    """

    @classmethod
    async def get_overview(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        meal_type: Optional[str] = None,
        item: Optional[str] = None,
        issue_category: Optional[str] = None,
        sentiment: Optional[str] = None,
        channel: Optional[str] = None,
        source_dataset: Optional[str] = None,
    ) -> AnalyticsOverviewResponse:
        """Computes executive overview metrics and KPIs."""
        feedbacks = await cls._fetch_filtered_feedbacks(
            db=db,
            organization_id=organization_id,
            date_from=date_from,
            date_to=date_to,
            meal_type=meal_type,
            item=item,
            issue_category=issue_category,
            sentiment=sentiment,
            channel=channel,
            source_dataset=source_dataset,
        )

        total_feedback = len(feedbacks)
        if total_feedback == 0:
            return AnalyticsOverviewResponse()

        pos_count = 0
        neg_count = 0
        neu_count = 0
        ratings = []

        student_count = 0
        synth_count = 0
        zomato_count = 0

        for fb in feedbacks:
            # Rating
            if fb.rating is not None:
                ratings.append(fb.rating)

            # Dataset source categorization
            src = (fb.source_dataset or "").lower()
            ch = (fb.channel or "").lower()
            if "zomato" in src or ch == "zomato_review":
                zomato_count += 1
            elif "synth" in src:
                synth_count += 1
            else:
                student_count += 1

            # Sentiment (uses AI analysis if available, otherwise rating heuristic)
            sent = None
            if fb.analysis and fb.analysis.sentiment:
                sent = fb.analysis.sentiment.lower()
            elif fb.rating:
                if fb.rating >= 4:
                    sent = "positive"
                elif fb.rating <= 2:
                    sent = "negative"
                else:
                    sent = "neutral"

            if sent == "positive":
                pos_count += 1
            elif sent == "negative":
                neg_count += 1
            else:
                neu_count += 1

        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
        sat_pct = round((pos_count / max(1, total_feedback)) * 100, 1)
        neg_pct = round((neg_count / max(1, total_feedback)) * 100, 1)

        # Recurrence assessment counts
        rec_stmt = select(RecurrenceAssessment).where(
            RecurrenceAssessment.organization_id == organization_id
        )
        rec_res = await db.execute(rec_stmt)
        rec_items = rec_res.scalars().all()

        active_recurring = sum(1 for r in rec_items if r.risk_level in ["Critical", "High", "Medium"])
        critical_issues = sum(1 for r in rec_items if r.risk_level == "Critical" or r.is_safety_override)

        # Action tasks pending count
        task_stmt = select(ActionTask).where(
            ActionTask.organization_id == organization_id,
            ActionTask.status.notin_([TaskStatus.COMPLETED.value, TaskStatus.VERIFIED.value, TaskStatus.REJECTED.value]),
        )
        task_res = await db.execute(task_stmt)
        pending_actions = len(task_res.scalars().all())

        return AnalyticsOverviewResponse(
            total_feedback=total_feedback,
            positive_count=pos_count,
            negative_count=neg_count,
            neutral_count=neu_count,
            satisfaction_percentage=sat_pct,
            negative_percentage=neg_pct,
            average_rating=avg_rating,
            active_recurring_issues=active_recurring,
            critical_issues=critical_issues,
            pending_actions=pending_actions,
            student_canteen_count=student_count,
            synthetic_count=synth_count,
            zomato_count=zomato_count,
        )

    @classmethod
    async def get_report(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        meal_type: Optional[str] = None,
        item: Optional[str] = None,
        issue_category: Optional[str] = None,
        sentiment: Optional[str] = None,
        channel: Optional[str] = None,
        source_dataset: Optional[str] = None,
    ) -> AnalyticsReportResponse:
        """Generates a complete multi-dimensional analytics report."""
        overview = await cls.get_overview(
            db=db,
            organization_id=organization_id,
            date_from=date_from,
            date_to=date_to,
            meal_type=meal_type,
            item=item,
            issue_category=issue_category,
            sentiment=sentiment,
            channel=channel,
            source_dataset=source_dataset,
        )

        feedbacks = await cls._fetch_filtered_feedbacks(
            db=db,
            organization_id=organization_id,
            date_from=date_from,
            date_to=date_to,
            meal_type=meal_type,
            item=item,
            issue_category=issue_category,
            sentiment=sentiment,
            channel=channel,
            source_dataset=source_dataset,
        )

        sentiment_by_meal = cls._compute_sentiment_by_meal(feedbacks)
        sentiment_trend = cls._compute_sentiment_trend(feedbacks)
        top_food_items = cls._compute_top_food_items(feedbacks)
        top_complaints = cls._compute_top_complaints(feedbacks)
        category_distribution = cls._compute_category_distribution(feedbacks)
        common_topics = cls._compute_common_topics(feedbacks)

        return AnalyticsReportResponse(
            overview=overview,
            sentiment_by_meal=sentiment_by_meal,
            sentiment_trend=sentiment_trend,
            top_food_items=top_food_items,
            top_complaints=top_complaints,
            category_distribution=category_distribution,
            common_topics=common_topics,
        )

    @classmethod
    async def get_predictions(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
    ) -> List[RecurrencePredictionItem]:
        """
        Returns structured recurrence risk predictions as specified in PS 2.5 Section 7.
        Grounded in historical observation, frequencies, and trend metrics.
        """
        # Ensure assessments are available
        assessments = await IntelligenceService.get_persisted_assessments(
            db=db, organization_id=organization_id
        )

        predictions: List[RecurrencePredictionItem] = []
        for a in assessments:
            issue_name = f"{a.item or 'Service'} {a.issue_category or 'Quality'} Recurrence Risk"
            is_insufficient = (
                a.risk_level == "Insufficient Evidence"
                or a.total_complaints_count < 3
            )

            rec_action = (
                a.recommended_actions[0]
                if a.recommended_actions
                else "Conduct operational monitoring and verify service temperatures/hygiene."
            )

            # Historical statistical calculations
            pred = RecurrencePredictionItem(
                issue_name=issue_name,
                affected_food_item=a.item or "General Food Service",
                meal_type=a.meal_type,
                number_of_occurrences=a.total_complaints_count,
                recent_frequency=a.recent_complaints_count,
                historical_frequency=a.historical_complaints_count,
                severity=round(a.severity_score_normalized / 20.0) if a.severity_score_normalized else 2,
                recurrence_risk_score=round(a.priority_score, 1),
                risk_category=a.risk_level,
                has_insufficient_evidence=is_insufficient,
                supporting_evidence=a.supporting_evidence or [],
                recommended_preventive_action=rec_action,
            )
            predictions.append(pred)

        # Sort descending by priority score and safety override
        predictions.sort(key=lambda p: (p.risk_category == "Critical", p.recurrence_risk_score), reverse=True)
        return predictions

    # -------------------------------------------------------------------------
    # Helper Computations
    # -------------------------------------------------------------------------

    @classmethod
    async def _fetch_filtered_feedbacks(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        meal_type: Optional[str] = None,
        item: Optional[str] = None,
        issue_category: Optional[str] = None,
        sentiment: Optional[str] = None,
        channel: Optional[str] = None,
        source_dataset: Optional[str] = None,
    ) -> List[Feedback]:
        query = (
            select(Feedback)
            .options(selectinload(Feedback.analysis))
            .where(Feedback.organization_id == organization_id)
        )

        if date_from:
            query = query.where(func.coalesce(Feedback.date, Feedback.created_at) >= date_from)
        if date_to:
            query = query.where(func.coalesce(Feedback.date, Feedback.created_at) <= date_to)
        if meal_type:
            query = query.where(Feedback.meal_type.ilike(f"%{meal_type}%"))
        if item:
            query = query.where(Feedback.item.ilike(f"%{item}%"))
        if issue_category:
            query = query.where(Feedback.issue_category.ilike(f"%{issue_category}%"))
        if channel:
            query = query.where(Feedback.channel == channel)
        if source_dataset:
            query = query.where(Feedback.source_dataset.ilike(f"%{source_dataset}%"))

        if sentiment:
            query = query.join(Feedback.analysis).where(
                func.lower(FeedbackAnalysis.sentiment) == sentiment.lower()
            )

        query = query.order_by(func.coalesce(Feedback.date, Feedback.created_at).desc())
        res = await db.execute(query)
        return list(res.scalars().all())

    @classmethod
    def _get_sentiment(cls, fb: Feedback) -> str:
        if fb.analysis and fb.analysis.sentiment:
            return fb.analysis.sentiment.lower()
        if fb.rating:
            if fb.rating >= 4:
                return "positive"
            if fb.rating <= 2:
                return "negative"
        return "neutral"

    @classmethod
    def _compute_sentiment_by_meal(cls, feedbacks: List[Feedback]) -> List[SentimentByMealItem]:
        buckets: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"positive": 0, "negative": 0, "neutral": 0, "total": 0, "ratings": []}
        )

        for fb in feedbacks:
            meal = (fb.meal_type or "General").strip().title()
            if not meal:
                meal = "General"
            sent = cls._get_sentiment(fb)
            b = buckets[meal]
            b["total"] += 1
            if sent == "positive":
                b["positive"] += 1
            elif sent == "negative":
                b["negative"] += 1
            else:
                b["neutral"] += 1
            if fb.rating:
                b["ratings"].append(fb.rating)

        # Standard meal ordering
        order = ["Breakfast", "Lunch", "Evening Snacks", "Dinner", "General"]
        result = []
        for meal in order:
            if meal in buckets:
                b = buckets[meal]
                ratings = b["ratings"]
                avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
                result.append(
                    SentimentByMealItem(
                        meal_type=meal,
                        positive=b["positive"],
                        negative=b["negative"],
                        neutral=b["neutral"],
                        total=b["total"],
                        average_rating=avg,
                    )
                )

        # Append any other meal categories
        for meal, b in buckets.items():
            if meal not in order:
                ratings = b["ratings"]
                avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
                result.append(
                    SentimentByMealItem(
                        meal_type=meal,
                        positive=b["positive"],
                        negative=b["negative"],
                        neutral=b["neutral"],
                        total=b["total"],
                        average_rating=avg,
                    )
                )
        return result

    @classmethod
    def _compute_sentiment_trend(cls, feedbacks: List[Feedback]) -> List[SentimentTrendItem]:
        day_buckets: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"positive": 0, "negative": 0, "neutral": 0, "total": 0, "ratings": []}
        )

        for fb in feedbacks:
            dt = fb.date or fb.created_at
            if not dt:
                continue
            day_str = dt.strftime("%Y-%m-%d")
            sent = cls._get_sentiment(fb)
            b = day_buckets[day_str]
            b["total"] += 1
            if sent == "positive":
                b["positive"] += 1
            elif sent == "negative":
                b["negative"] += 1
            else:
                b["neutral"] += 1
            if fb.rating:
                b["ratings"].append(fb.rating)

        # Sort chronologically
        sorted_days = sorted(day_buckets.keys())
        # Return last 30 distinct days if numerous
        if len(sorted_days) > 30:
            sorted_days = sorted_days[-30:]

        result = []
        for day in sorted_days:
            b = day_buckets[day]
            ratings = b["ratings"]
            avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
            result.append(
                SentimentTrendItem(
                    date=day,
                    positive=b["positive"],
                    negative=b["negative"],
                    neutral=b["neutral"],
                    total=b["total"],
                    average_rating=avg,
                )
            )
        return result

    @classmethod
    def _compute_top_food_items(cls, feedbacks: List[Feedback]) -> List[FoodItemStat]:
        item_data: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"total": 0, "complaints": 0, "positive": 0, "ratings": [], "issues": defaultdict(int)}
        )

        for fb in feedbacks:
            raw_item = (fb.item or "").strip()
            if not raw_item and fb.analysis and fb.analysis.mentioned_food_items:
                raw_item = fb.analysis.mentioned_food_items[0].strip()
            if not raw_item:
                continue

            # Standardize title
            name = raw_item.title()
            d = item_data[name]
            d["total"] += 1
            sent = cls._get_sentiment(fb)
            if sent == "negative":
                d["complaints"] += 1
                cat = fb.issue_category or (fb.analysis.issue_categories[0] if fb.analysis and fb.analysis.issue_categories else "Quality")
                d["issues"][cat] += 1
            elif sent == "positive":
                d["positive"] += 1
            if fb.rating:
                d["ratings"].append(fb.rating)

        stats = []
        for name, d in item_data.items():
            ratings = d["ratings"]
            avg = round(sum(ratings) / len(ratings), 2) if ratings else 3.0
            top_issue = max(d["issues"].items(), key=lambda x: x[1])[0] if d["issues"] else None
            stats.append(
                FoodItemStat(
                    item=name,
                    total_feedback=d["total"],
                    complaint_count=d["complaints"],
                    positive_count=d["positive"],
                    average_rating=avg,
                    top_issue=top_issue,
                )
            )

        # Sort descending by complaint count, then total
        stats.sort(key=lambda s: (s.complaint_count, s.total_feedback), reverse=True)
        return stats[:10]

    @classmethod
    def _compute_category_distribution(cls, feedbacks: List[Feedback]) -> List[CategoryDistributionItem]:
        cat_counts: Dict[str, int] = defaultdict(int)
        total_categorized = 0

        for fb in feedbacks:
            cats: List[str] = []
            if fb.issue_category:
                cats.append(fb.issue_category.strip())
            if fb.analysis and fb.analysis.issue_categories:
                cats.extend([c.strip() for c in fb.analysis.issue_categories])

            if not cats:
                continue

            for cat in set(cats):
                norm = cls._normalize_category(cat)
                cat_counts[norm] += 1
                total_categorized += 1

        items = []
        for cat_name in STANDARD_CATEGORIES:
            cnt = cat_counts.get(cat_name, 0)
            pct = round((cnt / max(1, total_categorized)) * 100, 1) if total_categorized > 0 else 0.0
            items.append(CategoryDistributionItem(category=cat_name, count=cnt, percentage=pct))

        items.sort(key=lambda x: x.count, reverse=True)
        return items

    @classmethod
    def _compute_top_complaints(cls, feedbacks: List[Feedback]) -> List[CommonComplaintStat]:
        complaint_clusters: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "category": "Quality", "samples": [], "max_sev": 1}
        )

        for fb in feedbacks:
            sent = cls._get_sentiment(fb)
            if sent != "negative" and (fb.rating or 5) > 3:
                continue

            item = (fb.item or "Meal").strip().title()
            cat = cls._normalize_category(fb.issue_category or (fb.analysis.issue_categories[0] if fb.analysis and fb.analysis.issue_categories else "Food Quality"))
            key = f"{item} — {cat}"

            c = complaint_clusters[key]
            c["count"] += 1
            c["category"] = cat
            if fb.comment:
                c["samples"].append(fb.comment)
            if fb.analysis:
                c["max_sev"] = max(c["max_sev"], fb.analysis.severity_score)

        results = []
        for issue_key, c in complaint_clusters.items():
            sample = c["samples"][0] if c["samples"] else "Repeated negative feedback logged."
            results.append(
                CommonComplaintStat(
                    issue=issue_key,
                    category=c["category"],
                    count=c["count"],
                    sample_comment=sample[:160],
                    severity=c["max_sev"],
                )
            )

        results.sort(key=lambda x: (x.count, x.severity), reverse=True)
        return results[:8]

    @classmethod
    def _compute_common_topics(cls, feedbacks: List[Feedback]) -> List[ExtractedTopicItem]:
        topic_groups: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"item": "", "category": "", "meal": None, "count": 0, "ratings": [], "pos": 0, "quotes": []}
        )

        for fb in feedbacks:
            item = (fb.item or "Food Service").strip().title()
            cat = cls._normalize_category(fb.issue_category or (fb.analysis.issue_categories[0] if fb.analysis and fb.analysis.issue_categories else "Food Quality"))
            key = f"{item} | {cat}"

            g = topic_groups[key]
            g["item"] = item
            g["category"] = cat
            g["meal"] = fb.meal_type
            g["count"] += 1
            if fb.rating:
                g["ratings"].append(fb.rating)
            if cls._get_sentiment(fb) == "positive":
                g["pos"] += 1
            if fb.comment and len(g["quotes"]) < 3:
                g["quotes"].append(fb.comment[:120])

        topics = []
        for key, g in topic_groups.items():
            if g["count"] < 2:
                continue  # Only include recurring/common topics
            ratings = g["ratings"]
            avg = round(sum(ratings) / len(ratings), 2) if ratings else 3.0
            sentiment_ratio = round((g["pos"] / g["count"]) * 100, 1)
            topics.append(
                ExtractedTopicItem(
                    topic=f"{g['item']} ({g['category']})",
                    item=g["item"],
                    category=g["category"],
                    meal_type=g["meal"],
                    count=g["count"],
                    average_rating=avg,
                    sentiment_ratio=sentiment_ratio,
                    sample_quotes=g["quotes"],
                )
            )

        topics.sort(key=lambda t: t.count, reverse=True)
        return topics[:10]

    @classmethod
    def _normalize_category(cls, raw: Optional[str]) -> str:
        if not raw:
            return "Food Quality"
        lower = raw.lower()
        if "temp" in lower or "cold" in lower or "hot" in lower:
            return "Food Temperature"
        if "taste" in lower or "flavor" in lower or "salt" in lower or "spice" in lower:
            return "Taste & Flavor"
        if "fresh" in lower or "spoil" in lower or "sour" in lower or "stale" in lower or "rotten" in lower:
            return "Food Freshness & Spoilage"
        if "hygiene" in lower or "clean" in lower or "hair" in lower or "pest" in lower or "insect" in lower or "raw" in lower:
            return "Hygiene & Cleanliness"
        if "portion" in lower or "quantity" in lower or "amount" in lower:
            return "Portion & Quantity"
        if "delay" in lower or "wait" in lower or "slow" in lower or "queue" in lower or "line" in lower:
            return "Serving Delay"
        if "staff" in lower or "behavior" in lower or "rude" in lower or "service" in lower:
            return "Staff Behavior"
        return "Food Quality"
