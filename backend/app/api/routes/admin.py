from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.realtime import manager
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import (
    Application,
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
)
from app.schemas.api import AIPolicyRead, PlatformMetrics
from app.services.ai_policy import policy_manifest
from app.services.semantic_matching import MODEL_VERSION


router = APIRouter(prefix="/admin", tags=["platform governance"])


@router.get("/ai-policy", response_model=AIPolicyRead)
async def active_ai_policy(
    _: dict = Depends(require_roles(UserRole.admin)),
) -> AIPolicyRead:
    return AIPolicyRead.model_validate(policy_manifest())


async def _count(db: AsyncSession, model, *conditions) -> int:
    query = select(func.count()).select_from(model)
    if conditions:
        query = query.where(*conditions)
    return int((await db.scalar(query)) or 0)


@router.get("/metrics", response_model=PlatformMetrics)
async def platform_metrics(
    _: dict = Depends(require_roles(UserRole.admin)),
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
