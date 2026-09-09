from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import Application, AssessmentAttempt, AuditEvent, CandidateDocument, InterviewSession, Job, User, UserRole
from app.schemas.api import PlatformMetrics
from app.services.semantic_matching import MODEL_VERSION


router = APIRouter(prefix="/admin", tags=["platform governance"])


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
        model_version=MODEL_VERSION,
        evaluation_state="dataset_required",
    )
