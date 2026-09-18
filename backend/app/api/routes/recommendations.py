from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.matching import compute_match
from app.db.session import get_db
from app.models.entities import CandidateEvidence, CandidateProfile, Job, UserRole
from app.schemas.api import JobRecommendation
from app.services.knowledge_retrieval import retrieve_job_ids


router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/me/jobs", response_model=list[JobRecommendation])
async def recommend_jobs(
    limit: int = Query(default=10, ge=1, le=50),
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> list[JobRecommendation]:
    profile = await db.get(CandidateProfile, identity["sub"])
    evidence = list(
        await db.scalars(select(CandidateEvidence).where(CandidateEvidence.candidate_id == identity["sub"]))
    )
    retrieval_query = " ".join(
        [*(profile.skills if profile else []), *(f"{item.skill} {item.description}" for item in evidence)]
    )
    vector_job_ids = await retrieve_job_ids(db, query=retrieval_query, limit=100) if retrieval_query.strip() else []
    if vector_job_ids:
        vector_jobs = list(
            await db.scalars(select(Job).where(Job.status == "published", Job.id.in_(vector_job_ids)))
        )
        indexed = {job.id for job in vector_jobs}
        fallback_jobs = list(
            await db.scalars(
                select(Job)
                .where(Job.status == "published", Job.id.not_in(indexed))
                .order_by(Job.created_at.desc())
                .limit(max(0, 100 - len(vector_jobs)))
            )
        )
        jobs = [*vector_jobs, *fallback_jobs]
    else:
        jobs = list(
            await db.scalars(select(Job).where(Job.status == "published").order_by(Job.created_at.desc()).limit(100))
        )
    recommendations = []
    for job in jobs:
        match = await compute_match(job.id, identity["sub"], db)
        rank_score = match.score * (0.6 + 0.4 * match.confidence)
        recommendations.append(
            JobRecommendation(
                job_id=job.id,
                title=job.title,
                company=job.company,
                location=job.location,
                rank_score=round(rank_score, 1),
                match=match,
            )
        )
    return sorted(recommendations, key=lambda item: item.rank_score, reverse=True)[:limit]
