"""Tenant onboarding and atomic signup service enforcing Rule 1, 2 & 4."""

import re
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.permissions import (
    PERMISSION_CATALOG,
    DASHBOARD_VIEW,
    FEEDBACK_VIEW,
    TASK_VIEW_ALL,
    TASK_VIEW_DEPT,
    TASK_VIEW_OWN,
    TASK_ASSIGN,
    TASK_COMPLETE,
    USERS_MANAGE,
    ROLES_MANAGE,
    DEPARTMENTS_MANAGE,
    LOCATIONS_MANAGE,
    SETTINGS_EDIT,
    EXPORT,
    KB_MANAGE,
    CHAT_USE,
)
from app.models.organization import Organization
from app.models.auth import Role, Permission, RolePermission, User
from app.models.department import Department
from app.models.location import Location
from app.models.audit import AuditLog


TEMPLATES: Dict[str, Dict[str, Any]] = {
    "college_mess": {
        "org_type": "college_mess",
        "label": "College Mess / Campus Dining",
        "departments": [
            {
                "name": "Kitchen",
                "code": "KITCHEN",
                "description": "Food preparation, cooking standards, recipe fidelity, meal temperature, freshness of ingredients, taste, menu execution, raw provisions, kitchen inventory, and culinary staff operations."
            },
            {
                "name": "Housekeeping",
                "code": "HOUSEKEEPING",
                "description": "Cleanliness of dining hall, pest control, dishwashing hygiene, waste disposal, floor cleaning, table sanitization, and washroom sanitation."
            },
            {
                "name": "Service",
                "code": "SERVICE",
                "description": "Dining line queuing, counter speed, portion distribution, staff courtesy, meal timings, tray availability, crowd management, and student service experience."
            },
            {
                "name": "Quality & Safety",
                "code": "QUALITY_SAFETY",
                "description": "Food safety compliance, foreign object inspection, allergy warnings, nutritional balance, water testing, health audits, and food temperature logs."
            },
            {
                "name": "Management",
                "code": "MANAGEMENT",
                "description": "Billing, mess card registration, menu planning, policy decisions, student committee feedback, vendor contracts, operational budget, and overall facility administration."
            }
        ],
        "default_location": "Central Dining Hall"
    },
    "restaurant": {
        "org_type": "restaurant_chain",
        "label": "Restaurant / Eatery Chain",
        "departments": [
            {
                "name": "Kitchen",
                "code": "KITCHEN",
                "description": "Cooking execution, taste consistency, plating standards, food preparation speed, ingredient freshness, allergy compliance, recipe accuracy, and kitchen sanitation."
            },
            {
                "name": "Front of House",
                "code": "FRONT_OF_HOUSE",
                "description": "Host greeting, table seating, waiter courtesy, ambiance, music volume, air conditioning, order taking, dine-in service speed, and billing accuracy."
            },
            {
                "name": "Delivery & Packaging",
                "code": "DELIVERY_PACKAGING",
                "description": "Takeaway packing, thermal insulation, spill-proof packaging, delivery partner coordination, dispatch timeliness, cutlery inclusion, and parcel labeling."
            },
            {
                "name": "Hygiene & Safety",
                "code": "HYGIENE_SAFETY",
                "description": "Table sanitization, handwash amenities, restroom cleanliness, kitchen hygiene audits, food handler certificates, pest prevention, and health protocols."
            },
            {
                "name": "Management",
                "code": "MANAGEMENT",
                "description": "Pricing, guest relations, reservations, staff scheduling, supplier logistics, marketing promotions, refund processing, and store branch management."
            }
        ],
        "default_location": "Main Branch"
    }
}


