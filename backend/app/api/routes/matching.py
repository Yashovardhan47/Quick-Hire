from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.entities import CandidateEvidence, CandidateProfile, Job, UserRole
from app.schemas.api import MatchResult
from app.services.evidence_graph import EvidenceItem, calculate_match


router = APIRouter(prefix="/matching", tags=["evidence matching"])


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
        )
        for item in records
    ]
    return calculate_match(job.requirements, profile.skills, evidence)


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
    _: dict = Depends(require_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> MatchResult:
    return await compute_match(job_id, candidate_id, db)

