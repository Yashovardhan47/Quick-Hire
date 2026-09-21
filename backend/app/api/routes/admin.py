from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_verified_roles
from app.api.routes.realtime import manager
from app.core.config import get_settings
from app.core.security import generate_action_token, hash_action_token
from app.db.session import get_db
from app.models.entities import (
    Application,
    AdminInvite,
    AgentRun,
    AssessmentAttempt,
    AuditEvent,
    CandidateDocument,
    CandidateKnowledgeChunk,
    CandidateRequest,
    InterviewSchedule,
    InterviewSession,
    Job,
    JobKnowledgeChunk,
    Message,
    NotificationDelivery,
    User,
    UserRole,
    utcnow,
)
from app.schemas.api import AdminInviteCreate, AdminInviteIssued, AIPolicyRead, PlatformMetrics
from app.services.ai_policy import policy_manifest
from app.services.semantic_matching import MODEL_VERSION


router = APIRouter(prefix="/admin", tags=["platform governance"])


@router.post("/invites", response_model=AdminInviteIssued, status_code=201)
async def issue_admin_invite(
    payload: AdminInviteCreate,
    identity: dict = Depends(require_verified_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminInviteIssued:
    email = payload.email.lower()
    if await db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account already uses this email")
    await db.execute(
        update(AdminInvite)
        .where(
            AdminInvite.email == email,
            AdminInvite.used_at.is_(None),
            AdminInvite.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow())
    )
    raw_token = generate_action_token()
    expires_at = datetime.now(UTC) + timedelta(hours=payload.expires_in_hours)
    invite = AdminInvite(
        email=email,
        token_hash=hash_action_token(raw_token),
        created_by=identity["sub"],
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="admin_invitation_issued",
            resource_type="admin_invite",
            resource_id=invite.id,
            details={"expires_at": expires_at.isoformat(), "single_use": True, "email_bound": True},
        )
    )
    await db.commit()
    query = urlencode({"mode": "register", "role": "admin", "invite": raw_token, "email": email})
    return AdminInviteIssued(
        email=email,
        expires_at=expires_at,
        invite_token=raw_token,
        signup_url=f"{get_settings().public_frontend_url.rstrip('/')}/login?{query}",
    )


@router.get("/ai-policy", response_model=AIPolicyRead)
async def active_ai_policy(
    _: dict = Depends(require_verified_roles(UserRole.admin)),
) -> AIPolicyRead:
    return AIPolicyRead.model_validate(policy_manifest())


async def _count(db: AsyncSession, model, *conditions) -> int:
    query = select(func.count()).select_from(model)
    if conditions:
        query = query.where(*conditions)
    return int((await db.scalar(query)) or 0)


@router.get("/metrics", response_model=PlatformMetrics)
async def platform_metrics(
    _: dict = Depends(require_verified_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> PlatformMetrics:
    settings = get_settings()
    return PlatformMetrics(
        users=await _count(db, User),
        candidates=await _count(db, User, User.role == UserRole.candidate),
        recruiters=await _count(db, User, User.role == UserRole.recruiter),
        candidate_documents=await _count(db, CandidateDocument),
        published_jobs=await _count(db, Job, Job.status == "published"),
        applications=await _count(db, Application),
        completed_assessments=await _count(db, AssessmentAttempt, AssessmentAttempt.status == "completed"),
        completed_mock_interviews=await _count(db, InterviewSession, InterviewSession.status == "completed"),
        audit_events=await _count(db, AuditEvent),
        live_connections=sum(len(sockets) for sockets in manager.connections.values()),
        messages=await _count(db, Message),
        scheduled_interviews=await _count(db, InterviewSchedule),
        pending_email_deliveries=await _count(db, NotificationDelivery, NotificationDelivery.status == "pending"),
        failed_email_deliveries=await _count(db, NotificationDelivery, NotificationDelivery.status == "failed"),
        open_candidate_requests=await _count(
            db, CandidateRequest, CandidateRequest.status.in_(["submitted", "in_review"])
        ),
        knowledge_chunks=(
            await _count(db, CandidateKnowledgeChunk) + await _count(db, JobKnowledgeChunk)
        ),
        agent_runs=await _count(db, AgentRun),
        model_version=MODEL_VERSION,
        evaluation_state=(
            "approved"
            if settings.require_calibrated_model and settings.calibration_model_path
            else "evaluating"
            if settings.calibration_model_path
            else "dataset_required"
        ),
    )
