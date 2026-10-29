import json
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PROJECT_NAME: str = "FeedbackIQ"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5433
    POSTGRES_USER: str = "feedbackiq_user"
    POSTGRES_PASSWORD: str = "feedbackiq_secret_pass"
    POSTGRES_DB: str = "feedbackiq"
    DATABASE_URL: str = (
        "postgresql+asyncpg://feedbackiq_user:feedbackiq_secret_pass@localhost:5433/feedbackiq"
    )

    # Security & JWT
    SECRET_KEY: str = "feedbackiq-dev-jwt-secret-key-super-secure-change-in-prod-32bytes"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            try:
                return json.loads(v)
            except Exception:
                return ["*"]
        return v

    # AI / LLM Configuration
    LLM_PROVIDER: str = "mock"  # "mock", "gemini", "groq", "openai"
    LLM_MODEL: str = "gemini-1.5-flash"
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Priority Engine Weights & Overrides (Phase 2)
    PRIORITY_WEIGHT_SEVERITY: float = 0.50
    PRIORITY_WEIGHT_RECURRENCE: float = 0.30
    PRIORITY_WEIGHT_FREQUENCY: float = 0.20
    PRIORITY_SAFETY_OVERRIDE_FLOOR: float = 85.0


settings = Settings()
