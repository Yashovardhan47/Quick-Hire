from fastapi import APIRouter, HTTPException
from redis.asyncio import Redis
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.services.malware_scanner import MalwareScanError, ping as ping_malware_scanner


router = APIRouter(tags=["system"])


@router.get("/api/v1/capabilities")
async def capabilities() -> dict:
    settings = get_settings()
    return {
        "rag_vector_retrieval": True,
        "multi_agent_workflows": True,
        "external_llm_configured": bool(
            settings.external_model_data_processing_enabled
            and settings.llm_api_url
            and settings.ai_api_key
        ),
        "voice_transcription_configured": bool(
            settings.voice_transcription_enabled
            and settings.transcription_api_url
            and settings.ai_api_key
        ),
        "voice_evaluation_enabled": False,
        "autonomous_hiring_enabled": False,
    }


@router.get("/health/live")
async def liveness() -> dict:
    return {"status": "ok", "service": "quickhire-api"}


@router.get("/health/ready")
async def readiness() -> dict:
    settings = get_settings()
    checks: dict[str, str] = {}
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        await redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"
    finally:
        await redis.aclose()
    checks["email"] = "configured" if settings.email_delivery_enabled else "disabled"
    checks["google"] = "configured" if settings.google_client_id else "disabled"
    checks["calibration"] = "configured" if settings.calibration_model_path else "baseline"
    if settings.malware_scan_enabled:
        try:
            await ping_malware_scanner(
                settings.clamav_host,
                settings.clamav_port,
                min(settings.malware_scan_timeout_seconds, 5),
            )
            checks["malware_scanner"] = "ok"
        except MalwareScanError:
            checks["malware_scanner"] = "unavailable"
    else:
        checks["malware_scanner"] = "disabled"
    if checks["database"] != "ok" or checks["redis"] != "ok" or (
        settings.malware_scan_required and checks["malware_scanner"] != "ok"
    ):
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ready", "checks": checks}
