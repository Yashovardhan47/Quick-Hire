from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Application, ApplicationStatus, CandidateEvidence, CandidateProfile, Job, UserRole
from app.schemas.api import MatchResult
from app.services.evidence_graph import EvidenceItem
from app.services.semantic_matching import calculate_configured_hybrid_match


router = APIRouter(prefix="/matching", tags=["evidence matching"])
settings = get_settings()


async def compute_match(job_id: str, candidate_id: str, db: AsyncSession) -> MatchResult:
    job = await db.get(Job, job_id)
    profile = await db.get(CandidateProfile, candidate_id)
    if not job or not profile:
        raise HTTPException(status_code=404, detail="Job or candidate profile not found")
    records = await db.scalars(select(CandidateEvidence).where(CandidateEvidence.candidate_id == candidate_id))
    evidence = [
        EvidenceItem(
            skill=item.skill,
            description=item.description,
            strength=item.strength,
            confidence=item.confidence,
            verified=item.verified,
            source_uri=item.source_uri,
        )
        for item in records
    ]
    return await calculate_configured_hybrid_match(job.description, job.requirements, profile.skills, evidence, settings)


async def refresh_candidate_matches(candidate_id: str, db: AsyncSession) -> list[str]:
    active_statuses = [
        ApplicationStatus.applied,
        ApplicationStatus.under_review,
        ApplicationStatus.assessment,
        ApplicationStatus.interview,
        ApplicationStatus.offer,
    ]
    applications = list(
        await db.scalars(
            select(Application)
            .where(Application.candidate_id == candidate_id, Application.status.in_(active_statuses))
            .limit(50)
        )
    )
    for application in applications:
        match = await compute_match(application.job_id, candidate_id, db)
        application.fit_score = match.score
        application.fit_confidence = match.confidence
        application.explanation = match.model_dump(mode="json")
    return [application.id for application in applications]


@router.get("/jobs/{job_id}/me", response_model=MatchResult)
async def match_me(
    job_id: str,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> MatchResult:
    return await compute_match(job_id, identity["sub"], db)


@router.get("/jobs/{job_id}/candidates/{candidate_id}", response_model=MatchResult)
async def recruiter_match(
    job_id: str,
    candidate_id: str,
    identity: dict = Depends(require_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> MatchResult:
    job = await db.get(Job, job_id)
    if not job or (identity["role"] != UserRole.admin.value and job.recruiter_id != identity["sub"]):
        raise HTTPException(status_code=404, detail="Job not found")
    return await compute_match(job_id, candidate_id, db)
