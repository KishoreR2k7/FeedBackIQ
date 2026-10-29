# FeedbackIQ — Architecture & System Design Documentation

FeedbackIQ is an enterprise-grade, multi-tenant SaaS platform that turns unstructured feedback (from forms, complaints, table QR codes, and review text) into actionable insights, recurrence-risk assessments, prioritized kitchen/staff actions, and verified operational outcomes.

---

## 1. Multi-Tenant Domain Model & Scoping Strategy

Unlike single-tenant or bespoke canteen tools, FeedbackIQ separates the **multi-tenant core platform** from **tenant-specific business logic** via configurable **Organization Templates**.

### 1.1 Tenant Isolation
* **Server-Enforced Scoping**: Every tenant-owned record (`users`, `locations`, `feedback`, `feedback_analyses`, `import_jobs`, `audit_events`) contains an indexed, foreign-keyed `organization_id`.
* **Zero Cross-Tenant Leakage**:
  - The repository layer (`BaseRepository`) and service layers inject `WHERE organization_id = :current_tenant_id` on all operational queries.
  - The API dependency layer resolves tenant context via authenticated JWT claims (`organization_id`) or verified tenant headers (`X-Organization-Id`).
  - No tenant can access or mutate another tenant's records.

### 1.2 Configurable Organization Templates
FeedbackIQ ships with out-of-the-box templates that tailor the data model and workflows without code modification:

| Template | Target Domain | Default Service Slots | Sample Issue Taxonomy | SLA Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **`COLLEGE`** | Higher Education Campus & Mess | Breakfast, Lunch, Evening Snacks, Dinner | Taste & Flavor, Hygiene, Temperature, Portion, Spoilage, Queue Time | 24 Hours |
| **`RESTAURANT`** | Dining Establishments & Bistros | Lunch Service, Dinner Service, Late Night | Food Quality, Ambience, Hospitality, Billing Value, Table Cleanliness | 12 Hours |
| **`CORPORATE_CAFETERIA`** | Enterprise Cafeterias | Breakfast Grab&Go, Lunch Shifts, Refreshment | Healthy Options, Food Freshness, Wait Time, Cutlery Cleanliness | 8 Hours |
| **`CUSTOM`** | Commercial Catering & Hospital Mess | Configurable Slots | Fully configurable tenant taxonomy | Custom SLA |

---

## 2. Separation of Concerns: Deterministic Rules vs LLMs

FeedbackIQ adheres to a strict division of intelligence:

### 2.1 Deterministic Python / SQL Engine
* **Statistical Computations**: Complaint frequency, rolling 7-day/14-day counts, moving averages, rating trends.
* **Content Hashing & Idempotency**: SHA-256 fingerprinting of `(organization_id, date, item, comment)` prevents duplicate ingestion.
* **Safety Escalation Safeguards (Rule 9)**: Critical food safety triggers (e.g., pests, foreign glass/wire, acute illness/vomiting, undercooked poultry) immediately trigger deterministic escalation to the urgent alert queue. An LLM is **never** permitted to downgrade or suppress a critical safety incident.

### 2.2 LLM / Generative Agent Layer (LangChain)
* **Natural Language Understanding**: Aspect-based sentiment extraction, nuance understanding (sarcasm, ambiguous complaints, vernacular terms).
* **Entity Extraction**: Parsing specific dishes, ingredients, and operational service aspects into structured JSON via Pydantic (`StructuredAnalysisOutput`).
* **Uncertainty & Diagnostics**: Calibrating confidence for vague, non-textual, or slang reviews.

---

## 3. Database Schema (Phase 0 & Phase 1)

### `organizations`
* `id`: UUID (Primary Key)
* `name`: String (Tenant name, e.g. "St. Andrews Campus Mess")
* `slug`: String (Unique index, e.g. "st-andrews-mess")
* `template_type`: Enum (`college`, `restaurant`, `corporate_cafeteria`, `custom`)
* `is_active`: Boolean
* `settings`: JSONB / JSON (service slots, taxonomy, SLA hours, safety keywords)
* `created_at`, `updated_at`: Timestamptz UTC

