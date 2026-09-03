from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.entities import AuditEvent, CandidateEvidence, CandidateProfile, UserRole
from app.schemas.api import JobAnalysisRequest, JobAnalysisResult, ResumeAnalysisRequest, ResumeAnalysisResult
from app.services.talent_intelligence import analyze_job_description, analyze_resume


router = APIRouter(prefix="/intelligence", tags=["talent intelligence"])


@router.post("/resume/analyze", response_model=ResumeAnalysisResult)
async def resume_analysis(
    payload: ResumeAnalysisRequest,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = analyze_resume(payload.text)
    if payload.persist_evidence:
        profile = await db.get(CandidateProfile, identity["sub"])
        if profile is None:
            profile = CandidateProfile(user_id=identity["sub"])
            db.add(profile)
        merged = list(dict.fromkeys([*profile.skills, *(item["skill"] for item in result["skills"])]))
        profile.skills = merged
        if result["experience_years"] is not None:
            profile.experience_years = max(profile.experience_years, result["experience_years"])
        existing_records = list(
            await db.scalars(
                select(CandidateEvidence).where(
                    CandidateEvidence.candidate_id == identity["sub"],
                    CandidateEvidence.source_type == "resume",
                )
            )
        )
        existing_by_skill = {item.skill.casefold(): item for item in existing_records}
        for item in result["skills"]:
            existing = existing_by_skill.get(item["skill"].casefold())
            if existing:
                existing.description = item["evidence_excerpt"]
                existing.confidence = item["confidence"]
            else:
                db.add(
                    CandidateEvidence(
                        candidate_id=identity["sub"],
                        skill=item["skill"],
                        source_type="resume",
                        description=item["evidence_excerpt"],
                        strength=0.55,
                        confidence=item["confidence"],
                        verified=False,
                    )
                )
        db.add(
            AuditEvent(
                actor_id=identity["sub"],
                action="resume_claims_extracted",
                resource_type="candidate_profile",
                resource_id=identity["sub"],
                details={"skill_count": len(result["skills"]), "model_version": result["model_version"]},
            )
        )
        await db.commit()
    return result


@router.post("/job-description/analyze", response_model=JobAnalysisResult)
async def job_analysis(
    payload: JobAnalysisRequest,
    _: dict = Depends(require_roles(UserRole.recruiter, UserRole.admin)),
) -> dict:
    return analyze_job_description(payload.title, payload.description)
