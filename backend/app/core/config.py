from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    app_name: str = "QuickHire EvidenceGraph API"
    app_env: str = "development"
    secret_key: str = Field(default="development-only-change-me", min_length=16)
    access_token_minutes: int = 60
    database_url: str = "postgresql+asyncpg://quickhire:quickhire@localhost:5432/quickhire"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origins: str = "http://localhost:5173"
    auto_create_tables: bool = True
    ai_provider: str = "local"
    ai_api_key: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

