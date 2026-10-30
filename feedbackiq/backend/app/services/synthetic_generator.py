import random
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# Canteen Domain Vocabulary
MEAL_TYPES = ["Breakfast", "Lunch", "Evening Snacks", "Dinner"]

CANTEEN_MENU = {
    "Breakfast": ["Masala Dosa", "Poha", "Idli Vada", "Aloo Paratha", "Upma", "Poori Bhaji"],
    "Lunch": ["Dal Tadka", "Paneer Butter Masala", "Chicken Biryani", "Sambar Rice", "Chapati", "Veg Pulao", "Curd Rice"],
    "Evening Snacks": ["Samosa", "Masala Chai", "Veg Puff", "Filter Coffee", "Pakora", "Pav Bhaji"],
    "Dinner": ["Dal Makhani", "Jeera Rice", "Kadai Paneer", "Egg Curry", "Tandoori Roti", "Mixed Veg Curry"],
}

ISSUE_CATEGORIES = [
    "Taste & Flavor",
    "Hygiene & Cleanliness",
    "Temperature",
    "Portion & Quantity",
    "Freshness & Spoilage",
    "Service & Waiting Time",
]

CHANNELS = ["form", "complaint", "student_form", "complaint_box", "qr_scan"]

# Seeded Systemic Recurring Scenarios
SCENARIOS = {
    "COLD_LUNCH_SAMBAR": {
        "item": "Sambar Rice",
        "meal_type": "Lunch",
        "issue_category": "Temperature",
        "comments": [
            "Sambar is completely ice cold by 1:15 PM every day.",
            "Why is the sambar always lukewarm? The bain-marie seems turned off.",
            "Third time this week the sambar at Station B is cold.",
            "Cold sambar again. Ruins the entire lunch experience.",
            "Please reheat the sambar vat, it gets cold after 1 PM.",
        ],
        "ratings": [1, 2],
    },
    "SALT_SPIKE_DAL": {
        "item": "Dal Tadka",
        "meal_type": "Lunch",
        "issue_category": "Taste & Flavor",
        "comments": [
            "Dal was ridiculously salty today! Inedible.",
            "Way too much salt in the dal tadka today.",
            "Cook poured a whole box of salt into the dal. Had to leave it.",
            "Dal tadka salt ratio is completely inconsistent on Tuesdays.",
            "Extremely salty dal, please calibrate spices.",
        ],
        "ratings": [1, 2],
    },
    "RAW_CHICKEN_FRIDAY": {
        "item": "Chicken Biryani",
        "meal_type": "Lunch",
        "issue_category": "Hygiene & Cleanliness",
        "comments": [
            "Chicken was pink and raw near the bone! Major food poisoning risk.",
            "Found undercooked chicken in Friday biryani. Highly unacceptable.",
            "Chicken was practically raw inside. Chef is rushing the batch.",
            "Undercooked chicken piece in biryani! Please inspect prep standards.",
            "Raw chicken again this Friday. Are fryers overloaded during rush?",
        ],
        "ratings": [1, 1],
    },
    "SOUR_PANEER_SPOILAGE": {
        "item": "Paneer Butter Masala",
        "meal_type": "Dinner",
        "issue_category": "Freshness & Spoilage",
        "comments": [
            "The paneer tasted distinctly sour and smelled bad. Spoilage!",
            "Curdled texture and sour odor in the paneer gravy tonight.",
            "Stale paneer used in dinner. Check your supplier cold storage.",
            "Paneer tasted sour and rubbery. Expired dairy batch?",
            "Paneer smelled funny and had a sour tang. Stomach is hurting.",
        ],
        "ratings": [1, 2],
    },
}

POSITIVE_COMMENTS = [
    ("Paneer was exceptionally soft and flavorful today!", 5),
    ("Dosa was hot, crisp, and served promptly. Great job morning team.", 5),
    ("Chicken Biryani portion was generous and aromatic.", 5),
    ("Poha was light, fresh, and not oily. Really appreciated.", 4),
    ("Clean dining hall and polite staff during breakfast shift.", 4),
    ("Great improvement in hygiene at the salad counter.", 5),
    ("Dal tadka had the perfect tadka and garlic aroma today.", 5),
]


