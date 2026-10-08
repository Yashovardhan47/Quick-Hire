import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes import auth as auth_routes
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import get_db
from app.main import app
from app.models.entities import AdminInvite, Base, Notification, RefreshSession, User, UserRole
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


@pytest.mark.asyncio
async def test_google_only_registration_and_repeat_login_keep_the_original_role(auth_client) -> None:
    client, session_factory = auth_client
    credential = "test-google-credential-" * 8

    registered = await client.post(
        "/api/v1/auth/google",
        json={"credential": credential, "mode": "register", "role": "candidate"},
    )
    assert registered.status_code == 200
    registered_user = registered.json()["user"]
    assert registered_user["role"] == "candidate"
    assert registered_user["email_verified"] is True
    assert registered_user["google_linked"] is True
    access_token = registered.json()["access_token"]
    candidate_headers = {"Authorization": f"Bearer {access_token}"}
    assert (await client.get("/api/v1/candidates/me/profile", headers=candidate_headers)).status_code == 200
    assert (await client.get("/api/v1/jobs/mine", headers=candidate_headers)).status_code == 403

    password_attempt = await client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "strong-password-123"},
    )
    assert password_attempt.status_code == 401

    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    logged_in = await client.post(
        "/api/v1/auth/google",
        json={"credential": credential, "mode": "login", "role": "recruiter"},
    )
    assert logged_in.status_code == 200
    assert logged_in.json()["user"]["id"] == registered_user["id"]
    assert logged_in.json()["user"]["role"] == "candidate"

    async with session_factory() as db:
        users = list(await db.scalars(select(User)))
        assert len(users) == 1
        assert users[0].password_hash is None
        assert users[0].google_subject == "stable-google-subject"


@pytest.mark.asyncio
async def test_selected_role_controls_api_perspective_and_admin_registration_is_invited(auth_client) -> None:
    client, session_factory = auth_client

    uninvited = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "uninvited-admin@example.com",
            "full_name": "Uninvited Admin",
            "password": "strong-password-123",
            "role": "admin",
        },
    )
    assert uninvited.status_code == 422

    async with session_factory() as db:
        bootstrap = User(
            email="bootstrap-admin@example.com",
            full_name="Bootstrap Admin",
            password_hash=hash_password("bootstrap-password-123"),
            role=UserRole.admin,
            email_verified=True,
        )
        db.add(bootstrap)
        await db.commit()

    bootstrap_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "bootstrap-admin@example.com", "password": "bootstrap-password-123"},
    )
    bootstrap_token = bootstrap_login.json()["access_token"]
    bootstrap_headers = {"Authorization": f"Bearer {bootstrap_token}"}
    issued = await client.post(
        "/api/v1/admin/invites",
        headers=bootstrap_headers,
        json={"email": "invited-admin@example.com", "expires_in_hours": 24},
    )
    assert issued.status_code == 201
    invite_token = issued.json()["invite_token"]
    assert "role=admin" in issued.json()["signup_url"]

    wrong_email = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrong-admin@example.com",
            "full_name": "Wrong Admin",
            "password": "strong-password-123",
            "role": "admin",
            "admin_invite_token": invite_token,
        },
    )
    assert wrong_email.status_code == 403

    admin_registration = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "invited-admin@example.com",
            "full_name": "Invited Admin",
            "password": "strong-password-123",
            "role": "admin",
            "admin_invite_token": invite_token,
        },
    )
    assert admin_registration.status_code == 201
    assert admin_registration.json()["user"]["role"] == "admin"
    admin_headers = {"Authorization": f"Bearer {admin_registration.json()['access_token']}"}
    assert (await client.get("/api/v1/auth/me", headers=admin_headers)).json()["role"] == "admin"
    assert (await client.get("/api/v1/admin/metrics", headers=admin_headers)).status_code == 200
    assert (await client.get("/api/v1/candidates/me/profile", headers=admin_headers)).status_code == 403

    reused = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "another-admin@example.com",
            "full_name": "Another Admin",
            "password": "strong-password-123",
            "role": "admin",
            "admin_invite_token": invite_token,
        },
    )
    assert reused.status_code == 403
    async with session_factory() as db:
        invite = await db.scalar(select(AdminInvite).where(AdminInvite.email == "invited-admin@example.com"))
        assert invite is not None and invite.used_at is not None
        assert invite.token_hash != invite_token

    candidate = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "role-candidate@example.com",
            "full_name": "Role Candidate",
            "password": "strong-password-123",
            "role": "candidate",
        },
    )
    candidate_headers = {"Authorization": f"Bearer {candidate.json()['access_token']}"}
    assert candidate.json()["user"]["role"] == "candidate"
    assert (await client.get("/api/v1/candidates/me/profile", headers=candidate_headers)).status_code == 200
    assert (await client.get("/api/v1/jobs/mine", headers=candidate_headers)).status_code == 403
    assert (await client.get("/api/v1/admin/metrics", headers=candidate_headers)).status_code == 403
    assert (
        await client.post(
            "/api/v1/admin/invites",
            headers=candidate_headers,
            json={"email": "forbidden-admin@example.com", "expires_in_hours": 24},
        )
    ).status_code == 403

    recruiter = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "role-recruiter@example.com",
            "full_name": "Role Recruiter",
            "password": "strong-password-123",
            "role": "recruiter",
        },
    )
    recruiter_headers = {"Authorization": f"Bearer {recruiter.json()['access_token']}"}
    assert recruiter.json()["user"]["role"] == "recruiter"
    assert (await client.get("/api/v1/jobs/mine", headers=recruiter_headers)).status_code == 200
    assert (await client.get("/api/v1/candidates/me/profile", headers=recruiter_headers)).status_code == 403
    assert (await client.get("/api/v1/admin/metrics", headers=recruiter_headers)).status_code == 403


@pytest.mark.asyncio
async def test_email_verification_and_password_reset_tokens_are_single_use(auth_client) -> None:
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
    async with session_factory() as db:
        verification = await db.scalar(
            select(Notification).where(Notification.event_type == "auth.verify_email")
        )
        verification_token = verification.data["action_url"].split("token=", 1)[1]

    confirmed = await client.post(
        "/api/v1/auth/email-verification/confirm",
        json={"token": verification_token},
    )
    assert confirmed.status_code == 200
    replayed = await client.post(
        "/api/v1/auth/email-verification/confirm",
        json={"token": verification_token},
    )
    assert replayed.status_code == 400
    async with session_factory() as db:
        user = await db.scalar(select(User).where(User.email == "candidate@example.com"))
        assert user.email_verified is True

    forgot = await client.post(
        "/api/v1/auth/password/forgot",
        json={"email": "candidate@example.com"},
    )
    assert forgot.status_code == 202
    async with session_factory() as db:
        reset_notice = await db.scalar(
            select(Notification)
            .where(Notification.event_type == "auth.password_reset")
            .order_by(Notification.created_at.desc())
        )
        reset_token = reset_notice.data["action_url"].split("token=", 1)[1]
    reset = await client.post(
        "/api/v1/auth/password/reset",
        json={"token": reset_token, "new_password": "new-strong-password-456"},
    )
    assert reset.status_code == 200
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
    logged_in = await client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "new-strong-password-456"},
    )
    assert logged_in.status_code == 200
