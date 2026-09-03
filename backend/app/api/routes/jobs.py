from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.entities import AuditEvent, Job, UserRole
from app.schemas.api import JobCreate, JobRead


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
async def list_jobs(
    status: str = Query(default="published"),
    db: AsyncSession = Depends(get_db),
) -> list[Job]:
    result = await db.scalars(select(Job).where(Job.status == status).order_by(Job.created_at.desc()))
    return list(result)


@router.get("/mine", response_model=list[JobRead])
async def my_jobs(
    identity: dict = Depends(require_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[Job]:
    query = select(Job).order_by(Job.created_at.desc())
    if identity["role"] != UserRole.admin.value:
        query = query.where(Job.recruiter_id == identity["sub"])
    return list(await db.scalars(query))


@router.get("/{job_id}", response_model=JobRead)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)) -> Job:
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobRead, status_code=201)
async def create_job(
    payload: JobCreate,
    identity: dict = Depends(require_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Job:
    job = Job(recruiter_id=identity["sub"], **payload.model_dump(mode="json"))
    db.add(job)
    await db.flush()
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="job_created",
            resource_type="job",
            resource_id=job.id,
            details={"status": job.status, "requirement_count": len(job.requirements)},
        )
    )
    await db.commit()
    await db.refresh(job)
    return job
