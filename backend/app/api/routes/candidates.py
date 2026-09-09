from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.matching import refresh_candidate_matches
from app.db.session import get_db
from app.models.entities import CandidateEvidence, CandidateProfile, UserRole
from app.schemas.api import CandidateProfileInput, EvidenceCreate, EvidenceRead


router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("/me/profile", response_model=CandidateProfileInput)
async def get_profile(
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> CandidateProfile:
    profile = await db.get(CandidateProfile, identity["sub"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return profile


@router.put("/me/profile", response_model=CandidateProfileInput)
async def upsert_profile(
    payload: CandidateProfileInput,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> CandidateProfile:
    profile = await db.get(CandidateProfile, identity["sub"])
    if profile is None:
        profile = CandidateProfile(user_id=identity["sub"])
        db.add(profile)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/me/evidence", response_model=list[EvidenceRead])
async def list_evidence(
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> list[CandidateEvidence]:
    result = await db.scalars(select(CandidateEvidence).where(CandidateEvidence.candidate_id == identity["sub"]))
    return list(result)


@router.post("/me/evidence", response_model=EvidenceRead, status_code=201)
async def add_evidence(
    payload: EvidenceCreate,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> CandidateEvidence:
    if payload.verified:
        raise HTTPException(status_code=400, detail="Candidates cannot self-verify evidence")
    evidence = CandidateEvidence(candidate_id=identity["sub"], **payload.model_dump())
    db.add(evidence)
    await refresh_candidate_matches(identity["sub"], db)
    await db.commit()
    await db.refresh(evidence)
    return evidence
