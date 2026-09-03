from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_roles
from app.api.routes.matching import compute_match
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import Application, ApplicationStageHistory, AuditEvent, Job, UserRole
from app.schemas.api import ApplicationCreate, ApplicationRead, ApplicationStatusUpdate, RecruiterApplicationRead
from app.services.application_workflow import validate_transition


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
        await db.flush()
        db.add(
            ApplicationStageHistory(
                application_id=application.id,
                from_status=None,
                to_status=application.status.value,
                actor_id=identity["sub"],
                reason="Candidate submitted the application.",
            )
        )
        db.add(
            AuditEvent(
                actor_id=identity["sub"],
                action="application_created",
                resource_type="application",
                resource_id=application.id,
                details={"job_id": job.id, "model_version": match.model_version},
            )
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already applied") from exc
    await db.refresh(application)
    await manager.send(
        job.recruiter_id,
        {"type": "application.created", "application_id": application.id, "job_id": job.id},
    )
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


@router.get("/recruiter/jobs/{job_id}", response_model=list[RecruiterApplicationRead])
async def recruiter_applications(
    job_id: str,
    identity: dict = Depends(require_roles(UserRole.recruiter, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[RecruiterApplicationRead]:
    job = await db.get(Job, job_id)
    if not job or (identity["role"] != UserRole.admin.value and job.recruiter_id != identity["sub"]):
        raise HTTPException(status_code=404, detail="Job not found")
    applications = list(
        await db.scalars(
            select(Application).where(Application.job_id == job_id).order_by(Application.updated_at.desc())
        )
    )
    return [
        RecruiterApplicationRead.model_validate(
            {
                **ApplicationRead.model_validate(application).model_dump(),
                "job_title": job.title,
                "candidate_label": f"Candidate {application.candidate_id[:8].upper()}",
            }
        )
        for application in applications
    ]


@router.patch("/{application_id}/status", response_model=ApplicationRead)
async def update_application_status(
    application_id: str,
    payload: ApplicationStatusUpdate,
    identity: dict = Depends(require_roles(UserRole.recruiter)),
    db: AsyncSession = Depends(get_db),
) -> Application:
    application = await db.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    job = await db.get(Job, application.job_id)
    if not job or job.recruiter_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Application not found")
    try:
        validate_transition(application.status, payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    previous = application.status
    application.status = payload.status
    application.human_decision_reason = payload.reason
    db.add(
        ApplicationStageHistory(
            application_id=application.id,
            from_status=previous.value,
            to_status=payload.status.value,
            actor_id=identity["sub"],
            reason=payload.reason,
        )
    )
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="application_status_changed",
            resource_type="application",
            resource_id=application.id,
            details={
                "from_status": previous.value,
                "to_status": payload.status.value,
                "human_reason_recorded": True,
            },
        )
    )
    await db.commit()
    await db.refresh(application)
    await manager.send(
        application.candidate_id,
        {
            "type": "application.status_changed",
            "application_id": application.id,
            "status": application.status.value,
            "reason": payload.reason,
        },
    )
    return application
