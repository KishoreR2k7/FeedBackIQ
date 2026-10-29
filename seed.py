"""Database seed script populating tenants, roles, permissions, users and departments.

RULE 1: Every table has org_id.
RULE 2: Permissions are checked with can(user, perm), roles and permissions are rows.
RULE 6: Argon2 password hashing.
"""

from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.organization import Organization
from app.models.auth import Role, Permission, RolePermission, User
from app.models.department import Department
from app.models.feedback import Feedback
from app.models.task import Task
from app.models.recurring import RecurringIssue
from app.models.verification import Verification


def seed_database():
    db = SessionLocal()
    try:
        print("[*] Seeding FeedbackIQ Database...")
        
        # Check if already seeded
        existing_org = db.query(Organization).filter(Organization.slug == "apex-mess").first()
        if existing_org:
            print("Database already contains seed data. Skipping.")
            return

        now = datetime.now(timezone.utc)

        # 1. Create Organizations (Tenants)
        org1 = Organization(
            name="Apex University Central Mess",
            slug="apex-mess",
            org_type="college_mess",
            settings={
                "theme_color": "#4f46e5",
                "tagline": "Fueling campus minds with quality meals",
                "working_hours": "07:00 - 22:00",
                "auto_triage_enabled": True
            }
        )
        org2 = Organization(
            name="Royal Spice Bistro & Bar",
            slug="royal-spice",
            org_type="restaurant_chain",
            settings={
                "theme_color": "#d97706",
                "tagline": "Exquisite dining & culinary artistry",
                "working_hours": "11:00 - 23:30",
                "auto_triage_enabled": True
            }
        )
        org3 = Organization(
            name="Metro Health Food Services",
            slug="metro-health",
            org_type="hospital",
            settings={
                "theme_color": "#059669",
                "tagline": "Nutritious and clinical patient nutrition",
                "working_hours": "24/7",
                "auto_triage_enabled": True
            }
        )
        db.add_all([org1, org2, org3])
        db.flush()

        org1.org_id = org1.id
        org2.org_id = org2.id
        org3.org_id = org3.id
        db.flush()

        # Combined Permission Catalog (Both Phase 1 dot-notation and legacy colon-notation for backward compatibility)
        permission_defs = [
            ("dashboard.view", "View dashboard analytics and metrics"),
            ("feedback.view", "View feedback stream and details"),
            ("task.view_all", "View all tasks across the organization"),
            ("task.view_dept", "View tasks within own department"),
            ("task.view_own", "View tasks assigned to oneself"),
            ("task.assign", "Assign tasks to team members"),
            ("task.complete", "Resolve or complete operational tasks"),
            ("users.manage", "Manage organization user accounts"),
            ("roles.manage", "Manage roles and permission mappings"),
            ("departments.manage", "Manage organization departments and SLAs"),
            ("locations.manage", "Manage organization locations/outlets"),
            ("settings.edit", "Edit organization settings and preferences"),
            ("export", "Export feedback and operational reports"),
            ("kb.manage", "Manage knowledge base and SOPs"),
            ("chat.use", "Use AI assistant and interactive chat"),
            # Legacy colon permissions
            ("org:manage", "Manage organization settings and billing"),
            ("feedback:view", "View customer feedback stream"),
            ("feedback:submit", "Submit feedback publicly"),
            ("feedback:export", "Export feedback data"),
            ("task:view", "View operational tasks"),
            ("task:create", "Create operational tasks"),
            ("task:assign", "Assign tasks to department employees"),
            ("task:resolve", "Mark operational tasks as resolved"),
            ("recurring:view", "View recurring issue predictions"),
            ("recurring:manage", "Mitigate recurring issue root causes"),
            ("verification:view", "View audit verifications"),
            ("verification:execute", "Conduct fix verification audit"),
            ("report:view", "View analytics reports"),
            ("report:generate", "Trigger AI executive report synthesis"),
            ("agent:run", "Run LangGraph AI pipelines"),
        ]

        for org in [org1, org2, org3]:
            # Seed Default Location
            from app.models.location import Location
            default_loc = Location(
                org_id=org.id,
                name=f"{org.name} - Main Campus Hall",
                code="MAIN-01",
                description="Primary dining hall location",
                is_active=True
            )
            db.add(default_loc)
            db.flush()

            # Seed Permissions for this org
            created_perms = {}
            for code, desc in permission_defs:
                p = Permission(org_id=org.id, code=code, description=desc)
                db.add(p)
                created_perms[code] = p
            db.flush()

            # Seed 4 Standard Roles for this org
            admin_role = Role(org_id=org.id, name="Admin", description="Full administrative rights across all modules")
            manager_role = Role(org_id=org.id, name="Manager", description="Operational manager overseeing all departments")
            dept_head_role = Role(org_id=org.id, name="Department In-Charge", description="Oversees department tasks and staff")
            staff_role = Role(org_id=org.id, name="Employee", description="Executes assigned corrective tasks")
            auditor_role = Role(org_id=org.id, name="Quality Auditor", description="Verifies fixes and audits standards")
            
            db.add_all([admin_role, manager_role, dept_head_role, staff_role, auditor_role])
            db.flush()

            # Assign Permissions to Roles (RolePermission rows with org_id)
            # Admin gets all
            for p in created_perms.values():
                db.add(RolePermission(org_id=org.id, role_id=admin_role.id, permission_id=p.id))

            # Dept Head permissions
            head_perm_codes = [
                "feedback:view", "task:view", "task:create", "task:assign",
                "task:resolve", "recurring:view", "verification:view", "report:view", "agent:run"
            ]
            for code in head_perm_codes:
                db.add(RolePermission(org_id=org.id, role_id=dept_head_role.id, permission_id=created_perms[code].id))

            # Staff permissions
            staff_perm_codes = ["feedback:view", "task:view", "task:resolve"]
            for code in staff_perm_codes:
                db.add(RolePermission(org_id=org.id, role_id=staff_role.id, permission_id=created_perms[code].id))

            # Auditor permissions
            auditor_perm_codes = ["feedback:view", "task:view", "verification:view", "verification:execute", "report:view", "report:generate"]
            for code in auditor_perm_codes:
                db.add(RolePermission(org_id=org.id, role_id=auditor_role.id, permission_id=created_perms[code].id))

            db.flush()

            # Seed Departments
            dept_kitchen = Department(
                org_id=org.id,
                name="Food Quality & Culinary",
                code="food_quality",
                description="Taste, food temperature, freshness, preparation, and menu quality",
                sla_hours_p1=2,
                sla_hours_p2=4,
                sla_hours_p3=12,
                sla_hours_p4=24
            )
            dept_hygiene = Department(
                org_id=org.id,
                name="Hygiene & Sanitation",
                code="hygiene",
                description="Cleanliness of dining area, utensils, food safety, and pest control",
                sla_hours_p1=1,
                sla_hours_p2=3,
                sla_hours_p3=8,
                sla_hours_p4=24
            )
            dept_service = Department(
                org_id=org.id,
                name="Service & Hospitality",
                code="service",
                description="Counter staff behavior, serving speed, queue management",
                sla_hours_p1=3,
                sla_hours_p2=6,
                sla_hours_p3=16,
                sla_hours_p4=36
            )
            dept_facilities = Department(
                org_id=org.id,
                name="Facilities & Infrastructure",
                code="facilities",
                description="Seating, AC, drinking water points, lighting, and ambient noise",
                sla_hours_p1=4,
                sla_hours_p2=8,
                sla_hours_p3=24,
                sla_hours_p4=48
            )
            dept_billing = Department(
                org_id=org.id,
                name="Billing & Administration",
                code="billing",
                description="Payment counters, digital payment issues, token system",
                sla_hours_p1=2,
                sla_hours_p2=6,
                sla_hours_p3=24,
                sla_hours_p4=48
            )
            db.add_all([dept_kitchen, dept_hygiene, dept_service, dept_facilities, dept_billing])
            db.flush()

            # Seed Users (Argon2 hashed)
            admin_user = User(
                org_id=org.id,
                role_id=admin_role.id,
                email=f"admin@{org.slug.replace('-', '')}.com",
                hashed_password=hash_password("AdminPass123!"),
                full_name=f"{org.name} Admin",
                is_active=True,
                is_superuser=True
            )
            head_chef = User(
                org_id=org.id,
                role_id=dept_head_role.id,
                department_id=dept_kitchen.id,
                email=f"chef@{org.slug.replace('-', '')}.com",
                hashed_password=hash_password("StaffPass123!"),
                full_name="Rajesh Sharma (Head Chef)",
                is_active=True
            )
            hygiene_officer = User(
                org_id=org.id,
                role_id=dept_head_role.id,
                department_id=dept_hygiene.id,
                email=f"hygiene@{org.slug.replace('-', '')}.com",
                hashed_password=hash_password("StaffPass123!"),
                full_name="Priya Patel (Hygiene Supervisor)",
                is_active=True
            )
            staff_user = User(
                org_id=org.id,
                role_id=staff_role.id,
                department_id=dept_kitchen.id,
                email=f"staff@{org.slug.replace('-', '')}.com",
                hashed_password=hash_password("StaffPass123!"),
                full_name="Anil Kumar (Station Cook)",
                is_active=True
            )
            db.add_all([admin_user, head_chef, hygiene_officer, staff_user])
            db.flush()

            # Link department in-charges
            dept_kitchen.in_charge_user_id = head_chef.id
            dept_hygiene.in_charge_user_id = hygiene_officer.id
            db.flush()

        # Seed realistic feedback and tasks for Apex Mess (org1)
        fb1 = Feedback(
            org_id=org1.id,
            rating=1,
            raw_text="The sambar at lunch today was completely cold and watery. There was barely any vegetable in it and it tasted sour. Please check kitchen prep!",
            customer_name="Aman Verma",
            customer_contact="aman.v@student.apex.edu",
            channel="qr_code",
            location_table="Mess Hall 2 - Table 14",
            meal_type="lunch",
            category="food_quality",
            department_id=dept_kitchen.id,
            sentiment="negative",
            sentiment_score=-0.75,
            urgency="P2",
            status="actioned",
            ai_analysis={
                "category": "food_quality",
                "sentiment": "negative",
                "urgency": "P2",
                "keywords": ["cold", "watery", "sour", "vegetable"],
                "summary": "Customer complaint regarding cold, watery and sour lunch sambar."
            }
        )
        fb2 = Feedback(
            org_id=org1.id,
            rating=1,
            raw_text="URGENT: Found a small dead insect inside the salad bowl! This is completely unacceptable hygiene. I have taken a photo.",
            customer_name="Neha Joshi",
            customer_contact="neha.j@student.apex.edu",
            channel="web_link",
            location_table="Counter 3",
            meal_type="dinner",
            category="hygiene",
            department_id=dept_hygiene.id,
            sentiment="critical",
            sentiment_score=-0.95,
            urgency="P1",
            status="actioned",
            ai_analysis={
                "category": "hygiene",
                "sentiment": "critical",
                "urgency": "P1",
                "keywords": ["insect", "salad bowl", "unacceptable hygiene"],
                "summary": "Critical health alert: foreign object/insect discovered in salad station."
            }
        )
        fb3 = Feedback(
            org_id=org1.id,
            rating=5,
            raw_text="The special Sunday biryani was incredible! Flavorful spices, tender paneer, and the raita was chilled and fresh. Keep it up!",
            customer_name="Kavita Rao",
            channel="qr_code",
            location_table="Table 8",
            meal_type="lunch",
            category="food_quality",
            department_id=dept_kitchen.id,
            sentiment="positive",
            sentiment_score=0.9,
            urgency="P4",
            status="resolved",
            ai_analysis={
                "category": "food_quality",
                "sentiment": "positive",
                "urgency": "P4",
                "keywords": ["biryani", "incredible", "fresh", "flavorful"],
                "summary": "High commendation for Sunday special lunch menu."
            }
        )
        db.add_all([fb1, fb2, fb3])
        db.flush()

        # Operational Tasks with Code-computed SLAs (Rule 3)
        task1 = Task(
            org_id=org1.id,
            feedback_id=fb1.id,
            department_id=dept_kitchen.id,
            assigned_to_user_id=head_chef.id,
            title="Inspect Sambar Temperature & Holding Station",
            description="Verify Bain-marie holding temperature (minimum 65°C) and recipe adherence for lunch dal/sambar.",
            priority="P2",
            status="in_progress",
            due_at=now + timedelta(hours=4),
            sla_breached=False
        )
        task2 = Task(
            org_id=org1.id,
            feedback_id=fb2.id,
            department_id=dept_hygiene.id,
            assigned_to_user_id=hygiene_officer.id,
            title="Immediate Salad Bar Deep Sanitization & Pest Audit",
            description="Discard current salad batch, sanitize chilling counter, and inspect produce washing area for insect contamination.",
            priority="P1",
            status="resolved",
            due_at=now - timedelta(hours=1),
            resolved_at=now - timedelta(minutes=30),
            resolution_notes="Disposed salad counter items, performed triple-wash on fresh batch with food-grade sanitizing wash, scheduled pest control booster.",
            sla_breached=False
        )
        db.add_all([task1, task2])
        db.flush()

        # Quality Verification for resolved Task 2
        verif = Verification(
            org_id=org1.id,
            task_id=task2.id,
            verified_by_user_id=admin_user.id,
            status="passed",
            before_sentiment_score=-0.95,
            after_sentiment_score=0.85,
            audit_notes="On-site verification passed: Produce wash logs updated and ultraviolet fly catcher activated.",
            recurrence_detected=False
        )
        db.add(verif)

        # Recurring Issue Prediction
        recurring = RecurringIssue(
            org_id=org1.id,
            department_id=dept_kitchen.id,
            issue_fingerprint="lunch_sambar_temperature_variance",
            title="Recurring Soup & Dal Temperature Drop at Peak Lunch",
            frequency_count=4,
            predicted_root_cause="Steam tables are turned down too early during 1:15 PM peak crowd influx.",
            recommended_action="Keep Bain-marie elements at Level 3 until 2:00 PM and take half-hourly probe thermometer readings.",
            status="active",
            evidence_feedback_ids=[fb1.id],
            last_occurred_at=now
        )
        db.add(recurring)

        db.commit()
        print("[SUCCESS] FeedbackIQ Database Seeded Successfully!")
        print("   Organizations: Apex University Central Mess, Royal Spice Bistro, Metro Health")
        print("   Default Admin: admin@apexmess.com / AdminPass123!")
        print("   Chef User:     chef@apexmess.com / StaffPass123!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
