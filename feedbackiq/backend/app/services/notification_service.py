import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.notification import (
    Notification,
    NotificationType,
    NotificationChannel,
    DeliveryStatus,
)
from app.models.task import ActionTask
from app.models.user import User, UserRole

logger = logging.getLogger("feedbackiq.services.notifications")


class NotificationService:
    """
    Manages in-app notifications and transactional email alerts.
    Enforces delivery confirmation rules: never claims an email is delivered
    unless confirmed by the SMTP/external mail transport provider.
    """

    @classmethod
    async def create_notification(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: str,
        task_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
        target_role: Optional[str] = None,
        recipient_email: Optional[str] = None,
        channel: str = NotificationChannel.IN_APP.value,
    ) -> Notification:
        """
        Creates persistent in-app notification and dispatches email if configured.
        """
        notif = Notification(
            organization_id=organization_id,
            user_id=user_id,
            target_role=target_role,
            title=title,
            message=message,
            notification_type=notification_type,
            task_id=task_id,
            channel=channel,
            is_read=False,
            delivery_status=DeliveryStatus.PENDING.value,
            retry_count=0,
            delivery_details={},
        )
        db.add(notif)
        await db.flush()

        # Handle email delivery if requested
        if channel == NotificationChannel.EMAIL.value or recipient_email:
            delivery_status, delivery_info = await cls._dispatch_email_with_retry(
                recipient_email=recipient_email,
                subject=title,
                body=message,
            )
            notif.delivery_status = delivery_status
            notif.delivery_details = delivery_info
        else:
            notif.delivery_status = DeliveryStatus.DELIVERED.value
            notif.delivery_details = {"channel": "in_app", "confirmed_at": datetime.now(timezone.utc).isoformat()}

        await db.commit()
        await db.refresh(notif)
        return notif

    @classmethod
    async def _dispatch_email_with_retry(
        cls,
        recipient_email: Optional[str],
        subject: str,
        body: str,
        max_retries: int = 2,
    ) -> tuple[str, Dict[str, Any]]:
        """
        Dispatches email through configured SMTP provider with retry handling.
        Does NOT claim delivery if provider is unconfigured or fails.
        """
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_sender = os.getenv("SMTP_SENDER", "notifications@feedbackiq.io")

        if not smtp_host or not recipient_email:
            # Explicitly mark simulated / not delivered
            return DeliveryStatus.SIMULATED.value, {
                "reason": "SMTP host or recipient unconfigured. Simulated offline.",
                "attempted_recipient": recipient_email,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = smtp_sender
        msg["To"] = recipient_email

        last_error = ""
        for attempt in range(1, max_retries + 1):
            try:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as server:
                    if smtp_user and smtp_password:
                        server.starttls()
                        server.login(smtp_user, smtp_password)
                    server.send_message(msg)
                    return DeliveryStatus.DELIVERED.value, {
                        "provider": "smtp",
                        "host": smtp_host,
                        "recipient": recipient_email,
                        "attempt": attempt,
                        "confirmed_at": datetime.now(timezone.utc).isoformat(),
                    }
            except Exception as e:
                last_error = str(e)
                logger.warning(f"SMTP delivery attempt {attempt} failed: {e}")

        return DeliveryStatus.FAILED.value, {
            "error": last_error,
            "attempts": max_retries,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # -------------------------------------------------------------------------
    # High-level Alert Helpers
    # -------------------------------------------------------------------------

    @classmethod
    async def notify_task_assigned(
        cls,
        db: AsyncSession,
        task: ActionTask,
        assignee: User,
    ) -> Notification:
        return await cls.create_notification(
            db=db,
            organization_id=task.organization_id,
            user_id=assignee.id,
            target_role=task.responsible_role,
            recipient_email=assignee.email,
            task_id=task.id,
            title=f"Task Assigned: {task.item or 'Service Issue'} Action",
            message=(
                f"You have been assigned to corrective action for {task.item} "
                f"(Priority: {task.priority_score:.1f}/100, Due: {task.due_date.strftime('%Y-%m-%d') if task.due_date else 'Immediate'}). "
                f"Action: {task.corrective_action}"
            ),
            notification_type=NotificationType.TASK_ASSIGNED.value,
        )

    @classmethod
    async def notify_approval_required(
        cls,
        db: AsyncSession,
        task: ActionTask,
    ) -> Notification:
        return await cls.create_notification(
            db=db,
            organization_id=task.organization_id,
            target_role=task.responsible_role or "org_admin",
            task_id=task.id,
            title=f"Approval Required: {task.item or 'Service Issue'}",
            message=(
                f"Corrective action plan requires management approval ({task.required_approval}). "
                f"Priority: {task.priority_score:.1f}/100. Proposed Action: {task.corrective_action}"
            ),
            notification_type=NotificationType.APPROVAL_REQUIRED.value,
        )

    @classmethod
    async def notify_critical_safety_alert(
        cls,
        db: AsyncSession,
        task: ActionTask,
    ) -> Notification:
        return await cls.create_notification(
            db=db,
            organization_id=task.organization_id,
            target_role="Hygiene Supervisor",
            task_id=task.id,
            title=f"🚨 CRITICAL FOOD SAFETY ALERT: {task.item or 'Kitchen Issue'}",
            message=(
                f"Rule 9 Safety Override active! Critical food safety concern reported for {task.item}. "
                f"Immediate quarantine action required: {task.corrective_action}"
            ),
            notification_type=NotificationType.CRITICAL_SAFETY_ALERT.value,
        )

    @classmethod
    async def notify_deadline_approaching(
        cls,
        db: AsyncSession,
        task: ActionTask,
    ) -> Notification:
        return await cls.create_notification(
            db=db,
            organization_id=task.organization_id,
            user_id=task.assignee_id,
            target_role=task.responsible_role,
            task_id=task.id,
            title=f"Deadline Approaching: {task.item or 'Action Task'}",
            message=(
                f"Action task for {task.item} is due within 24 hours "
                f"(Due: {task.due_date.strftime('%Y-%m-%d') if task.due_date else 'Today'}). Please update status."
            ),
            notification_type=NotificationType.DEADLINE_APPROACHING.value,
        )

    @classmethod
    async def notify_deadline_missed(
        cls,
        db: AsyncSession,
        task: ActionTask,
    ) -> Notification:
        return await cls.create_notification(
            db=db,
            organization_id=task.organization_id,
            user_id=task.assignee_id,
            target_role=task.responsible_role,
            task_id=task.id,
            title=f"⚠️ Overdue Task: {task.item or 'Action Task'}",
            message=(
                f"Action task for {task.item} has passed its due date. "
                f"Immediate attention is required to avoid SLA escalation."
            ),
            notification_type=NotificationType.DEADLINE_MISSED.value,
        )

    @classmethod
    async def notify_investigation_required(
        cls,
        db: AsyncSession,
        task: ActionTask,
    ) -> Notification:
        return await cls.create_notification(
            db=db,
            organization_id=task.organization_id,
            target_role=task.responsible_role,
            task_id=task.id,
            title=f"Investigation Required: {task.item or 'Customer Anomaly'}",
            message=(
                f"Insufficient historical data to determine root cause for {task.item}. "
                f"Please conduct targeted shift monitoring and collect additional samples."
            ),
            notification_type=NotificationType.INVESTIGATION_REQUIRED.value,
        )

    @classmethod
    async def get_notifications(
        cls,
        db: AsyncSession,
        organization_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        is_read: Optional[bool] = None,
        limit: int = 50,
    ) -> List[Notification]:
        query = select(Notification).where(
            Notification.organization_id == organization_id,
        )
        if user_id:
            query = query.where(
                (Notification.user_id == user_id) | (Notification.user_id.is_(None))
            )
        if is_read is not None:
            query = query.where(Notification.is_read == is_read)

        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    @classmethod
    async def mark_as_read(
        cls,
        db: AsyncSession,
        notification_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> bool:
        stmt = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.organization_id == organization_id,
            )
            .values(is_read=True)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0