def slugify(text: str) -> str:
    """Generate clean URL slug from string."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


def create_tenant_signup(
    db: Session,
    org_name: str,
    admin_name: str,
    admin_email: str,
    admin_password: str,
    template_key: str = "college_mess",
    org_slug: str = None,
    location_name: str = None,
    must_change_pw: bool = False
) -> Tuple[Organization, User]:
    """Execute complete tenant signup in ONE single database transaction (Rule 4).
    
    Creates:
    1. Organization
    2. Departments from chosen template with routing descriptions
    3. 4 default roles (Admin=all, Manager, Department In-charge, Employee)
    4. First admin user
    5. One default location
    """
    clean_email = admin_email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise ValueError("A valid email address is required")
        
    if not admin_password or len(admin_password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    # Check for email collision
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise ValueError(f"An account with email '{clean_email}' already exists")

    # Select template
    template_key = template_key if template_key in TEMPLATES else "college_mess"
    tmpl = TEMPLATES[template_key]

    # Compute slug
    slug = (org_slug or slugify(org_name)).strip()
    if not slug:
        slug = f"org-{slugify(org_name[:20])}"

    # Ensure slug uniqueness
    counter = 1
    base_slug = slug
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    try:
        # 1. Organization
        org = Organization(
            name=org_name.strip(),
            slug=slug,
            org_type=tmpl["org_type"],
            settings={"template": template_key, "onboarding_completed": True},
            is_active=True
        )
        db.add(org)
        db.flush()

        # Update org_id for self-reference
        org.org_id = org.id
        db.flush()

        # 2. Permission Catalog rows
        perm_map: Dict[str, Permission] = {}
        for code, desc in PERMISSION_CATALOG:
            p = Permission(
                org_id=org.id,
                code=code,
                description=desc
            )
            db.add(p)
            db.flush()
            perm_map[code] = p

        # 3. Four Default Roles
        # 3.1 Admin (all permissions)
        role_admin = Role(
            org_id=org.id,
            name="Admin",
            description="Full administrative access across all organizational modules"
        )
        db.add(role_admin)
        db.flush()
        for p in perm_map.values():
            db.add(RolePermission(org_id=org.id, role_id=role_admin.id, permission_id=p.id))

        # 3.2 Manager
        manager_perm_codes = [
            DASHBOARD_VIEW, FEEDBACK_VIEW, TASK_VIEW_ALL, TASK_ASSIGN, TASK_COMPLETE,
            USERS_MANAGE, DEPARTMENTS_MANAGE, LOCATIONS_MANAGE, SETTINGS_EDIT,
            EXPORT, KB_MANAGE, CHAT_USE
        ]
        role_manager = Role(
            org_id=org.id,
            name="Manager",
            description="Operational manager overseeing all departments and tasks"
        )
        db.add(role_manager)
        db.flush()
        for code in manager_perm_codes:
            if code in perm_map:
                db.add(RolePermission(org_id=org.id, role_id=role_manager.id, permission_id=perm_map[code].id))

        # 3.3 Department In-charge
        incharge_perm_codes = [
            DASHBOARD_VIEW, FEEDBACK_VIEW, TASK_VIEW_DEPT, TASK_ASSIGN, TASK_COMPLETE,
            EXPORT, KB_MANAGE, CHAT_USE
        ]
        role_incharge = Role(
            org_id=org.id,
            name="Department In-charge",
            description="Supervises assigned department operations, tasks, and team"
        )
        db.add(role_incharge)
        db.flush()
        for code in incharge_perm_codes:
            if code in perm_map:
                db.add(RolePermission(org_id=org.id, role_id=role_incharge.id, permission_id=perm_map[code].id))

        # 3.4 Employee
        employee_perm_codes = [
            FEEDBACK_VIEW, TASK_VIEW_OWN, TASK_COMPLETE, CHAT_USE
        ]
        role_employee = Role(
            org_id=org.id,
            name="Employee",
            description="Frontline employee resolving assigned operational tasks"
        )
        db.add(role_employee)
        db.flush()
        for code in employee_perm_codes:
            if code in perm_map:
                db.add(RolePermission(org_id=org.id, role_id=role_employee.id, permission_id=perm_map[code].id))

        # 4. Departments from template
        created_depts = []
        mgmt_dept = None
        for dept_def in tmpl["departments"]:
            dept = Department(
                org_id=org.id,
                name=dept_def["name"],
                code=dept_def["code"],
                description=dept_def["description"],
                sla_hours_p1=2,
                sla_hours_p2=6,
                sla_hours_p3=24,
                sla_hours_p4=48,
                is_active=True
            )
            db.add(dept)
            db.flush()
            created_depts.append(dept)
            if dept_def["name"] == "Management":
                mgmt_dept = dept

        # 5. One Default Location
        loc_name = location_name or tmpl["default_location"]
        location = Location(
            org_id=org.id,
            name=loc_name,
            code="LOC-01",
            description=f"Primary operational location for {org.name}",
            is_active=True
        )
        db.add(location)
        db.flush()

        # 6. First Admin User
        admin_user = User(
            org_id=org.id,
            name=admin_name.strip(),
            email=clean_email,
            pw_hash=hash_password(admin_password),
            role_id=role_admin.id,
            department_id=mgmt_dept.id if mgmt_dept else created_depts[0].id,
            manager_id=None,
            active=True,
            must_change_pw=must_change_pw,
            is_superuser=True
        )
        db.add(admin_user)
        db.flush()

        # Link Management department incharge to first admin
        if mgmt_dept:
            mgmt_dept.incharge_id = admin_user.id
            db.flush()

        # 7. Audit Log
        audit = AuditLog(
            org_id=org.id,
            user_id=admin_user.id,
            action="organization.signup",
            entity_type="organization",
            entity_id=org.id,
            details={
                "template": template_key,
                "admin_email": clean_email,
                "departments_count": len(created_depts),
                "location": loc_name
            }
        )
        db.add(audit)

        # Single transaction commit
        db.commit()
        db.refresh(org)
        db.refresh(admin_user)
        return org, admin_user

    except Exception as e:
        db.rollback()
        raise e