### `locations`
* `id`: UUID (Primary Key)
* `organization_id`: UUID (FK to `organizations.id`)
* `name`: String (e.g., "Main Dining Hall", "Counter B")
* `code`, `location_type`: String
* `is_active`: Boolean
* `created_at`, `updated_at`: Timestamptz UTC

### `feedback`
* `id`: UUID (Primary Key)
* `feedback_id`: String (e.g., `FB-1048`)
* `organization_id`: UUID (FK to `organizations.id`)
* `location_id`: UUID (FK to `locations.id`)
* `date`: Timestamptz UTC
* `meal_type`: String (e.g., "Lunch")
* `item`: String (e.g., "Dal Tadka")
* `rating`: Integer (1 to 5)
* `comment`: Text
* `channel`: String (`student_form`, `complaint_box`, `qr_scan`, `zomato_review`)
* `issue_category`: String
* `source_dataset`: String (`synthetic_canteen`, `zomato_bangalore`, `csv_import`)
* `content_hash`: String (SHA-256 deduplication fingerprint)
* `created_at`, `updated_at`: Timestamptz UTC

### `feedback_analyses`
* `id`: UUID (Primary Key)
* `feedback_id`: UUID (FK to `feedback.id`, Unique)
* `organization_id`: UUID (FK to `organizations.id`)
* `sentiment`: String (`positive`, `neutral`, `negative`, `mixed`, `uncertain`)
* `mentioned_food_items`: JSON (List[str])
* `service_aspects`: JSON (List[str])
* `issue_categories`: JSON (List[str])
* `severity_score`: Integer (1 to 5)
* `evidence_quotes`: JSON (List[str])
* `food_safety_flag`: Boolean (Rule 9 safeguard)
* `food_safety_reasons`: JSON (List[str])
* `language`: String
* `uncertainty_score`: Float
* `model_name`: String
* `raw_model_response`: JSON
* `created_at`, `updated_at`: Timestamptz UTC

### `import_jobs`
* `id`: UUID (Primary Key)
* `organization_id`: UUID (FK to `organizations.id`)
* `source_name`, `filename`: String
* `total_records`, `processed_records`, `successful_records`, `failed_records`, `duplicate_records`: Integer
* `errors`: JSON
* `status`: Enum (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)
* `created_at`, `updated_at`: Timestamptz UTC

### `audit_events`
* `id`: UUID (Primary Key)
* `organization_id`: UUID (FK to `organizations.id`)
* `user_id`: UUID (FK to `users.id`, nullable)
* `event_type`: String (`CSV_INGESTION`, `SAFETY_ESCALATION`, `AI_ANALYSIS`)
* `entity_type`, `entity_id`: String
* `event_payload`: JSON
* `created_at`: Timestamptz UTC

### `recurrence_assessments` (Phase 2)
* `id`: UUID (Primary Key)
* `organization_id`: UUID (FK to `organizations.id`)
* `issue_cluster_key`: String (e.g. `Dal Tadka|temperature|Lunch`)
* `item`, `issue_category`, `meal_type`: String (indexed)
* `risk_level`: String (`Critical`, `High`, `Medium`, `Low`, `Insufficient Evidence`)
* `priority_score`: Float (0.0 to 100.0)
* `severity_score_normalized`: Float (0.0 to 100.0)
* `recurrence_risk_normalized`: Float (0.0 to 100.0)
* `recent_frequency_normalized`: Float (0.0 to 100.0)
* `is_safety_override`: Boolean (True if Rule 9 food safety floor enforced)
* `total_complaints_count`, `recent_complaints_count`, `historical_complaints_count`: Integer
* `velocity_change_percent`: Float
* `time_patterns`: JSON (List[str], e.g. "Frequent on Tuesdays (4 complaints)")
* `supporting_evidence`: JSON (List[str], grounded customer quotes)
* `hypotheses_causes`: JSON (List[str], explicitly marked with `[HYPOTHESIS]`)
* `recommended_actions`: JSON (List[str], actionable kitchen interventions)
* `confidence_explanation`: String
* `created_at`, `updated_at`: Timestamptz UTC

---

## 4. Topic and Trend Intelligence Architecture (Phase 2)

