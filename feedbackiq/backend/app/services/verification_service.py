import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.feedback import Feedback
from app.models.task import ActionTask, VerificationOutcome
from app.schemas.task import VerificationResultResponse

logger = logging.getLogger("feedbackiq.services.verification")


class VerificationService:
    """
    Evaluates operational outcomes by comparing relevant feedback before and after corrective actions.
    Explicitly uses non-causal statistical correlation framing.
    """

    NON_CAUSAL_DISCLAIMER = (
        "Statistical observation note: This outcome assessment compares customer feedback metrics "
        "across equal time horizons before and after corrective action completion. A measured improvement "
        "or worsening reflects temporal correlation and does not statistically prove sole causality, as external "
        "factors (such as catering menu variations, attendance fluctuations, or weather) may also contribute."
    )

    @classmethod
    async def evaluate_task_outcome(
        cls,
        db: AsyncSession,
        task: ActionTask,
        window_days: int = 7,
    ) -> VerificationResultResponse:
        """
        Compares relevant feedback before and after corrective action execution.
        Returns one of: Improved, No Clear Improvement, Worsened, or Insufficient Evidence.
        """
        # Intervention reference point: task completion time (fallback to task creation)
        completion_ref = task.completed_at or task.updated_at or task.created_at
        if completion_ref.tzinfo is None:
            completion_ref = completion_ref.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)

        # Pre-window: [completion_ref - window_days, completion_ref]
        pre_start = completion_ref - timedelta(days=window_days)
        pre_end = completion_ref

        # Post-window: [completion_ref, min(now, completion_ref + window_days)]
        post_start = completion_ref
        post_end = min(now, completion_ref + timedelta(days=window_days))

        # Query relevant feedback matching cluster key components
        query = select(Feedback).options(selectinload(Feedback.analysis)).where(
            Feedback.organization_id == task.organization_id,
        )

        if task.item:
            query = query.where(Feedback.item.ilike(f"%{task.item}%"))
        if task.issue_category:
            query = query.where(Feedback.issue_category.ilike(f"%{task.issue_category}%"))
        if task.meal_type:
            query = query.where(Feedback.meal_type == task.meal_type)

        result = await db.execute(query)
        feedbacks = result.scalars().all()

        pre_feedbacks: List[Feedback] = []
        post_feedbacks: List[Feedback] = []

        for fb in feedbacks:
            fb_date = fb.date or fb.created_at
            if fb_date:
                if fb_date.tzinfo is None:
                    fb_date = fb_date.replace(tzinfo=timezone.utc)

                if pre_start <= fb_date < pre_end:
                    pre_feedbacks.append(fb)
                elif post_start <= fb_date <= post_end:
                    post_feedbacks.append(fb)

        # Calculate pre-action metrics
        pre_complaints, pre_avg_rating = cls._compute_metrics(pre_feedbacks)
        post_complaints, post_avg_rating = cls._compute_metrics(post_feedbacks)

        # Calculate percentage change in complaints
        complaint_change_percent: Optional[float] = None
        if pre_complaints > 0:
            diff = post_complaints - pre_complaints
            complaint_change_percent = round((diff / pre_complaints) * 100.0, 1)

        # Evaluate outcome
        outcome = cls._determine_outcome(
            pre_count=len(pre_feedbacks),
            pre_complaints=pre_complaints,
            pre_rating=pre_avg_rating,
            post_count=len(post_feedbacks),
            post_complaints=post_complaints,
            post_rating=post_avg_rating,
        )

        return VerificationResultResponse(
            task_id=task.id,
            verification_status=outcome,
            pre_action_complaints=pre_complaints,
            post_action_complaints=post_complaints,
            complaint_change_percent=complaint_change_percent,
            pre_action_avg_rating=pre_avg_rating,
            post_action_avg_rating=post_avg_rating,
            pre_window_days=window_days,
            post_window_days=max(1, (post_end.date() - post_start.date()).days),
            non_causal_explanation=cls.NON_CAUSAL_DISCLAIMER,
        )

    @classmethod
    def _compute_metrics(cls, feedback_list: List[Feedback]) -> Tuple[int, Optional[float]]:
        complaint_count = 0
        ratings: List[int] = []

        for fb in feedback_list:
            if fb.rating is not None:
                ratings.append(fb.rating)

            is_complaint = False
            if fb.analysis:
                if fb.analysis.sentiment in ["negative", "mixed"] or fb.analysis.severity_score >= 3:
                    is_complaint = True
            if fb.rating is not None and fb.rating <= 2:
                is_complaint = True

            if is_complaint:
                complaint_count += 1

        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None
        return complaint_count, avg_rating

    @classmethod
    def _determine_outcome(
        cls,
        pre_count: int,
        pre_complaints: int,
        pre_rating: Optional[float],
        post_count: int,
        post_complaints: int,
        post_rating: Optional[float],
    ) -> str:
        # If very few post-intervention data points exist, do not extrapolate
        if post_count == 0 or (pre_complaints == 0 and post_count < 2):
            return VerificationOutcome.INSUFFICIENT_EVIDENCE.value

        # Clear improvement: complaints decreased
        if post_complaints < pre_complaints:
            # If ratings exist, verify ratings didn't significantly crash
            if post_rating is not None and pre_rating is not None and post_rating < (pre_rating - 0.7):
                return VerificationOutcome.NO_CLEAR_IMPROVEMENT.value
            return VerificationOutcome.IMPROVED.value

        # Worsened: complaints increased
        if post_complaints > pre_complaints:
            return VerificationOutcome.WORSENED.value

        # Same complaint count
        if post_complaints == pre_complaints:
            if post_rating is not None and pre_rating is not None:
                if post_rating >= pre_rating + 0.5:
                    return VerificationOutcome.IMPROVED.value
                elif post_rating <= pre_rating - 0.5:
                    return VerificationOutcome.WORSENED.value
            return VerificationOutcome.NO_CLEAR_IMPROVEMENT.value

        return VerificationOutcome.INSUFFICIENT_EVIDENCE.value
