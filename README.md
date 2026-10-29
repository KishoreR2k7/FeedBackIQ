# FeedbackIQ - Multi-Tenant AI Feedback Operations SaaS

FeedbackIQ is a production-grade multi-tenant SaaS designed for food-service organizations (college messes, restaurant chains, cafeterias, and hospital dietary facilities). It collects customer feedback via web links and QR code standees, and deploys autonomous AI agents to classify issues, route to responsible departments, calculate deterministic SLAs, predict recurring systemic breakdowns, verify corrective actions, and synthesize executive operational reports.

---

## 🛠️ Technology Stack & Environment

- **Framework**: FastAPI (Async & Sync REST endpoints, Jinja2 template rendering)
- **Database**: PostgreSQL 16/18 with psycopg 3 & SQLAlchemy 2.0
- **Migrations**: Alembic with full topological ordering
- **Multi-Agent Pipeline**: LangGraph StateGraph orchestration
- **AI Gateway & Fallback**: Groq API primary, local Ollama fallback, deterministic keyword rules last resort
- **Background Tasks**: APScheduler (SLA breach monitoring & periodic cluster audits)
- **Security**: Argon2id password hashing, signed session tokens, CSRF tokens, IP rate limiting
- **Environment**: Windows 11 with PowerShell, Python 3.10/3.11 in Conda `torch_gpu` environment (native local execution, no Docker required)

---

## 📐 The 9 Strict System Rules Compliance

| # | System Rule | Implementation Details |
|---|-------------|------------------------|
| **1** | **Every table has `org_id`** | Enforced via `OrgMixin`. All queries execute through `app/core/scope.py` (`org_scoped_query`, `scoped_get`, `scoped_create`). Client-supplied `org_id` is discarded. |
| **2** | **Permissions checked via `can(user, perm)`** | Implemented in `app/core/permissions.py`. Roles and permissions are database rows in `roles`, `permissions`, and `role_permissions`. |
| **3** | **Code counts, LLM thinks** | All counts, averages, SLA clocks, and Net Sentiment Scores are computed deterministically in SQL or Python in `app/services/metrics_service.py`. LLM performs qualitative reasoning. |
| **4** | **Central LLM Gateway** | All AI operations pass strictly through `app/core/llm.py` with `temperature=0`, Pydantic JSON schema validation, and complete execution audit logging in `agent_runs`. Zero OpenAI/GPT dependency. |
| **5** | **PostgreSQL Conventions** | Bigint identity keys (`id`), timestamptz in UTC, JSONB for structured data, CHECK constraints on status/sentiment/priority, indexes on `(org_id, created_at)` and foreign keys. |
| **6** | **Security Hardening** | Argon2id hashing (`argon2-cffi`), double-submit HMAC CSRF tokens, HTML escaping in Jinja2, IP rate limiting on public feedback form. |
| **7** | **Canonical Layout** | Organized cleanly into `app/{core,models,schemas,services,agents,routers,templates,static}`, `tests/`, `alembic/`, `seed.py`, `README.md`. |
| **8** | **Pytest Against Separate Test Database** | Dedicated test suite (`tests/`) targeting `feedbackiq_test` database. |
| **9** | **Phase Reports & Validation** | All phases tested with automated pytest suite (26/26 tests passing). |

---

## ⚡ Quickstart Guide (PowerShell Syntax)

### 1. Activate Conda Environment
```powershell
conda activate torch_gpu
```

### 2. Configure Environment (`.env`)
Verify the `.env` file in the project root:
```env
APP_NAME=FeedbackIQ
APP_ENV=development
DATABASE_URL=postgresql+psycopg://postgres:kishore@localhost:5432/feedbackiq
TEST_DATABASE_URL=postgresql+psycopg://postgres:kishore@localhost:5432/feedbackiq_test
LLM_CHAIN=groq:qwen/qwen3.8-27b,groq:llama-3.3-70b-versatile,ollama:gemma3:4b,ollama:llama3:8b,ollama:qwen2.5:1.5b,rules
OLLAMA_BASE_URL=http://localhost:11434
```

### 3. Run Database Migrations
```powershell
& "C:\Users\kishore\anaconda3\envs\torch_gpu\python.exe" -m alembic upgrade head
```

### 4. Seed Database with Initial Tenants & Roles
```powershell
& "C:\Users\kishore\anaconda3\envs\torch_gpu\python.exe" seed.py
```

### 5. Run the Application
```powershell
& "C:\Users\kishore\anaconda3\envs\torch_gpu\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 🔑 Demo Access & Default Credentials

| Organization | Role | Email | Password |
|---|---|---|---|
| **Apex University Central Mess** | Administrator | `admin@apexmess.com` | `AdminPass123!` |
| **Apex University Central Mess** | Head Chef (Food Quality) | `chef@apexmess.com` | `StaffPass123!` |
| **Apex University Central Mess** | Hygiene Supervisor | `hygiene@apexmess.com` | `StaffPass123!` |
| **Royal Spice Bistro** | Administrator | `admin@royalspice.com` | `AdminPass123!` |
| **Metro Health Cafeteria** | Administrator | `admin@metrohealth.com` | `AdminPass123!` |

---

## 🌐 Key Application URLs

- **Public Feedback Form**: `http://127.0.0.1:8000/f/apex-mess`
- **Printable Table Standee QR Code**: `http://127.0.0.1:8000/f/apex-mess/qr`
- **Tenant Onboarding & Signup**: `http://127.0.0.1:8000/signup`
- **Management Portal Login**: `http://127.0.0.1:8000/login`
- **Forced Password Update**: `http://127.0.0.1:8000/change-password`
- **Operations Dashboard**: `http://127.0.0.1:8000/dashboard`
- **Live Feedback Stream**: `http://127.0.0.1:8000/feedback`
- **Operational Task Board**: `http://127.0.0.1:8000/tasks`
- **Recurring Issue Intelligence**: `http://127.0.0.1:8000/recurring`
- **Executive Reports**: `http://127.0.0.1:8000/reports`
- **Departments & SLAs**: `http://127.0.0.1:8000/departments`

---

## 🧪 Running Automated Tests

Run the complete 26-test suite against the isolated `feedbackiq_test` database:
```powershell
& "C:\Users\kishore\anaconda3\envs\torch_gpu\python.exe" -m pytest tests -v
```
