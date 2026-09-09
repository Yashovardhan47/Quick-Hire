from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    admin,
    applications,
    assessments,
    auth,
    candidates,
    intelligence,
    interviews,
    jobs,
    matching,
    realtime,
    recommendations,
)
from app.core.config import get_settings
from app.db.session import engine
from app.models import Base


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.app_env == "production" and settings.secret_key == "development-only-change-me-use-32-bytes":
        raise RuntimeError("SECRET_KEY must be configured in production")
    if settings.app_env == "production" and not settings.refresh_cookie_secure:
        raise RuntimeError("REFRESH_COOKIE_SECURE must be enabled in production")
    if settings.auto_create_tables:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.4.0",
    description="Explainable recruitment intelligence with human-owned employment decisions.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(matching.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")
app.include_router(interviews.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(realtime.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "service": "quickhire-evidencegraph", "version": "0.4.0"}
