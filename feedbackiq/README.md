# FeedbackIQ — AI-Powered Quality Intelligence & Food Safety Platform

FeedbackIQ is a production-oriented, multi-tenant SaaS platform that turns unstructured feedback from forms, complaints, table QR codes, and review text into actionable insights, recurrence-risk assessments, prioritized kitchen/staff actions, and verified operational outcomes.

---

## 🏗️ Architecture & Monorepo Structure

```
feedbackiq/
├── backend/            # FastAPI, Pydantic, SQLAlchemy 2.0 async, Alembic, LangChain
│   ├── app/
│   │   ├── core/       # Configuration, async DB session, JWT security
│   │   ├── models/     # Organizations, Locations, Feedback, FeedbackAnalysis, ImportJob, AuditEvent
│   │   ├── schemas/    # Pydantic v2 schemas and LangChain structured extraction contracts
│   │   ├── agents/     # FeedbackAnalyzerAgent with LangChain & Rule 9 deterministic safety
│   │   ├── services/   # IngestionService, FeedbackService, SyntheticDataGenerator, HealthService
│   │   ├── api/v1/     # Health, Organizations, Feedback, and Analysis endpoints
│   ├── alembic/        # Async migrations (001_initial, 002_feedback_and_analysis)
│   └── tests/          # Pytest async test suite (13 tests)
├── frontend/           # React 18, TypeScript, Vite, Tailwind CSS, Vitest
│   ├── src/            # Header, Sidebar, Telemetry, TenantSelector, IngestionPanel, FeedbackListView, AnalysisModal
├── data/               # Seed datasets, schemas, and CSV templates
├── docs/               # System architecture and specifications
├── docker-compose.yml  # Local PostgreSQL 16 container definition
└── .env.example        # Environment variable template
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & npm
- **Docker & Docker Compose**

### 2. Environment Configuration
From the `feedbackiq/` directory:
```bash
cp .env.example .env
```

Key environment variables:
```ini
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://feedbackiq_user:feedbackiq_secret_pass@localhost:5433/feedbackiq
LLM_PROVIDER=mock   # Options: "mock" (offline/tests), "gemini", "groq", "openai"
GEMINI_API_KEY=     # Required only if LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
```

### 3. Start Local PostgreSQL Database
```bash
docker compose up -d
```
*PostgreSQL 16 runs as a healthy container listening on port `5433` (preventing host port collisions with port 5432).*

### 4. Run Migrations & Start Backend
```bash
cd backend
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive API Docs (Swagger): [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- Liveness Probe: [http://localhost:8000/health](http://localhost:8000/health)
- Readiness Probe: [http://localhost:8000/ready](http://localhost:8000/ready)

### 5. Start the Frontend Application
In another terminal:
```bash
cd frontend
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## 📊 Dataset Ingestion & Mapping

### A. Canteen Feedback Schema
The ingestion pipeline supports CSV files matching either canonical names or common aliases:
* `feedback_id`: Unique identifier (e.g. `FB-1042`)
* `date`: Submission timestamp
* `meal_type`: `Breakfast`, `Lunch`, `Evening Snacks`, `Dinner`
* `item`: Food or dish name (e.g. `Dal Tadka`, `Sambar Rice`, `Paneer Butter Masala`)
* `rating`: 1 to 5 integer scale (normalizes `4.1/5`, `4.0`, `-` to numeric)
* `comment`: Unstructured text comment
* `channel`: `student_form`, `complaint_box`, `qr_scan`
* `issue_category`: `Taste & Flavor`, `Hygiene & Cleanliness`, `Temperature`, `Freshness & Spoilage`, `Portion & Quantity`, `Service & Waiting Time`

### B. Zomato Bangalore Kaggle Dataset Support
The ingestion service automatically recognizes Zomato Bangalore Kaggle review files:
* Maps `name` $\rightarrow$ `item` (or `dish_liked` if present)
* Maps `rate` (e.g., `4.1/5`) $\rightarrow$ `rating` (1–5)
* Maps `reviews_list` $\rightarrow$ `comment`
* Sets `source_dataset` $\rightarrow$ `zomato_bangalore`
* **Strict Rule**: Leaves `meal_type` and `date` as `None` (does not invent missing information).

### C. Seeded Recurring Failure Scenarios (Synthetic Generator)
The synthetic generator (`POST /api/v1/feedback/generate-synthetic`) seeds realistic failure clusters across time windows for testing intelligence:
1. **Cold Lunch Sambar**: Recurring temperature drops at lunch Station B (1:00 PM – 1:45 PM).
2. **Tuesday Salt Spikes**: Recurrent oversalted Dal Tadka batches on Tuesday lunch shifts.
3. **Friday Raw Poultry Hazard**: Undercooked/pink chicken biryani during overloaded Friday peak rush.
4. **Sour Paneer Spoilage**: Bacterial decomposition and sour odor in dinner paneer gravy.

---

## 🤖 Feedback Analysis Agent & Deterministic Safety Safeguards

The `FeedbackAnalyzerAgent` uses LangChain with Pydantic structured output (`StructuredAnalysisOutput`):
- **Sentiment**: `positive`, `neutral`, `negative`, `mixed`, `uncertain`
- **Mentioned Food Items & Service Aspects**: Extracted entity tags
- **Severity Score**: 1 to 5 scale
- **Evidence Quotes**: Extracted direct quotes from student feedback

### 🛡️ Rule 9 Deterministic Safety Safeguards
Critical safety complaints trigger deterministic Python safeguards; an LLM is **never** permitted to suppress them:
* Keywords matching **pests** (`cockroach`, `insect`, `fly`), **foreign bodies** (`hair`, `wire`, `glass`, `metal`), **illness** (`food poisoning`, `vomiting`, `diarrhea`), or **undercooked meat** (`raw chicken`, `pink chicken`) **forcibly trigger `food_safety_flag = True`** and elevate severity to $\ge 4$.
* Safety escalations are automatically written to the immutable `audit_events` compliance log.

---

## 📈 Phase 2: Historical Recurrence Reasoning Agent & LangGraph Architecture

FeedbackIQ Phase 2 implements the automated historical recurrence intelligence layer without traditional ML models:

### 1. Historical Evidence Retrieval (SQL & Python)
- Clusters feedback across **food item, issue category, organization, location, meal type, and date windows**.
- Computes empirical metrics directly via SQL and Python:
  - Total related complaints & total feedback count.
  - Number of distinct calendar days with complaints (`distinct_days_count`).
  - Days since most recent occurrence (`days_since_last_occurrence`) and timestamp.
  - Frequency in recent vs previous time windows.
  - Velocity trend (`increasing`, `stable`, `decreasing`, `new`, `insufficient_data`) and % change.
  - Distinct day-of-week (e.g., repeated Friday complaints) and meal-period patterns.
  - Negative feedback proportion and average rating trends.
  - Partitioned counts for **synthetic test records** vs **real operational feedback**.
- **Strict Grounding Rule**: Missing dates, meal types, and items are preserved as `None` and never hallucinated.

### 2. Recurrence Reasoning Agent (LangChain)
- Evaluates empirical evidence to assess whether an operational failure will recur.
- Strictly separates **verified observations** (quotes, frequencies) from **causal hypotheses** (explicitly prefixed with `[HYPOTHESIS]`).
- Assigns calibrated risk levels: `Critical`, `High`, `Medium`, `Low`, or `Insufficient Evidence`.
- Provides actionable investigation checklists and explicit uncertainty explanations.
- Never outputs arbitrary numerical probabilities as calibrated statistical forecasts.

### 3. LangGraph Execution Workflow
Implemented as a compiled 5-node `StateGraph` in `app/workflows/recurrence_workflow.py`:
1. `retrieve_evidence`: Deterministic SQL aggregation of historical metrics.
2. `reason_recurrence`: LLM agent evaluation with structured output and automatic retry/fallback.
3. `safety_override`: Deterministic Rule 9 validator enforcing `Critical` risk on food safety hazards.
4. `priority_scoring`: Transparent 0–100 deterministic weighted score calculation.
5. `persist_assessment`: PostgreSQL persistence and safety audit event logging.
- Includes step-by-step `execution_trace` for auditability and diagnostic visibility.

### 4. Interactive UI & Evidence Inspection
- **Deterministic Priority Queue**: Displays prioritized issues with live score breakdown.
- **Evidence Inspection Modal**:
  - Raw supporting feedback comments with timestamps, meal types, and synthetic/real badges.
  - Observed empirical patterns and temporal distributions.
  - Root-cause hypotheses clearly labeled with `[HYPOTHESIS]` callouts.
  - LangGraph workflow execution trace step viewer.
- **Multi-dimensional Filtering**: Filter by food item, issue category, meal shift, risk level, and date window.

---

## ⚠️ Limitations of Recurrence Assessment

1. **Heuristics vs Calibrated Probabilities**: While historical velocity, distinct day counts, and temporal clustering reveal empirical operational patterns, they are operational heuristics. They are not statistically calibrated probability predictions of future events.
2. **Sample Size & Reporting Bias**: In small datasets or low-volume mess halls (< 2 complaints), statistical recurrence cannot be reliably established; the system explicitly outputs `Insufficient Evidence` to prevent misleading operational decisions.
3. **Hypotheses vs Ground Truth**: Causal root-causes generated by LLMs are working hypotheses (`[HYPOTHESIS]`), derived from feedback text signals (e.g., "Friday lunch rush", "temperature drop during transport"). They require operational kitchen verification and must not be treated as confirmed facts.
4. **Data Reliability & Missing Metadata**: When dates, meal slots, or items are absent (such as in scraped public review feeds), temporal recurrence patterns cannot be inferred. The system adheres strictly to not hallucinating or inventing missing timestamps or shifts.
5. **Deterministic Primacy Over LLM Reasoning**: Food safety hazards (pests, broken glass, chemical contamination) bypass statistical frequency and recurrence entirely; the deterministic Rule 9 safety override floors priority $\ge 85.0$ and sets risk to `Critical` even if the issue is reported only once.

---

---

## 🎯 Implementation 3: Priority Scoring, Corrective Actions (CAPA) & Closed-Loop Verification

FeedbackIQ Implementation 3 delivers complete closed-loop action management that translates recurrence assessments and quality intelligence into concrete operational workflows:

```
[ Feedback Stream ] 
       │
       ▼ (NLP & Rule 9 Safety)
[ Historical Clustering & Recurrence Analysis ]
       │
       ▼ (Python/SQL Deterministic Priority Engine + Safety Override)
[ Priority Score (0–100) & Risk Level ]
       │
       ▼ (LangChain Action Recommendation Agent)
[ Structured CAPA Recommendations (Corrective & Preventive) ]
       │
       ▼ (Idempotent Task Service: dedup_fingerprint)
[ ActionTask Lifecycle: Proposed → Awaiting Approval → Assigned → In Progress → Completed → Verified ]
       │
       ├── Manager Approvals & Role Permissions (org_admin, quality_reviewer)
       ├── Staff Delegation & Execution Progress Notes (staff)
       ├── In-App Notifications & SMTP Delivery Tracking (delivered / simulated)
       │
       ▼ (Verification Service: Pre vs Post Statistical Comparison)
[ Outcome Verification: Improved | No Clear Improvement | Worsened | Insufficient Evidence ]
```

### 1. Deterministic Priority Calculation (Python/SQL)
- Transparent, reproducible formula combining normalized 0–100 components:
  $$\text{Priority Score} = 0.50 \times \text{Severity} + 0.30 \times \text{Recurrence Risk} + 0.20 \times \text{Recent Frequency} + w_{\text{impact}} \times \text{Impact}$$
- All numerical scoring is performed purely in Python and SQL; the LLM is never tasked with calculating the final score.
- Weights and safety floors are fully configurable via REST endpoints:
  - `GET /api/v1/intelligence/priority-config`
  - `PUT /api/v1/intelligence/priority-config`
- **Rule 9 Deterministic Safety Floor**: Any critical food-safety hazard (foreign objects, pests, severe foodborne illness, undercooked poultry, toxic odor) triggers an uncompromising safety floor ($\ge 85.0$). Low complaint frequency or lack of historical records **never** suppresses required safety reviews.

### 2. Evidence-Grounded Action Recommendation Agent (LangChain)
- Structured Pydantic contract (`ActionRecommendationOutput`) with strict schema validation:
  - `issue_summary`: Concise description of the failure.
  - `evidence_and_priority_reason`: Transparent rationale linking priority to historical facts.
  - `suggested_corrective_action`: Immediate operational remediation.
  - `suggested_preventive_action`: Systemic root-cause mitigation (SOPs, supplier checks).
  - `responsible_role`: Delegated role (`Head Chef`, `Food Safety Officer`, `Hygiene Supervisor`, etc.).
  - `suggested_deadline_days`: Pragmatic target window.
  - `required_approval`: Required sign-off authority (`Operations Manager`, `Quality Assurance Lead`).
  - `estimated_effort`: `Low`, `Medium`, or `High`.
  - `verification_criteria`: Concrete metric to confirm resolution.
  - `expected_outcome`: Target operational state.
- **Strict Evidence Guardrail**: The agent is restricted from hallucinating equipment serial numbers, ingredient supplier batch codes, or employee names. Where facts are insufficient, the agent explicitly recommends inspection and root-cause investigation.

### 3. Task Management & CAPA Lifecycle
- Persistent PostgreSQL schema (`action_tasks` table) supporting the full operational lifecycle:
  `Proposed` $\rightarrow$ `Awaiting Approval` $\rightarrow$ `Assigned` $\rightarrow$ `In Progress` $\rightarrow$ `Completed` $\rightarrow$ `Verified` (and `Rejected`).
- **Role Permissions Enforced**:
  - Only authorized managers (`super_admin`, `org_admin`, `quality_reviewer`) can approve, reject, edit, reprioritize, or reassign tasks.
  - Kitchen and operations staff can view assigned tasks and record execution progress/completion notes.
- **Workflow Idempotency & Duplicate Prevention**:
  - Tasks compute a unique cryptographic fingerprint: `dedup_fingerprint = sha256(f"{organization_id}:{cluster_key}")`.
  - Periodic LangGraph retries update existing open tasks instead of creating duplicate clutter.

### 4. Notifications & Delivery Auditing
- Dual-channel notification system:
  - **In-App Notifications**: Real-time persisted alerts with unread tracking (`GET /api/v1/notifications`, `POST /api/v1/notifications/{id}/read`).
  - **Email Integration**: Background SMTP dispatch with exponential retry handling.
- **Delivery Confirmation Guardrail**: The system never falsely claims an email was delivered without provider confirmation. In local or non-SMTP environments, delivery status is accurately flagged as `simulated` with explicit diagnostic context.
- Dispatched for:
  - New task assignments.
  - Manager approval requests.
  - Approaching or missed deadlines.
  - Critical Rule 9 safety alerts.
  - Investigation requests for ambiguous incidents.

### 5. Closed-Loop Verification Workflow
- Compares relevant feedback before and after corrective actions across selectable evaluation windows (7, 14, or 30 days).
- Computes empirical changes:
  - Pre vs Post complaint volume and percentage change.
  - Pre vs Post average star rating.
- Returns standardized statistical outcomes:
  - `Improved`: Statistically significant reduction in complaints and rating recovery.
  - `No Clear Improvement`: Complaint frequency remains unchanged.
  - `Worsened`: Complaints increased post-intervention.
  - `Insufficient Evidence`: Fewer than required feedback samples to evaluate.
- **Non-Causal Analytical Disclosure**: Adheres strictly to scientific and regulatory guidelines: *Does not claim the corrective action caused an improvement solely from before/after comparison.* Discloses potential external confounding factors (menu changes, weather, attendance shifts).

### 6. Interactive Prioritized Action Board UI
- Located in the **CAPA Action Board** tab (`PrioritizedActionBoard.tsx`).
- **Live Persona Switcher**: Instantly toggle between `Operations Manager (Admin)` and `Kitchen Staff (Operator)` to test permissions, approvals, and completions directly in the browser.
- **KPI Summary Cards**: Total tasks, awaiting manager approval, active in progress, verified outcomes, and Rule 9 safety overrides.
- **Action Control Modals**:
  - Manager Authorization & Rejection Modal.
  - Staff Delegation & Due Date Modal.
  - Execution Progress & Completion Notes Modal.
  - Before/After Statistical Outcome Verification Modal.
- **Slide-Down Notification Drawer**: Real-time alerts with delivery status pills and one-click "Mark as Read".

---

## 🧪 Automated Testing & Evaluation Scenarios

### Backend Tests (Pytest — 48 Tests Passing)
```bash
cd backend
.venv/bin/pytest tests/ --show-capture=no
```

Test coverage across implementations:
- `test_feedback_ingestion.py` (7 tests): CSV ingestion, Zomato mapping, synthetic generation, multi-tenancy.
- `test_health.py` (4 tests): Liveness, readiness, database probe latency, LLM connectivity.
- `test_implementation1_sentiment_and_topics.py` (11 tests): Sentiment analysis, aspect extraction, Rule 9 deterministic safety escalations, audit logging.
- `test_implementation2_recurrence_reasoning.py` (9 tests): Empirical velocity, distinct day counts, recurrence agent hypotheses, missing metadata resilience.
- `test_implementation3_priority_and_actions.py` (8 tests):
  1. Configurable priority score formula with normalized inputs and optional impact.
  2. Rule 9 food-safety overrides never suppressed by low frequency or isolated history.
  3. Action recommendation agent structured Pydantic output and evidence grounding.
  4. Workflow idempotency and duplicate task prevention (`dedup_fingerprint`).
  5. Task lifecycle transitions and manager authorization enforcement.
  6. Backend role permissions: staff rejected from unauthorized approvals.
  7. In-app and email notification dispatch with delivery status tracking.
  8. Before/after outcome verification workflow with non-causal analytical disclosure.
- `test_recurrence_and_priority.py` (7 tests): Recurrence engine and priority queue integration.
- `test_tenant_isolation.py` (2 tests): Multi-tenant database isolation.

### Frontend Tests (Vitest — 10 Tests Passing)
```bash
cd frontend
npm test -- --run
```
- `App.test.tsx` (6 tests): App shell, telemetry, tenant switching, feedback ingestion, topic trends, and deterministic priority queue navigation.
- `ActionBoard.test.tsx` (4 tests): Action board KPI cards, Rule 9 indicators, manager approval modal, verification modal, and in-app alerts drawer.

### Production Build Verification
```bash
cd frontend
npm run build
```
Builds clean production bundle with zero TypeScript or Vite compilation errors.


