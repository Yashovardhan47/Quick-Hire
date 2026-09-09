from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_identity
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.entities import AuditEvent, CandidateProfile, RefreshSession, User, UserRole, utcnow
from app.schemas.api import (
    AuthMethodsRead,
    GoogleAuthRequest,
    GoogleLinkRequest,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserRead,
)
from app.services.google_identity import GoogleIdentityError, verify_google_credential


router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path="/api/v1/auth",
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path="/api/v1/auth",
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _is_expired(value: datetime) -> bool:
    expires_at = value if value.tzinfo else value.replace(tzinfo=UTC)
    return expires_at <= datetime.now(UTC)


async def _issue_session(
    user: User,
    response: Response,
    db: AsyncSession,
) -> tuple[TokenResponse, RefreshSession]:
    refresh_token = generate_refresh_token()
    session = RefreshSession(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    db.add(session)
    await db.flush()
    _set_refresh_cookie(response, refresh_token)
    token_response = TokenResponse(
        access_token=create_access_token(user.id, user.role.value, session.id),
        expires_in=settings.access_token_minutes * 60,
        user=user,
    )
    return token_response, session


async def _google_identity(credential: str):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        return await verify_google_credential(credential, settings.google_client_id)
    except GoogleIdentityError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    email = payload.email.lower()
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        last_login_at=utcnow(),
    )
    db.add(user)
    await db.flush()
    if user.role == UserRole.candidate:
        db.add(CandidateProfile(user_id=user.id))
    db.add(
        AuditEvent(
            actor_id=user.id,
            action="account_created",
            resource_type="user",
            resource_id=user.id,
            details={"provider": "password", "role": user.role.value},
        )
    )
    token_response, _ = await _issue_session(user, response, db)
    await db.commit()
    return token_response


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    password_valid = verify_password(payload.password, user.password_hash if user else None)
    if not user or not password_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    user.last_login_at = utcnow()
    token_response, _ = await _issue_session(user, response, db)
    await db.commit()
    return token_response


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    payload: GoogleAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    google = await _google_identity(payload.credential)
    user = await db.scalar(select(User).where(User.google_subject == google.subject))
    if user is None:
        email_owner = await db.scalar(select(User).where(User.email == google.email))
        if email_owner:
            raise HTTPException(
                status_code=409,
                detail="An account already uses this email. Sign in with its password, then link Google from Account & safety.",
            )
        if payload.mode != "register":
            raise HTTPException(status_code=404, detail="No linked QuickHire account. Choose Create account first.")
        if payload.role is None:
            raise HTTPException(status_code=422, detail="Choose Job seeker or Recruiter before creating a Google account")
        user = User(
            email=google.email,
            full_name=google.full_name,
            password_hash=None,
            role=payload.role,
            email_verified=True,
            google_subject=google.subject,
            google_linked_at=utcnow(),
        )
        db.add(user)
        await db.flush()
        if user.role == UserRole.candidate:
            db.add(CandidateProfile(user_id=user.id))
        db.add(
            AuditEvent(
                actor_id=user.id,
                action="account_created",
                resource_type="user",
                resource_id=user.id,
                details={"provider": "google", "role": user.role.value},
            )
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Platform administrators must use the controlled admin sign-in method")
    user.last_login_at = utcnow()
    token_response, _ = await _issue_session(user, response, db)
    await db.commit()
    return token_response


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh session is missing")
    session = await db.scalar(
        select(RefreshSession)
        .where(RefreshSession.token_hash == hash_refresh_token(refresh_token))
        .with_for_update()
    )
    if session is None:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh session is invalid")
    if session.revoked_at is not None:
        if session.replaced_by_session_id:
            await db.execute(
                update(RefreshSession)
                .where(RefreshSession.user_id == session.user_id, RefreshSession.revoked_at.is_(None))
                .values(revoked_at=utcnow())
            )
            db.add(
                AuditEvent(
                    actor_id=session.user_id,
                    action="refresh_token_reuse_detected",
                    resource_type="refresh_session",
                    resource_id=session.id,
                    details={"all_active_sessions_revoked": True},
                )
            )
            await db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh session was already used or revoked")
    if _is_expired(session.expires_at):
        session.revoked_at = utcnow()
        await db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh session expired")
    user = await db.get(User, session.user_id)
    if not user or not user.is_active:
        session.revoked_at = utcnow()
        await db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Account is unavailable")

    session.last_used_at = utcnow()
    session.revoked_at = utcnow()
    token_response, replacement = await _issue_session(user, response, db)
    session.replaced_by_session_id = replacement.id
    await db.commit()
    return token_response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> None:
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    _clear_refresh_cookie(response)
    if not refresh_token:
        return
    session = await db.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(refresh_token))
    )
    if session and session.revoked_at is None:
        session.revoked_at = utcnow()
        await db.commit()


@router.get("/methods", response_model=AuthMethodsRead)
async def auth_methods(identity: dict = Depends(get_identity), db: AsyncSession = Depends(get_db)) -> AuthMethodsRead:
    user = await db.get(User, identity["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AuthMethodsRead(
        email=user.email,
        password_enabled=bool(user.password_hash),
        google_linked=user.google_linked,
        email_verified=user.email_verified,
    )


@router.post("/google/link", response_model=AuthMethodsRead)
async def link_google(
    payload: GoogleLinkRequest,
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> AuthMethodsRead:
    user = await db.get(User, identity["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Google linking is disabled for platform administrators")
    google = await _google_identity(payload.credential)
    if google.email != user.email:
        raise HTTPException(status_code=409, detail="Google email must match the signed-in QuickHire account")
    subject_owner = await db.scalar(select(User).where(User.google_subject == google.subject))
    if subject_owner and subject_owner.id != user.id:
        raise HTTPException(status_code=409, detail="This Google account is already linked elsewhere")
    user.google_subject = google.subject
    user.google_linked_at = utcnow()
    user.email_verified = True
    db.add(
        AuditEvent(
            actor_id=user.id,
            action="google_identity_linked",
            resource_type="user",
            resource_id=user.id,
            details={"email_match_required": True},
        )
    )
    await db.commit()
    return AuthMethodsRead(
        email=user.email,
        password_enabled=bool(user.password_hash),
        google_linked=True,
        email_verified=True,
    )


@router.get("/me", response_model=UserRead)
async def me(identity: dict = Depends(get_identity), db: AsyncSession = Depends(get_db)) -> User:
    user = await db.get(User, identity["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
