from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.health_service import HealthService
from app.schemas.health import HealthResponse, ReadinessResponse

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("feedbackiq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan for startup initialization and graceful shutdown."""
    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]"
    )
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-tenant SaaS AI Quality Intelligence Platform",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


# Top-level orchestrator health & readiness probes
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Root"],
    summary="Top-level Liveness Check",
)
async def root_liveness():
    return HealthService.get_liveness()


@app.get(
    "/ready",
    response_model=ReadinessResponse,
    tags=["Root"],
    summary="Top-level Readiness Check",
)
@app.get(
    "/health/ready",
    response_model=ReadinessResponse,
    tags=["Root"],
    include_in_schema=False,
)
async def root_readiness():
    return await HealthService.get_readiness()


@app.get("/", tags=["Root"], summary="API Root Metadata")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": f"{settings.API_V1_STR}/docs",
        "api_v1": settings.API_V1_STR,
    }
