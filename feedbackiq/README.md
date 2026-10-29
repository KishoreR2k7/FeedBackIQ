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

## 📈 Phase 2: Topic Intelligence, Recurrence Agent & Priority Engine

FeedbackIQ Phase 2 implements the automated intelligence layer:

### 1. Topic & Historical Trend Intelligence
- Groups unstructured feedback across **food item, issue category, organization, location, meal type, and date windows**.
- Computes empirical metrics via SQL and Python: complaint count, average rating, negative feedback ratio, recent vs historical frequency, and velocity % change ($((recent - historical) / historical) \times 100$).
- Discovers temporal failure patterns (e.g., peak days like Tuesdays, shifts like Lunch).
- Generates natural, human-readable topic labels grounded strictly in evidence quotes without hallucinated statistics.

### 2. Recurrence Reasoning Agent (LangChain)
- Evaluates empirical trends to assess whether an operational failure will recur.
- Strictly separates **verified observations** (quotes, frequencies) from **causal hypotheses** (explicitly prefixed with `[HYPOTHESIS]`).
- Assigns calibrated risk levels: `Critical`, `High`, `Medium`, `Low`, or `Insufficient Evidence`.
- Provides actionable kitchen monitoring checklists.

### 3. Deterministic Priority Engine & Rule 9 Override
- Combines normalized metrics into a transparent priority score ($0.0$ to $100.0$):
  $$\text{Priority} = 0.50 \times \text{Severity}_{0-100} + 0.30 \times \text{RecurrenceRisk}_{0-100} + 0.20 \times \text{RecentFrequency}_{0-100}$$
- Fully configurable weights via `/api/v1/intelligence/priority-config`.
- **Rule 9 Safety Override**: Food safety hazards (pests, foreign objects, illness, raw meat) are deterministically floored to $\ge 85.0$, ensuring critical hazards are never ignored even if reported only once.

---

## 🧪 Automated Testing

### Backend Tests (Pytest — 20 Tests Passing)
```bash
cd backend
PYTHONPATH=. .venv/bin/python -m pytest tests -v
```
*Tests CSV field mapping, Zomato dataset parsing, idempotent duplicate hashing, Rule 9 safety escalation, LangChain structured output, cross-tenant data isolation, topic trends fact math, velocity calculations, recurrence agent hypothesis labeling, priority arithmetic, and safety floor overrides.*

### Frontend Tests (Vitest — 6 Tests Passing)
```bash
cd frontend
npm test
```
*Tests App shell, readiness telemetry, multi-tenant switching, Phase 1 Feedback Ingestion, Phase 2 Topic Trends, and Phase 2 Prioritized Issues queue.*

### Production Build Verification
```bash
cd frontend
npm run build
```

