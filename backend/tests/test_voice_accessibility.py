from io import BytesIO
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.datastructures import Headers, UploadFile

from app.api.routes import voice
from app.models.entities import AuditEvent, Base, CandidateConsent, User, UserRole


@pytest.mark.asyncio
async def test_voice_is_transcribed_to_text_and_audio_is_never_persisted(monkeypatch) -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    monkeypatch.setattr(
        voice,
        "settings",
        SimpleNamespace(
            voice_transcription_enabled=True,
            transcription_api_url="https://models.example.test/audio/transcriptions",
            transcription_model="whisper-test",
            ai_api_key="secret",
            max_interview_audio_bytes=1_000_000,
            ai_request_timeout_seconds=1,
        ),
    )

    async def fake_transcription(*args, **kwargs) -> str:
        assert kwargs["audio"] == b"bounded-audio"
        return "I built and tested a Python validation service."

    monkeypatch.setattr(voice, "transcribe_audio", fake_transcription)
    async with sessions() as db:
        candidate = User(
            email="candidate@example.com",
            full_name="Candidate",
            role=UserRole.candidate,
            email_verified=True,
        )
        db.add(candidate)
        await db.flush()
        db.add(
            CandidateConsent(
                candidate_id=candidate.id,
                purpose="external_model_processing",
                granted=True,
                policy_version="test",
            )
        )
        await db.commit()
        upload = UploadFile(
            file=BytesIO(b"bounded-audio"),
            filename="answer.webm",
            headers=Headers({"content-type": "audio/webm"}),
        )
        response = await voice.create_editable_transcript(
            upload,
            {"sub": candidate.id, "role": "candidate"},
            db,
        )
        assert response.transcript.startswith("I built")
        assert response.retained_audio is False
        assert response.evaluation_basis == "answer_text_only"
        event = await db.scalar(select(AuditEvent).where(AuditEvent.action == "interview_audio_transcribed_and_discarded"))
        assert event is not None
        assert event.details["audio_retained"] is False
        assert event.details["audio_features_evaluated"] is False
    await engine.dispose()
