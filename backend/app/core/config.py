from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    app_name: str = "QuickHire EvidenceGraph API"
    app_env: str = "development"
    secret_key: str = Field(default="development-only-change-me-use-32-bytes", min_length=32)
    jwt_issuer: str = "quickhire-evidencegraph"
    jwt_audience: str = "quickhire-web"
    access_token_minutes: int = Field(default=15, ge=5, le=120)
    refresh_token_days: int = Field(default=14, ge=1, le=90)
    refresh_cookie_name: str = "quickhire_refresh"
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "strict"
    google_client_id: str | None = None
    require_google_auth: bool = False
    database_url: str = "postgresql+asyncpg://quickhire:quickhire@localhost:5432/quickhire"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origins: str = "http://localhost:5173"
    allowed_hosts: str = "localhost,127.0.0.1,testserver,quickhire.test"
    public_frontend_url: str = "http://localhost:5173"
    auto_create_tables: bool = True
    auth_rate_limit_per_minute: int = Field(default=12, ge=3, le=300)
    require_email_verification: bool = False
    email_verification_hours: int = Field(default=24, ge=1, le=168)
    password_reset_minutes: int = Field(default=30, ge=10, le=120)
    email_delivery_enabled: bool = False
    email_provider: Literal["disabled", "resend"] = "disabled"
    email_from: str = "QuickHire <notifications@example.invalid>"
    resend_api_key: str | None = None
    notification_poll_seconds: float = Field(default=2.0, ge=0.25, le=60)
    notification_max_attempts: int = Field(default=5, ge=1, le=20)
    ai_provider: str = "local"
    ai_api_key: str | None = None
    external_model_data_processing_enabled: bool = False
    embedding_api_url: str | None = None
    embedding_model: str = "multilingual-embedding-model"
    reranker_api_url: str | None = None
    reranker_model: str = "cross-encoder-reranker"
    ai_request_timeout_seconds: float = 8.0
    max_resume_bytes: int = 5_242_880
    max_resume_pages: int = 30
    max_resume_characters: int = 100_000
    malware_scan_enabled: bool = False
    malware_scan_required: bool = False
    clamav_host: str = "localhost"
    clamav_port: int = Field(default=3310, ge=1, le=65535)
    malware_scan_timeout_seconds: float = Field(default=15, ge=1, le=60)
    reject_scanned_pdf_without_text: bool = False
    calibration_model_path: str | None = None
    require_calibrated_model: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def host_allowlist(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