### 4.1 SQL and Python Aggregation Strategy
1. **Granular Operational Clustering**: Feedback items are grouped by `(item, issue_category, meal_type)`. If dish names or categories are missing from raw submission, the agent's verified extraction provides fallback grouping keys.
2. **Empirical Fact Computation**:
   * `total_feedback_count` & `complaint_count` (severity $\ge 3$, rating $\le 2$, or negative sentiment).
   * `average_rating` & `negative_feedback_proportion`.
   * **Temporal Window Slicing**: Splits dataset into a recent window (default: 7 days) and historical window (prior period).
   * **Velocity Calculation**:
     $$\text{Velocity \% Change} = \frac{\text{Recent} - \text{Historical}}{\max(\text{Historical}, 1)} \times 100$$
     Labelled strictly as `increasing` (> +15%), `decreasing` (< -15%), `stable`, `new` (first appearance), or `insufficient_data` (< 3 records).
   * **Temporal Pattern Extraction**: Days of week and meal shifts are counted to detect shift-specific defects (e.g. "Peak on Tuesdays", "80% Lunch service").
3. **Evidence-Grounded Topic Synthesis**:
   * LLMs generate readable topic titles and summaries grounded in verified quote evidence without inventing counts or statistics.

---

## 5. Recurrence Reasoning Agent (LangChain)

The Recurrence Reasoning Agent receives strictly empirical trend facts and direct quotes. It adheres to strict cognitive rules:
* **Separation of Facts from Hypotheses**: Verified quotes and recurrence counts are labelled as empirical observations. Potential root causes are explicitly prefixed with `[HYPOTHESIS]` to prevent operators from mistaking AI conjecture for proven causality.
* **Deterministic Risk Categories**:
  - `Critical`: Active food-safety hazard or severe escalating defect.
  - `High`: Consistent cross-shift or cross-day recurrence with positive velocity.
  - `Medium`: Repeated occurrences (2–3 complaints) without severe escalation.
  - `Low`: Isolated incident in historical data.
  - `Insufficient Evidence`: Sparse feedback (< 2 submissions) flagged transparently to avoid false confidence.
* **Prescriptive Action Formulation**: Provides actionable kitchen monitoring checklists (e.g., probe temperatures every 20 minutes, audit refrigeration logs, calibrate steam tables).

---

## 6. Deterministic Priority Engine & Rule 9 Safety Override

### 6.1 Priority Score Formulation
To ensure transparent operational prioritization without black-box ML scoring:
$$\text{Priority} = (w_{sev} \times \text{Severity}_{0-100}) + (w_{rec} \times \text{RecurrenceRisk}_{0-100}) + (w_{freq} \times \text{RecentFrequency}_{0-100})$$

Default weights:
* $w_{sev} = 0.50$ (Normalized severity from 1–5 scale: $\frac{S_{eff} - 1}{4} \times 100$)
* $w_{rec} = 0.30$ (Normalized risk: Critical=100, High=75, Medium=50, Low=25, Insufficient=10)
* $w_{freq} = 0.20$ (Normalized recent complaint frequency: $\min(100, \text{recent\_count} \times 20)$)

Weights are fully configurable via `/api/v1/intelligence/priority-config` and validated to sum to 1.00.

### 6.2 Rule 9 Food-Safety Override Floor
If a complaint involves critical food safety hazards (pests, metal/glass foreign bodies, acute illness, raw poultry, chemical smells):
$$\text{Priority} = \max(\text{Priority}, \text{safety\_override\_floor}) \quad (\text{Default } \ge 85.0)$$
`is_safety_override` is set to `True`. Such incidents immediately rise to top priority even if they represent an isolated single complaint.

---

## 7. Limitations of Recurrence Assessment

1. **Sample Size Sensitivity**: Small dining halls or low-response days may produce false-positive spikes or trigger `insufficient_data`.
2. **Correlation vs. Causality**: AI hypotheses regarding root causes (e.g. steam table element malfunction) are inferences based on common catering failure modes and require human physical verification.
3. **Reporting Bias**: Dissatisfied diners report complaints at a disproportionate rate compared to satisfied diners; proportion calculations reflect feedback volume rather than absolute diner population.

