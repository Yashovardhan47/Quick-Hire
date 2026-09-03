from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.matching import compute_match
from app.db.session import get_db
from app.models.entities import Application, Job, UserRole
from app.schemas.api import ApplicationCreate, ApplicationRead


router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=ApplicationRead, status_code=201)
async def apply(
    payload: ApplicationCreate,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> Application:
    job = await db.get(Job, payload.job_id)
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Published job not found")
    match = await compute_match(job.id, identity["sub"], db)
    application = Application(
        job_id=job.id,
        candidate_id=identity["sub"],
        fit_score=match.score,
        fit_confidence=match.confidence,
        explanation=match.model_dump(mode="json"),
    )
    db.add(application)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already applied") from exc
    await db.refresh(application)
    return application


@router.get("/me", response_model=list[ApplicationRead])
async def my_applications(
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> list[Application]:
    result = await db.scalars(
        select(Application)
        .where(Application.candidate_id == identity["sub"])
        .order_by(Application.created_at.desc())
    )
    return list(result)

