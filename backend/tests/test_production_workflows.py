from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes.recruiter_assistant import assist_recruiter
from app.api.routes.jobs import get_job, list_jobs
from app.models.entities import (
    Application,
    Base,
    Job,
    Notification,
    NotificationDelivery,
    NotificationPreference,
    User,
    UserRole,
)
from app.schemas.api import CandidateProfileInput, LoginRequest, RecruiterAssistantRequest
from app.services import notifications as notification_service


@pytest.mark.asyncio
async def test_notification_and_email_outbox_are_atomic(monkeypatch) -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    monkeypatch.setattr(
        notification_service,
        "get_settings",
        lambda: SimpleNamespace(email_delivery_enabled=True),
    )
    async with sessions() as db:
        user = User(email="candidate@example.com", full_name="Candidate", role=UserRole.candidate)
        db.add(user)
        await db.flush()
        notification = await notification_service.queue_notification(
            db,
            user_id=user.id,
            event_type="application.status_changed",
            title="Application update",
            body="A recruiter recorded a human-owned stage update.",
        )
        await db.commit()
        assert await db.get(Notification, notification.id) is not None
        assert await db.get(NotificationPreference, user.id) is not None
        delivery = await db.scalar(
            select(NotificationDelivery).where(NotificationDelivery.notification_id == notification.id)
        )
        assert delivery is not None
        assert delivery.status == "pending"
        assert delivery.channel == "email"
    await engine.dispose()


@pytest.mark.asyncio
async def test_recruiter_assistant_is_advisory_and_scoped() -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with sessions() as db:
        recruiter = User(email="recruiter@example.com", full_name="Recruiter", role=UserRole.recruiter)
        candidate = User(email="candidate@example.com", full_name="Candidate", role=UserRole.candidate)
        db.add_all([recruiter, candidate])
        await db.flush()
        job = Job(
            recruiter_id=recruiter.id,
            title="Data Engineer",
            company="Example",
            description="Build reliable data pipelines and measurable services.",
            requirements=[{"name": "Python", "weight": 1, "mandatory": True}],
            status="published",
        )
        db.add(job)
        await db.flush()
        application = Application(
            job_id=job.id,
            candidate_id=candidate.id,
            explanation={"missing_requirements": ["Python"], "next_best_actions": ["Complete a Python check"]},
        )
        db.add(application)
        await db.commit()

        response = await assist_recruiter(
            job.id,
            RecruiterAssistantRequest(action="interview_plan", application_id=application.id),
            {"sub": recruiter.id, "role": "recruiter"},
            db,
        )
        assert response.decision_notice == "advisory_only_human_decision_required"
        assert any("editable answer text" in item.lower() for item in [response.summary, *response.items])
        assert any("Never score face" in warning for warning in response.warnings)
        refreshed = await db.get(Application, application.id)
        assert refreshed.status.value == "applied"
    await engine.dispose()


@pytest.mark.asyncio
async def test_public_marketplace_never_exposes_unpublished_jobs() -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with sessions() as db:
        recruiter = User(email="owner@example.com", full_name="Owner", role=UserRole.recruiter)
        db.add(recruiter)
        await db.flush()
        published = Job(
            recruiter_id=recruiter.id,
            title="Published role",
            company="Example",
            description="Build and operate measurable production services.",
            requirements=[{"name": "Python", "weight": 1, "mandatory": True}],
            status="published",
        )
        draft = Job(
            recruiter_id=recruiter.id,
            title="Confidential draft",
            company="Example",
            description="An unpublished role that must stay private.",
            requirements=[{"name": "SQL", "weight": 1, "mandatory": True}],
            status="draft",
        )
        db.add_all([published, draft])
        await db.commit()

        public_jobs = await list_jobs(db)
        assert [job.id for job in public_jobs] == [published.id]
        with pytest.raises(HTTPException) as caught:
            await get_job(draft.id, db)
        assert caught.value.status_code == 404
    await engine.dispose()


def test_high_cost_and_persistent_inputs_are_bounded_and_normalized() -> None:
    with pytest.raises(ValueError):
        LoginRequest(email="candidate@example.com", password="x" * 129)
    profile = CandidateProfileInput(skills=[" Python ", "python", "SQL"])
    assert profile.skills == ["Python", "SQL"]
    with pytest.raises(ValueError):
        CandidateProfileInput(skills=["x" * 161])
