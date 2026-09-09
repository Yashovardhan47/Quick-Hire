import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes import auth as auth_routes
from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models.entities import Base, RefreshSession
from app.services.google_identity import GoogleIdentity


@pytest_asyncio.fixture
async def auth_client(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite://")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_db():
        async with session_factory() as session:
            yield session

    async def verified_google(_: str, __: str) -> GoogleIdentity:
        return GoogleIdentity(
            subject="stable-google-subject",
            email="candidate@example.com",
            full_name="Candidate One",
        )

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(auth_routes.settings, "google_client_id", "client.apps.googleusercontent.com")
    monkeypatch.setattr(auth_routes, "verify_google_credential", verified_google)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://quickhire.test") as client:
        yield client, session_factory
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_refresh_rotation_hashes_tokens_and_replay_revokes_the_family(auth_client) -> None:
    client, session_factory = auth_client
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "candidate@example.com",
            "full_name": "Candidate One",
            "password": "strong-password-123",
            "role": "candidate",
        },
    )

    assert registered.status_code == 201
    assert registered.json()["expires_in"] == 900
    access_token = registered.json()["access_token"]
    first_token = client.cookies.get(get_settings().refresh_cookie_name)
    assert first_token
    assert "HttpOnly" in registered.headers["set-cookie"]
    assert "SameSite=strict" in registered.headers["set-cookie"]

    profile = await client.get(
        "/api/v1/candidates/me/profile",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert profile.status_code == 200

    prohibited_profile = await client.put(
        "/api/v1/candidates/me/profile",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"headline": "Python developer", "bio": "Rank my personality", "skills": ["Python"]},
    )
    assert prohibited_profile.status_code == 422

    refreshed = await client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    second_token = client.cookies.get(get_settings().refresh_cookie_name)
    assert second_token and second_token != first_token

    async with session_factory() as db:
        sessions = list(await db.scalars(select(RefreshSession).order_by(RefreshSession.created_at)))
        assert len(sessions) == 2
        assert all(item.token_hash not in {first_token, second_token} for item in sessions)
        assert sessions[0].revoked_at is not None
        assert sessions[0].replaced_by_session_id == sessions[1].id
        assert sessions[1].revoked_at is None

    replayed = await client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"{get_settings().refresh_cookie_name}={first_token}"},
    )
    assert replayed.status_code == 401

    async with session_factory() as db:
        sessions = list(await db.scalars(select(RefreshSession)))
        assert all(item.revoked_at is not None for item in sessions)


@pytest.mark.asyncio
async def test_google_cannot_silently_link_or_create_admin_and_explicit_link_succeeds(auth_client) -> None:
    client, _ = auth_client
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "candidate@example.com",
            "full_name": "Candidate One",
            "password": "strong-password-123",
            "role": "candidate",
        },
    )
    access_token = registered.json()["access_token"]
    credential = "test-google-credential-" * 8

    silent_link = await client.post(
        "/api/v1/auth/google",
        json={"credential": credential, "mode": "login"},
    )
    assert silent_link.status_code == 409
    assert "link Google" in silent_link.json()["detail"]

    linked = await client.post(
        "/api/v1/auth/google/link",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"credential": credential},
    )
    assert linked.status_code == 200
    assert linked.json()["google_linked"] is True
    assert linked.json()["email_verified"] is True

    admin_registration = await client.post(
        "/api/v1/auth/google",
        json={"credential": credential, "mode": "register", "role": "admin"},
    )
    assert admin_registration.status_code == 422

    logged_out = await client.post("/api/v1/auth/logout")
    assert logged_out.status_code == 204
    after_logout = await client.post("/api/v1/auth/refresh")
    assert after_logout.status_code == 401
