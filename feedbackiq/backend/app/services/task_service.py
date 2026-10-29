import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.task import (
    ActionTask,
    TaskStatus,
    TaskApprovalStatus,
    VerificationOutcome,
)
from app.models.user import User, UserRole
from app.schemas.task import (
    ActionRecommendationOutput,
    TaskFilterParams,
    TaskApprovalRequest,
    TaskAssignRequest,
    TaskStatusUpdateRequest,
    VerificationResultResponse,
)
from app.schemas.intelligence import PrioritizedIssueItem
from app.agents.action_recommendation_agent import ActionRecommendationAgent
from app.services.notification_service import NotificationService
from app.services.verification_service import VerificationService

logger = logging.getLogger("feedbackiq.services.tasks")


class TaskService:
    """
    Core lifecycle and governance service for Prioritized Action Tasks.
    Enforces role-based approvals, idempotency deduping, and verification.
    """

    AUTHORIZED_MANAGERS = {
        UserRole.SUPER_ADMIN,
        UserRole.ORG_ADMIN,
        UserRole.QUALITY_REVIEWER,
    }

    @classmethod
    def compute_fingerprint(cls, org_id: uuid.UUID, cluster_key: str) -> str:
        """Deterministic fingerprint preventing duplicate tasks across retries."""
        raw = f"{org_id}:{cluster_key}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @classmethod
    async def generate_tasks_for_prioritized_issues(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        prioritized_items: List[PrioritizedIssueItem],
    ) -> List[ActionTask]:
        """
        Synthesizes structured action tasks from prioritized issues.
        Enforces idempotency: updates existing open tasks rather than duplicating them.
        """
        generated_tasks: List[ActionTask] = []
        now = datetime.now(timezone.utc)

        for issue in prioritized_items:
            fingerprint = cls.compute_fingerprint(organization_id, issue.issue_cluster_key)

            # Check if active task already exists for this cluster
            stmt = select(ActionTask).where(
                ActionTask.organization_id == organization_id,
                ActionTask.dedup_fingerprint == fingerprint,
            )
            res = await db.execute(stmt)
            existing_task = res.scalars().first()

            # Run Action Recommendation Agent
            rec = await ActionRecommendationAgent.recommend_for_issue(issue)

            due_date = now + timedelta(days=rec.suggested_deadline_days)
            needs_approval = "approval" in rec.required_approval.lower()

            init_status = (
                TaskStatus.AWAITING_APPROVAL.value
                if needs_approval
                else TaskStatus.PROPOSED.value
            )
            init_approval = (
                TaskApprovalStatus.AWAITING_APPROVAL.value
                if needs_approval
                else TaskApprovalStatus.PROPOSED.value
            )

            if existing_task:
                # Update existing task if not already completed/verified
                if existing_task.status not in [TaskStatus.COMPLETED.value, TaskStatus.VERIFIED.value]:
                    existing_task.priority_score = issue.priority_score
                    existing_task.risk_level = issue.risk_level
                    existing_task.is_safety_override = issue.is_safety_override
                    existing_task.issue_summary = rec.issue_summary
                    existing_task.evidence_and_priority_reason = rec.evidence_and_priority_reason
                    existing_task.corrective_action = rec.suggested_corrective_action
                    existing_task.preventive_action = rec.suggested_preventive_action
                    existing_task.responsible_role = rec.responsible_role
                    existing_task.estimated_effort = rec.estimated_effort
                    existing_task.verification_criteria = rec.verification_criteria
                    existing_task.expected_outcome = rec.expected_outcome
                    await db.flush()
                    generated_tasks.append(existing_task)
                    continue

            # Create fresh task entity
            task = ActionTask(
                organization_id=organization_id,
                issue_cluster_key=issue.issue_cluster_key,
                item=issue.item,
                issue_category=issue.issue_category,
                meal_type=issue.meal_type,
                priority_score=issue.priority_score,
                risk_level=issue.risk_level,
                is_safety_override=issue.is_safety_override,
                issue_summary=rec.issue_summary,
                evidence_and_priority_reason=rec.evidence_and_priority_reason,
                corrective_action=rec.suggested_corrective_action,
                preventive_action=rec.suggested_preventive_action,
                responsible_role=rec.responsible_role,
                due_date=due_date,
                required_approval=rec.required_approval,
                approval_status=init_approval,
                status=init_status,
                estimated_effort=rec.estimated_effort,
                verification_criteria=rec.verification_criteria,
                expected_outcome=rec.expected_outcome,
                verification_status=VerificationOutcome.PENDING.value,
                dedup_fingerprint=fingerprint,
            )
            db.add(task)
            await db.flush()
            generated_tasks.append(task)

            # Trigger automated lifecycle notifications
            if issue.is_safety_override:
                await NotificationService.notify_critical_safety_alert(db, task)
            elif needs_approval:
                await NotificationService.notify_approval_required(db, task)
            elif issue.risk_level == "Insufficient Evidence":
                await NotificationService.notify_investigation_required(db, task)

        await db.commit()
        return generated_tasks

    @classmethod
    async def get_tasks(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        filters: Optional[TaskFilterParams] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ActionTask]:
        """Queries action tasks with multi-dimensional filtering."""
        query = select(ActionTask).where(
            ActionTask.organization_id == organization_id,
        )

        if filters:
            if filters.status:
                query = query.where(ActionTask.status == filters.status)
            if filters.approval_status:
                query = query.where(ActionTask.approval_status == filters.approval_status)
            if filters.risk_level:
                query = query.where(ActionTask.risk_level == filters.risk_level)
            if filters.responsible_role:
                query = query.where(ActionTask.responsible_role.ilike(f"%{filters.responsible_role}%"))
            if filters.assignee_id:
                query = query.where(ActionTask.assignee_id == filters.assignee_id)
            if filters.item:
                query = query.where(ActionTask.item.ilike(f"%{filters.item}%"))
            if filters.issue_category:
                query = query.where(ActionTask.issue_category.ilike(f"%{filters.issue_category}%"))
            if filters.date_from:
                query = query.where(ActionTask.created_at >= filters.date_from)
            if filters.date_to:
                query = query.where(ActionTask.created_at <= filters.date_to)

        # Order by safety overrides first, then highest priority score
        query = query.order_by(ActionTask.is_safety_override.desc(), ActionTask.priority_score.desc())
        query = query.limit(limit).offset(offset)

        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def get_task_by_id(
        cls,
        db: AsyncSession,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> ActionTask:
        stmt = select(ActionTask).where(
            ActionTask.id == task_id,
            ActionTask.organization_id == organization_id,
        )
        res = await db.execute(stmt)
        task = res.scalars().first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Action task {task_id} not found in this organization",
            )
        return task

    @classmethod
    async def approve_task(
        cls,
        db: AsyncSession,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        user: User,
        request: TaskApprovalRequest,
    ) -> ActionTask:
        """
        Enforces manager permissions before approving or rejecting a task.
        """
        if user.role not in cls.AUTHORIZED_MANAGERS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{user.role.value}' is unauthorized to approve or reject action plans.",
            )

        task = await cls.get_task_by_id(db, task_id, organization_id)

        if request.approved:
            task.approval_status = TaskApprovalStatus.APPROVED.value
            # If an assignee was specified during approval, assign it
            if request.assignee_id:
                task.assignee_id = request.assignee_id
                task.assignee_name = request.assignee_name
                task.status = TaskStatus.ASSIGNED.value
            else:
                task.status = TaskStatus.ASSIGNED.value if task.assignee_id else TaskStatus.PROPOSED.value

            if request.modified_due_date:
                task.due_date = request.modified_due_date
        else:
            task.approval_status = TaskApprovalStatus.REJECTED.value
            task.status = TaskStatus.REJECTED.value
            if request.rejection_reason:
                task.completion_notes = f"Rejection Note: {request.rejection_reason}"

        await db.commit()
        await db.refresh(task)
        return task

    @classmethod
    async def assign_task(
        cls,
        db: AsyncSession,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        manager_user: User,
        request: TaskAssignRequest,
    ) -> ActionTask:
        """
        Assigns an action task to a specific staff member with due date.
        Enforces manager role authorization.
        """
        if manager_user.role not in cls.AUTHORIZED_MANAGERS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{manager_user.role.value}' cannot assign tasks. Manager permissions required.",
            )

        task = await cls.get_task_by_id(db, task_id, organization_id)

        # Lookup assignee user
        stmt = select(User).where(User.id == request.assignee_id)
        res = await db.execute(stmt)
        assignee = res.scalars().first()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assignee user {request.assignee_id} not found",
            )

        task.assignee_id = assignee.id
        task.assignee_name = request.assignee_name or assignee.full_name
        if request.due_date:
            task.due_date = request.due_date
        task.status = TaskStatus.ASSIGNED.value

        # Automatically dispatch assignment notification
        await NotificationService.notify_task_assigned(db, task, assignee)

        await db.commit()
        await db.refresh(task)
        return task

    @classmethod
    async def update_task_status(
        cls,
        db: AsyncSession,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        user: User,
        request: TaskStatusUpdateRequest,
    ) -> ActionTask:
        """
        Allows staff to advance tasks through lifecycle: in_progress -> completed.
        """
        task = await cls.get_task_by_id(db, task_id, organization_id)

        task.status = request.status
        if request.completion_notes:
            task.completion_notes = request.completion_notes

        if request.status == TaskStatus.COMPLETED.value:
            task.completed_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(task)
        return task

    @classmethod
    async def verify_task(
        cls,
        db: AsyncSession,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        window_days: int = 7,
    ) -> VerificationResultResponse:
        """
        Runs empirical verification comparing feedback before and after action execution.
        """
        task = await cls.get_task_by_id(db, task_id, organization_id)

        outcome_res = await VerificationService.evaluate_task_outcome(
            db=db,
            task=task,
            window_days=window_days,
        )

        task.verification_status = outcome_res.verification_status
        task.verification_results = outcome_res.model_dump()
        task.verified_at = datetime.now(timezone.utc)

        if outcome_res.verification_status == VerificationOutcome.IMPROVED.value:
            task.status = TaskStatus.VERIFIED.value

        await db.commit()
        await db.refresh(task)
        return outcome_res
