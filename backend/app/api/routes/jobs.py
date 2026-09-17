from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles, require_verified_roles
from app.db.session import get_db
from app.api.routes.realtime import manager
from app.models.entities import Application, AuditEvent, Job, UserRole
from app.schemas.api import JobCreate, JobRead, JobStatusUpdate
from app.services.ai_policy import PolicyViolation, require_job_related_text
from app.services.notifications import queue_notification


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
) -> list[Job]:
    result = await db.scalars(select(Job).where(Job.status == "published").order_by(Job.created_at.desc()))
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
    if not job or job.status != "published":
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("", response_model=JobRead, status_code=201)
async def create_job(
    payload: JobCreate,
    identity: dict = Depends(require_verified_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Job:
    try:
        require_job_related_text(
            "Job and competency rubric",
            payload.title,
            payload.description,
            *(requirement.name for requirement in payload.requirements),
        )
    except PolicyViolation as exc:
        db.add(
            AuditEvent(
                actor_id=identity["sub"],
                action="prohibited_job_criteria_blocked",
                resource_type="job_draft",
                resource_id=None,
                details={"policy_categories": exc.categories},
            )
        )
        await db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
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


@router.patch("/{job_id}/status", response_model=JobRead)
async def update_job_status(
    job_id: str,
    payload: JobStatusUpdate,
    identity: dict = Depends(require_verified_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Job:
    job = await db.get(Job, job_id)
    if job is None or (identity["role"] != UserRole.admin.value and job.recruiter_id != identity["sub"]):
        raise HTTPException(status_code=404, detail="Job not found")
    previous = job.status
    if previous == payload.status:
        return job
    job.status = payload.status
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="job_status_changed",
            resource_type="job",
            resource_id=job.id,
            details={"from_status": previous, "to_status": payload.status},
        )
    )
    if payload.status == "closed":
        applications = list(await db.scalars(select(Application).where(Application.job_id == job.id)))
        for application in applications:
            await queue_notification(
                db,
                user_id=application.candidate_id,
                event_type="job.closed",
                title=f"Job listing closed: {job.title}",
                body="The listing is no longer accepting new applications. Your existing application record remains available.",
                data={"job_id": job.id, "application_id": application.id},
            )
    await db.commit()
    await db.refresh(job)
    if payload.status == "closed":
        for application in applications:
            await manager.send(application.candidate_id, {"type": "job.closed", "job_id": job.id})
    return job
