"""
FeedbackIQ - Reproducible Demonstration Dataset Seeder
Seeds standard organizations, realistic student canteen recurring issue scenarios,
external benchmark Zomato reviews, and executes the complete intelligence pipeline.
"""
import asyncio
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.models.organization import Organization
from app.models.location import Location
from app.models.feedback import Feedback
from app.models.task import ActionTask, TaskStatus
from app.services.feedback_service import FeedbackService
from app.services.intelligence_service import IntelligenceService
from app.services.task_service import TaskService


def compute_hash(org_id: uuid.UUID, date_str: str, item: str, comment: str) -> str:
    raw = f"{org_id}:{date_str}:{item}:{comment}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def seed():
    print("================================================================")
    print("FeedbackIQ: Seeding PS 2.5 Demonstration Scenarios & Canteen Data")
    print("================================================================")

    async with AsyncSessionLocal() as db:
        # 1. Organization & Location
        org_slug = "bit-dining"
        res = await db.execute(select(Organization).where(Organization.slug == org_slug))
        org = res.scalars().first()

        from app.models.organization import OrgTemplateType
        if not org:
            org = Organization(
                name="Bangalore Institute of Technology - Dining Hall",
                slug=org_slug,
                template_type=OrgTemplateType.COLLEGE,
                settings={
                    "feedback_channels": ["student_form", "complaint_box", "qr_scan"],
                    "service_slots": ["Breakfast", "Lunch", "Evening Snacks", "Dinner"],
                    "alert_threshold": 3,
                },
                is_active=True,
            )
            db.add(org)
            await db.commit()
            await db.refresh(org)
            print(f"Created Tenant: {org.name} ({org.id})")
        else:
            print(f"Found Existing Tenant: {org.name} ({org.id})")

        # Location
        loc_stmt = select(Location).where(Location.organization_id == org.id)
        loc_res = await db.execute(loc_stmt)
        loc = loc_res.scalars().first()
        if not loc:
            loc = Location(
                organization_id=org.id,
                name="Central Mess Hall Station B",
                code="CENTRAL-B",
                location_type="dining_hall",
                is_active=True,
            )
            db.add(loc)
            await db.commit()
            await db.refresh(loc)

        # 2. Reproducible Historical Student Canteen Feedback Scenarios
        now = datetime.now(timezone.utc)
        demo_feedbacks = []

        # Scenario 1 & 2: Recurring Cold Rice / Sambar complaints during Lunch across multiple dates
        cold_dates = [
            now - timedelta(days=12, hours=2),
            now - timedelta(days=10, hours=1),
            now - timedelta(days=8, hours=2),
            now - timedelta(days=5, hours=1),
            now - timedelta(days=3, hours=2),
            now - timedelta(days=1, hours=1),
        ]
        cold_comments = [
            "The rice was cold again during lunch. This is happening almost every day.",
            "Rice and sambar were completely cold at Station B by 1:15 PM.",
            "Lukewarm rice served today. Please check the steam table warmers.",
            "Cold rice again. Ruins the entire lunch meal.",
            "Rice is cold and dry. Third time this week.",
            "Rice was freezing cold by 1:30 PM. Needs immediate attention.",
        ]
        for i, dt in enumerate(cold_dates):
            cmt = cold_comments[i % len(cold_comments)]
            demo_feedbacks.append({
                "feedback_id": f"FB-STUDENT-COLD-{100 + i}",
                "organization_id": org.id,
                "location_id": loc.id,
                "date": dt,
                "meal_type": "Lunch",
                "item": "Rice",
                "rating": 1 if i % 2 == 0 else 2,
                "comment": cmt,
                "channel": "student_form",
                "issue_category": "Food Temperature",
                "source_dataset": "canteen_form",
                "content_hash": compute_hash(org.id, dt.isoformat(), "Rice", cmt),
            })

        # Scenario 3: Critical Food Safety Incident - Undercooked / Pink Chicken on Friday Lunch
        safety_dates = [
            now - timedelta(days=7, hours=2),
            now - timedelta(days=7, hours=1),
            now - timedelta(days=2, hours=2),
        ]
        safety_comments = [
            "Chicken was pink and raw near the bone! Major food poisoning hazard.",
            "Found raw chicken in the Friday biryani batch! Chef is undercooking meat.",
            "Undercooked chicken served at lunch. Blood near the bone. Extremely unsafe!",
        ]
        for i, dt in enumerate(safety_dates):
            cmt = safety_comments[i]
            demo_feedbacks.append({
                "feedback_id": f"FB-STUDENT-SAFETY-{200 + i}",
                "organization_id": org.id,
                "location_id": loc.id,
                "date": dt,
                "meal_type": "Lunch",
                "item": "Chicken Biryani",
                "rating": 1,
                "comment": cmt,
                "channel": "complaint",
                "issue_category": "Hygiene & Cleanliness",
                "source_dataset": "canteen_form",
                "content_hash": compute_hash(org.id, dt.isoformat(), "Chicken Biryani", cmt),
            })

        # Scenario 4: Positive Student Feedback
        pos_items = [
            ("Masala Dosa", "Breakfast", "Dosa was crispy, golden, and potato masala was piping hot. Loved it!", 5),
            ("Filter Coffee", "Breakfast", "Excellent strong filter coffee to start the morning classes.", 5),
            ("Paneer Butter Masala", "Dinner", "Very soft paneer and rich gravy tonight. Great improvement!", 5),
            ("Poha", "Breakfast", "Poha was light, fresh with roasted peanuts. Healthy breakfast.", 4),
            ("Chapati", "Lunch", "Chapatis were fresh and soft right off the tawa.", 4),
        ]
        for i, (item, meal, cmt, rat) in enumerate(pos_items):
            dt = now - timedelta(days=i + 1, hours=3)
            demo_feedbacks.append({
                "feedback_id": f"FB-STUDENT-POS-{300 + i}",
                "organization_id": org.id,
                "location_id": loc.id,
                "date": dt,
                "meal_type": meal,
                "item": item,
                "rating": rat,
                "comment": cmt,
                "channel": "student_form",
                "issue_category": None,
                "source_dataset": "canteen_form",
                "content_hash": compute_hash(org.id, dt.isoformat(), item, cmt),
            })

        # Scenario 5: Taste & Flavor - Salty Dal Tadka on Tuesdays
        salt_dates = [
            now - timedelta(days=14, hours=2),
            now - timedelta(days=9, hours=2),
            now - timedelta(days=2, hours=1),
        ]
        salt_comments = [
            "Dal tadka was way too salty today. Please taste before serving.",
            "Excessive salt in the yellow dal during Tuesday lunch.",
            "Dal was very salty again. Had to drink two cups of water.",
        ]
        for i, dt in enumerate(salt_dates):
            cmt = salt_comments[i]
            demo_feedbacks.append({
                "feedback_id": f"FB-STUDENT-SALT-{400 + i}",
                "organization_id": org.id,
                "location_id": loc.id,
                "date": dt,
                "meal_type": "Lunch",
                "item": "Dal Tadka",
                "rating": 2,
                "comment": cmt,
                "channel": "student_form",
                "issue_category": "Taste & Flavor",
                "source_dataset": "canteen_form",
                "content_hash": compute_hash(org.id, dt.isoformat(), "Dal Tadka", cmt),
            })

        # Scenario 6: Insufficient Data / Isolated Complaint
        iso_dt = now - timedelta(hours=5)
        iso_cmt = "First time trying the special Gulab Jamun, tasted a bit too sweet for my liking."
        demo_feedbacks.append({
            "feedback_id": "FB-STUDENT-ISO-501",
            "organization_id": org.id,
            "location_id": loc.id,
            "date": iso_dt,
            "meal_type": "Dinner",
            "item": "Gulab Jamun",
            "rating": 3,
            "comment": iso_cmt,
            "channel": "student_form",
            "issue_category": "Taste & Flavor",
            "source_dataset": "canteen_form",
            "content_hash": compute_hash(org.id, iso_dt.isoformat(), "Gulab Jamun", iso_cmt),
        })

        # Scenario 7: External Benchmark Data - Zomato Bangalore Kaggle Reviews (Distinctly labeled!)
        zomato_samples = [
            ("Empire Restaurant", "Chicken Kabab", 4, "Great food and quick service, loved the grill chicken.", "zomato_bangalore"),
            ("Meghana Foods", "Biryani", 5, "Best spicy biryani in Bangalore. Generous portions.", "zomato_bangalore"),
            ("A2B Veg", "Filter Coffee", 2, "Crowded restaurant and cold coffee served.", "zomato_bangalore"),
        ]
        for i, (rest, dish, rat, cmt, src) in enumerate(zomato_samples):
            dt = now - timedelta(days=20 + i)
            demo_feedbacks.append({
                "feedback_id": f"ZOM-KAGGLE-{600 + i}",
                "organization_id": org.id,
                "location_id": None,
                "date": dt,
                "meal_type": None,  # Do not invent meal type for Zomato
                "item": dish,
                "rating": rat,
                "comment": f"[{rest}] {cmt}",
                "channel": "zomato_review",
                "issue_category": None,
                "source_dataset": src,
                "content_hash": compute_hash(org.id, dt.isoformat(), dish, cmt),
            })

        # Check existing hashes to insert idempotently
        hash_stmt = select(Feedback.content_hash).where(Feedback.organization_id == org.id)
        existing_hashes = set((await db.execute(hash_stmt)).scalars().all())

        new_entities = []
        for d in demo_feedbacks:
            if d["content_hash"] not in existing_hashes:
                existing_hashes.add(d["content_hash"])
                fb = Feedback(**d)
                new_entities.append(fb)
                db.add(fb)

        if new_entities:
            await db.commit()
            print(f"Persisted {len(new_entities)} new student canteen and benchmark records.")
        else:
            print("Feedback records already populated.")

        # 3. Execute AI Analysis Pipeline on Unanalyzed Feedback
        stmt = (
            select(Feedback)
            .options(selectinload(Feedback.analysis))
            .where(Feedback.organization_id == org.id)
        )
        all_feedbacks = (await db.execute(stmt)).scalars().all()
        unanalyzed = [f for f in all_feedbacks if f.analysis is None]
        print(f"Found {len(unanalyzed)} unanalyzed feedback records. Running AI Analyzer Agent...")

        for fb in unanalyzed:
            try:
                await FeedbackService.analyze_feedback_item(db, fb)
            except Exception as e:
                print(f"Analysis notice for {fb.feedback_id}: {e}")

        # 4. Run LangGraph Recurrence Reasoning & Priority Scoring Workflow
        print("Running LangGraph Recurrence Reasoning & Priority Scoring Pipeline...")
        prioritized_items = await IntelligenceService.assess_and_prioritize_all(
            db=db,
            organization_id=org.id,
            recent_days=7,
        )
        print(f"Generated {len(prioritized_items)} prioritized issue assessments.")
        for item in prioritized_items[:4]:
            override_tag = " [RULE 9 SAFETY OVERRIDE]" if item.is_safety_override else ""
            print(f"  -> {item.item} ({item.issue_category}) | Score: {item.priority_score:.1f} | Risk: {item.risk_level}{override_tag}")

        # 5. Generate CAPA Action Tasks
        print("Synthesizing Corrective and Preventive Action (CAPA) Tasks...")
        tasks = await TaskService.generate_tasks_for_prioritized_issues(
            db=db,
            organization_id=org.id,
            prioritized_items=prioritized_items,
        )
        print(f"Synthesized {len(tasks)} action tasks.")

        # 6. Simulate Lifecycle on One Task: Assign & Resolve with Notes
        if tasks:
            task_to_assign = tasks[0]
            task_to_assign.status = TaskStatus.IN_PROGRESS.value
            task_to_assign.assignee_name = "Chef Suresh (Executive Canteen Lead)"
            task_to_assign.completion_notes = "Calibrated bain-marie temperature to 65C and mandated hourly temperature logs."
            await db.commit()
            print(f"Updated Task '{task_to_assign.issue_summary[:40]}...' to IN_PROGRESS with resolution notes.")

    print("================================================================")
    print("Seeding Complete! All PS 2.5 Scenarios Are Demonstrable.")
    print("================================================================")


if __name__ == "__main__":
    asyncio.run(seed())
