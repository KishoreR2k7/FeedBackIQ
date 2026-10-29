"""Application configuration using Pydantic Settings."""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "FeedbackIQ"
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    SECRET_KEY: str = "feedbackiq_super_secret_jwt_key_2026_dev_secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    DATABASE_URL: str = "postgresql+psycopg://postgres:kishore@localhost:5432/feedbackiq"
    TEST_DATABASE_URL: str = "postgresql+psycopg://postgres:kishore@localhost:5432/feedbackiq_test"
    
    PUBLIC_URL: str = "http://localhost:8000"
    
    # LLM Policy Chain
    LLM_CHAIN: str = "groq:qwen/qwen3.8-27b,groq:llama-3.3-70b-versatile,ollama:gemma3:4b,ollama:llama3:8b,ollama:qwen2.5:1.5b,rules"
    GROQ_API_KEY: str = ""
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LLM_TIMEOUT_SECONDS: int = 15
    
    # CSRF & Security
    CSRF_SECRET_KEY: str = "feedbackiq_csrf_secret_key_8493028401923"
    RATE_LIMIT_PUBLIC_PER_MINUTE: int = 15
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def parsed_llm_chain(self) -> List[str]:
        return [item.strip() for item in self.LLM_CHAIN.split(",") if item.strip()]


settings = Settings()
