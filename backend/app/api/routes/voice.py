from pathlib import PurePath

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import AuditEvent, CandidateConsent, UserRole
from app.schemas.api import VoiceTranscriptRead
from app.services.model_providers import ModelProviderError, transcribe_audio


router = APIRouter(prefix="/voice", tags=["optional voice accessibility"])
settings = get_settings()
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
}


@router.post("/transcribe", response_model=VoiceTranscriptRead)
async def create_editable_transcript(
    file: UploadFile = File(...),
    identity: dict = Depends(require_verified_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> VoiceTranscriptRead:
    if not settings.voice_transcription_enabled or not settings.transcription_api_url or not settings.ai_api_key:
        raise HTTPException(status_code=503, detail="Optional voice transcription is not configured")
    consent = await db.scalar(
        select(CandidateConsent).where(
            CandidateConsent.candidate_id == identity["sub"],
            CandidateConsent.purpose == "external_model_processing",
            CandidateConsent.granted.is_(True),
        )
    )
    if consent is None:
        raise HTTPException(
            status_code=403,
            detail="Enable optional external AI processing in Account before sending audio for transcription",
        )
    media_type = (file.content_type or "").lower()
    if media_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=422, detail="Supported audio formats are WebM, WAV, MP3, MP4 and OGG")
    audio = await file.read(settings.max_interview_audio_bytes + 1)
    if not audio:
        raise HTTPException(status_code=422, detail="Audio recording is empty")
    if len(audio) > settings.max_interview_audio_bytes:
        raise HTTPException(status_code=413, detail="Audio recording exceeds the configured size limit")
    filename = PurePath(file.filename or "answer.webm").name[:160]
    try:
        transcript = await transcribe_audio(
            settings.transcription_api_url,
            settings.transcription_model,
            settings.ai_api_key,
            filename=filename,
            media_type=media_type,
            audio=audio,
            timeout_seconds=settings.ai_request_timeout_seconds,
        )
    except (httpx.HTTPError, ModelProviderError) as exc:
        raise HTTPException(status_code=502, detail="The transcription provider could not process this recording") from exc
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="interview_audio_transcribed_and_discarded",
            resource_type="candidate",
            resource_id=identity["sub"],
            details={
                "audio_retained": False,
                "audio_features_evaluated": False,
                "transcript_characters": len(transcript),
                "model": settings.transcription_model,
            },
        )
    )
    await db.commit()
    return VoiceTranscriptRead(
        transcript=transcript,
        model_version=settings.transcription_model,
        notice=(
            "The recording was used only to create this editable text and was not retained. "
            "Evaluation receives the text only and cannot access voice, accent, emotion or biometric signals."
        ),
    )