class SyntheticDataGenerator:
    """Generates authentic synthetic food feedback for training and validation."""

    @classmethod
    def compute_content_hash(
        cls,
        org_id: uuid.UUID,
        date_str: str,
        item: Optional[str],
        comment: Optional[str],
    ) -> str:
        payload = f"{org_id}:{date_str}:{item or ''}:{comment or ''}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def generate_records(
        cls,
        organization_id: uuid.UUID,
        count: int = 50,
        seed_recurring: bool = True,
        days_back: int = 30,
    ) -> List[Dict[str, Any]]:
        records = []
        now = datetime.now(timezone.utc)

        # 1. Seed recurring clusters if requested
        if seed_recurring:
            for scenario_key, scenario in SCENARIOS.items():
                # Add 3-5 recurring complaints spread across the last 14 days
                num_occurrences = random.randint(3, 5)
                for _ in range(num_occurrences):
                    days_ago = random.randint(1, 14)
                    hour = 13 if scenario["meal_type"] == "Lunch" else 20
                    minute = random.randint(5, 55)
                    ts = (now - timedelta(days=days_ago)).replace(
                        hour=hour, minute=minute, second=0, microsecond=0
                    )
                    comment = random.choice(scenario["comments"])
                    rating = random.choice(scenario["ratings"])
                    feedback_id = f"FB-REC-{random.randint(1000, 9999)}"

                    records.append({
                        "feedback_id": feedback_id,
                        "organization_id": organization_id,
                        "date": ts,
                        "meal_type": scenario["meal_type"],
                        "item": scenario["item"],
                        "rating": rating,
                        "comment": comment,
                        "channel": random.choice(CHANNELS),
                        "issue_category": scenario["issue_category"],
                        "source_dataset": "synthetic_canteen",
                        "content_hash": cls.compute_content_hash(
                            organization_id, ts.isoformat(), scenario["item"], comment
                        ),
                    })

        # 2. Fill remainder with organic general positive and negative feedback
        target_count = max(count, len(records))
        fb_counter = 2000
        while len(records) < target_count:
            fb_counter += 1
            days_ago = random.randint(0, days_back)
            meal = random.choice(MEAL_TYPES)
            item = random.choice(CANTEEN_MENU[meal])
            hour_map = {"Breakfast": 8, "Lunch": 13, "Evening Snacks": 17, "Dinner": 20}
            base_hour = hour_map.get(meal, 12)
            ts = (now - timedelta(days=days_ago)).replace(
                hour=base_hour, minute=random.randint(0, 59), second=0, microsecond=0
            )

            # 70% positive/neutral, 30% complaint
            if random.random() < 0.65:
                pos_template = random.choice(POSITIVE_COMMENTS)
                comment = pos_template[0]
                rating = pos_template[1]
                issue_category = None
                channel = "student_form"
            else:
                cat = random.choice(ISSUE_CATEGORIES)
                rating = random.randint(1, 3)
                channel = random.choice(CHANNELS)
                if cat == "Temperature":
                    comment = f"{item} served lukewarm and cold."
                elif cat == "Taste & Flavor":
                    comment = f"{item} was bland and lacked seasoning."
                elif cat == "Hygiene & Cleanliness":
                    comment = f"Trays were still wet and oily when serving {item}."
                elif cat == "Portion & Quantity":
                    comment = f"Portion of {item} was very small for lunch."
                elif cat == "Service & Waiting Time":
                    comment = f"Waited over 20 minutes in line to receive {item}."
                else:
                    comment = f"{item} was not fresh today."
                issue_category = cat

            feedback_id = f"FB-{fb_counter}"
            records.append({
                "feedback_id": feedback_id,
                "organization_id": organization_id,
                "date": ts,
                "meal_type": meal,
                "item": item,
                "rating": rating,
                "comment": comment,
                "channel": channel,
                "issue_category": issue_category,
                "source_dataset": "synthetic_canteen",
                "content_hash": cls.compute_content_hash(
                    organization_id, ts.isoformat(), item, comment
                ),
            })

        # Shuffle records chronologically
        records.sort(key=lambda r: r["date"], reverse=True)
        return records[:count]
