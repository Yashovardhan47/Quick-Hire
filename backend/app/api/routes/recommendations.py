from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.matching import compute_match
from app.db.session import get_db
from app.models.entities import Job, UserRole
from app.schemas.api import JobRecommendation


router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/me/jobs", response_model=list[JobRecommendation])
async def recommend_jobs(
    limit: int = Query(default=10, ge=1, le=50),
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> list[JobRecommendation]:
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
