"""Background job scheduler using APScheduler for SLA audits and anomaly clustering."""

import logging
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import SessionLocal
from app.models.task import Task
from app.models.organization import Organization

logger = logging.getLogger("feedbackiq.scheduler")

scheduler = BackgroundScheduler()


def audit_sla_breaches():
    """Periodic job scanning open tasks and flagging SLA breaches (Rule 3)."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        breached_tasks = (
            db.query(Task)
            .filter(
                Task.status.in_(["pending", "in_progress"]),
                Task.due_at < now,
                Task.sla_breached == False
            )
            .all()
        )
        for t in breached_tasks:
            t.sla_breached = True
            logger.warning(f"SLA BREACH: Task #{t.id} '{t.title}' in org #{t.org_id} has exceeded deadline.")
        
        if breached_tasks:
            db.commit()
            logger.info(f"Audited SLA: {len(breached_tasks)} tasks flagged as breached.")
    except Exception as e:
        logger.error(f"Error during SLA breach audit: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start APScheduler background jobs."""
    if not scheduler.running:
        scheduler.add_job(
            audit_sla_breaches,
            trigger=IntervalTrigger(minutes=5),
            id="audit_sla_breaches",
            name="Check and flag operational SLA breaches",
            replace_existing=True
        )
        scheduler.start()
        logger.info("FeedbackIQ APScheduler initialized and running.")


def stop_scheduler():
    """Gracefully shut down background scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("FeedbackIQ APScheduler stopped.")
