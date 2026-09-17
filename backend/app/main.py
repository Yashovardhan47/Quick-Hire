from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes import (
    admin,
    applications,
    assessments,
    auth,
    candidates,
    consents,
    candidate_requests,
    communications,
    intelligence,
    interviews,
    jobs,
    matching,
    notifications,
    realtime,
    recruiter_assistant,
    recommendations,
    schedules,
    system,
)
from app.core.config import get_settings
from app.core.observability import request_observability
from app.db.session import engine
from app.models import Base
from app.api.routes.realtime import manager


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.app_env == "production" and settings.secret_key == "development-only-change-me-use-32-bytes":
        raise RuntimeError("SECRET_KEY must be configured in production")
    if settings.app_env == "production" and not settings.refresh_cookie_secure:
        raise RuntimeError("REFRESH_COOKIE_SECURE must be enabled in production")
    if settings.app_env == "production" and settings.auto_create_tables:
        raise RuntimeError("AUTO_CREATE_TABLES must be disabled in production; run versioned migrations")
    if settings.app_env == "production" and "*" in settings.cors_origins:
        raise RuntimeError("Wildcard CORS is forbidden when credentials are enabled")
    if settings.app_env == "production" and any(not origin.startswith("https://") for origin in settings.cors_origins):
        raise RuntimeError("Production CORS origins must use HTTPS")
    if settings.app_env == "production" and "*" in settings.host_allowlist:
        raise RuntimeError("Wildcard host allowlists are forbidden in production")
    if settings.app_env == "production" and not settings.public_frontend_url.startswith("https://"):
        raise RuntimeError("PUBLIC_FRONTEND_URL must use HTTPS in production")
    if settings.require_google_auth and not settings.google_client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is required when REQUIRE_GOOGLE_AUTH is enabled")
    if settings.email_delivery_enabled and (
        settings.email_provider != "resend" or not settings.resend_api_key or "example.invalid" in settings.email_from
    ):
        raise RuntimeError("A valid Resend email configuration is required when email delivery is enabled")
    if settings.require_email_verification and not settings.email_delivery_enabled:
        raise RuntimeError("Email delivery must be enabled when verified email is required")
    if settings.malware_scan_required and not settings.malware_scan_enabled:
        raise RuntimeError("Malware scanning must be enabled when it is required")
    if settings.require_calibrated_model and (
        not settings.calibration_model_path or not Path(settings.calibration_model_path).is_file()
    ):
        raise RuntimeError("A fitted calibration artifact is required for this production deployment")
    if settings.auto_create_tables:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    await manager.start()
    try:
        yield
    finally:
        await manager.stop()
        await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.5.0",
    description="Explainable recruitment intelligence with human-owned employment decisions.",
    lifespan=lifespan,
    docs_url=None if settings.app_env == "production" else "/docs",
    redoc_url=None if settings.app_env == "production" else "/redoc",
    openapi_url=None if settings.app_env == "production" else "/openapi.json",
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.host_allowlist)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(request_observability)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(consents.router, prefix="/api/v1")
app.include_router(candidate_requests.router, prefix="/api/v1")
app.include_router(communications.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(matching.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(recruiter_assistant.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")
app.include_router(interviews.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(realtime.router, prefix="/api/v1")
app.include_router(system.router)


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "service": "quickhire-evidencegraph", "version": "0.5.0"}
