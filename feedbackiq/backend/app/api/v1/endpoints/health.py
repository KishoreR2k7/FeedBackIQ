from fastapi import APIRouter, status
from app.schemas.health import HealthResponse, ReadinessResponse
from app.services.health_service import HealthService

router = APIRouter(prefix="/health", tags=["Health & Readiness"])


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Liveness Probe",
    description="Returns 200 if the FastAPI application process is up and running.",
)
async def get_liveness() -> HealthResponse:
    return HealthService.get_liveness()


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Readiness Probe",
    description="Verifies database connectivity, latency, and core service readiness.",
)
async def get_readiness() -> ReadinessResponse:
    return await HealthService.get_readiness()
