"""Main FastAPI Application Entrypoint for FeedbackIQ."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import public, auth, dashboard, feedback, tasks, recurring, reports, departments


from app.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-Tenant AI Feedback Operations Platform for Food-Service Organizations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Register Routers
app.include_router(public.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(feedback.router)
app.include_router(tasks.router)
app.include_router(recurring.router)
app.include_router(reports.router)
app.include_router(departments.router)



@app.get("/")
def root():
    """Root redirect to default demo organization feedback form or login."""
    return RedirectResponse(url="/f/apex-mess")


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}
