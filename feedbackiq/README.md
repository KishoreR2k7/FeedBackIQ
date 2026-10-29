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

## 🧪 Automated Testing & Evaluation Scenarios

### Backend Tests (Pytest — 40 Tests Passing)
```bash
cd backend
PYTHONPATH=. .venv/bin/python -m pytest tests -v
```

The test suite validates the 6 required recurrence test scenarios in `tests/test_implementation2_recurrence_reasoning.py`:
1. **Complaint recurring every Friday**: 4 consecutive Friday lunch complaints -> identifies Friday lunch pattern, assigns `High` risk, hypotheses labeled with `[HYPOTHESIS]`.
2. **Problem increasing over several weeks**: 1 historical complaint vs 4 recent complaints -> `velocity_trend = increasing`, `velocity_change_percent = 300%`, assigns `High` risk.
3. **Isolated complaint with insufficient evidence**: 1 isolated complaint -> `velocity_trend = insufficient_data`, assigns `Insufficient Evidence` with explicit high uncertainty explanation.
4. **Previously recurring issue that is now decreasing**: 4 historical complaints vs 1 recent complaint -> `velocity_trend = decreasing`, `velocity_change_percent = -75%`, assigns `Low` risk.
5. **Critical safety complaint with 0 historical matches**: Single isolated report of glass/pest -> Rule 9 safety override triggers, escalates to `Critical` risk, priority floored to $\ge 85.0$.
6. **Missing or unreliable metadata**: None dates, meal types, and items processed gracefully without crashes; synthetic and real records accurately distinguished.
7. **Independent Statistical Verification**: SQL/Python metrics tested independently of LLM outputs.
8. **LLM Failure Resilience**: Mock LLM raising exceptions -> fallback deterministic reasoning still enforces Rule 9 safety escalation.
9. **LangGraph Execution Tracing**: Validates that all 5 workflow nodes execute and populate `execution_trace`.

### Frontend Tests (Vitest — 6 Tests Passing)
```bash
cd frontend
npm test
```

### Production Build Verification
```bash
cd frontend
npm run build
```

