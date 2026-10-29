from typing import Any, Dict
from app.core.config import settings
from app.core.database import check_database_health
from app.schemas.health import HealthResponse, ReadinessResponse


class HealthService:
    @staticmethod
    def get_liveness() -> HealthResponse:
        return HealthResponse(
            status="healthy",
            app=settings.PROJECT_NAME,
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
        )

    @staticmethod
    async def get_readiness() -> ReadinessResponse:
        db_health = await check_database_health()
        
        # LLM provider configuration status
        llm_status: Dict[str, Any] = {
            "provider": settings.LLM_PROVIDER,
            "model": settings.LLM_MODEL,
            "configured": bool(
                settings.LLM_PROVIDER == "mock"
                or (settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY)
                or (settings.LLM_PROVIDER == "groq" and settings.GROQ_API_KEY)
                or (settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY)
            ),
        }

        # Overall readiness requires database to be healthy
        is_ready = db_health.get("connected", False)

        return ReadinessResponse(
            status="ready" if is_ready else "not_ready",
            app=settings.PROJECT_NAME,
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            checks={
                "database": db_health,
                "llm_engine": llm_status,
            },
        )
