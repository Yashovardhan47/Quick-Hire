from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_identity, require_roles, require_verified_roles
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import Application, AuditEvent, InterviewSchedule, Job, User, UserRole
from app.schemas.api import InterviewScheduleCreate, InterviewScheduleRead, InterviewScheduleUpdate
from app.services.notifications import queue_notification


router = APIRouter(prefix="/interview-schedules", tags=["interview scheduling"])


async def _context(application_id: str, db: AsyncSession):
    application = await db.get(Application, application_id)
    job = await db.get(Job, application.job_id) if application else None
    candidate = await db.get(User, application.candidate_id) if application else None
    recruiter = await db.get(User, job.recruiter_id) if job else None
    if application is None or job is None or candidate is None or recruiter is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application, job, candidate, recruiter


def _read(schedule: InterviewSchedule, job: Job, candidate: User, recruiter: User) -> InterviewScheduleRead:
    return InterviewScheduleRead(
        id=schedule.id,
        application_id=schedule.application_id,
        job_id=job.id,
        job_title=job.title,
        candidate_id=candidate.id,
        candidate_name=candidate.full_name,
        recruiter_id=recruiter.id,
        starts_at=schedule.starts_at,
        duration_minutes=schedule.duration_minutes,
        timezone=schedule.timezone,
        meeting_url=schedule.meeting_url,
        status=schedule.status,
        candidate_note=schedule.candidate_note,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


@router.get("", response_model=list[InterviewScheduleRead])
async def list_schedules(
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> list[InterviewScheduleRead]:
    query = select(InterviewSchedule, Application, Job).join(
        Application, Application.id == InterviewSchedule.application_id
    ).join(Job, Job.id == Application.job_id)
    if identity["role"] == UserRole.candidate.value:
        query = query.where(Application.candidate_id == identity["sub"])
    elif identity["role"] == UserRole.recruiter.value:
        query = query.where(Job.recruiter_id == identity["sub"])
    elif identity["role"] != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Insufficient role")
    rows = (await db.execute(query.order_by(InterviewSchedule.starts_at.asc()))).all()
    result = []
    for schedule, application, job in rows:
        candidate = await db.get(User, application.candidate_id)
        recruiter = await db.get(User, job.recruiter_id)
        if candidate and recruiter:
            result.append(_read(schedule, job, candidate, recruiter))
    return result


@router.post("", response_model=InterviewScheduleRead, status_code=201)
async def create_schedule(
    payload: InterviewScheduleCreate,
    identity: dict = Depends(require_verified_roles(UserRole.recruiter)),
    db: AsyncSession = Depends(get_db),
) -> InterviewScheduleRead:
    application, job, candidate, recruiter = await _context(payload.application_id, db)
    if job.recruiter_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.status.value in {"rejected", "withdrawn", "hired"}:
        raise HTTPException(status_code=409, detail="Interviews cannot be scheduled for a closed application")
    starts_at = payload.starts_at if payload.starts_at.tzinfo else payload.starts_at.replace(tzinfo=UTC)
    if starts_at < datetime.now(UTC) + timedelta(minutes=10):
        raise HTTPException(status_code=422, detail="Interview must start at least 10 minutes in the future")
    if payload.meeting_url and not payload.meeting_url.startswith("https://"):
        raise HTTPException(status_code=422, detail="Meeting URL must use HTTPS")
    try:
        ZoneInfo(payload.timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=422, detail="Timezone must be a valid IANA timezone") from exc
    schedule = InterviewSchedule(
        application_id=application.id,
        organizer_id=identity["sub"],
        starts_at=starts_at,
        duration_minutes=payload.duration_minutes,
        timezone=payload.timezone,
        meeting_url=payload.meeting_url,
    )
    db.add(schedule)
    await db.flush()
    await queue_notification(
        db,
        user_id=candidate.id,
        event_type="interview.proposed",
        title=f"Interview proposed for {job.title}",
        body=f"{job.company} proposed an interview at {starts_at.isoformat()} ({payload.timezone}).",
        data={"schedule_id": schedule.id, "application_id": application.id, "job_id": job.id},
    )
    db.add(AuditEvent(actor_id=identity["sub"], action="interview_schedule_created", resource_type="interview_schedule", resource_id=schedule.id, details={"application_id": application.id}))
    await db.commit()
    await db.refresh(schedule)
    await manager.send(candidate.id, {"type": "interview.proposed", "schedule_id": schedule.id})
    return _read(schedule, job, candidate, recruiter)


@router.patch("/{schedule_id}", response_model=InterviewScheduleRead)
async def update_schedule(
    schedule_id: str,
    payload: InterviewScheduleUpdate,
    identity: dict = Depends(require_verified_roles(UserRole.candidate, UserRole.recruiter)),
    db: AsyncSession = Depends(get_db),
) -> InterviewScheduleRead:
    schedule = await db.get(InterviewSchedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Interview schedule not found")
    application, job, candidate, recruiter = await _context(schedule.application_id, db)
    is_candidate = identity["role"] == UserRole.candidate.value and identity["sub"] == candidate.id
    is_recruiter = identity["role"] == UserRole.recruiter.value and identity["sub"] == recruiter.id
    if payload.action in {"confirm", "decline"} and not is_candidate:
        raise HTTPException(status_code=403, detail="Only the candidate can confirm or decline this proposal")
    if payload.action == "cancel" and not is_recruiter:
        raise HTTPException(status_code=403, detail="Only the recruiter can cancel this interview")
    if payload.action in {"confirm", "decline"} and schedule.status != "proposed":
        raise HTTPException(status_code=409, detail="Only a proposed interview can be confirmed or declined")
    if payload.action == "cancel" and schedule.status not in {"proposed", "confirmed"}:
        raise HTTPException(status_code=409, detail="This interview schedule is already closed")
    schedule.status = {"confirm": "confirmed", "decline": "declined", "cancel": "cancelled"}[payload.action]
    schedule.candidate_note = payload.candidate_note.strip()
    recipient = recruiter if is_candidate else candidate
    await queue_notification(
        db,
        user_id=recipient.id,
        event_type=f"interview.{schedule.status}",
        title=f"Interview {schedule.status}: {job.title}",
        body=f"The interview scheduled for {schedule.starts_at.isoformat()} is now {schedule.status}.",
        data={"schedule_id": schedule.id, "application_id": application.id, "job_id": job.id},
    )
    db.add(AuditEvent(actor_id=identity["sub"], action=f"interview_schedule_{schedule.status}", resource_type="interview_schedule", resource_id=schedule.id, details={"application_id": application.id}))
    await db.commit()
    await db.refresh(schedule)
    await manager.send(recipient.id, {"type": f"interview.{schedule.status}", "schedule_id": schedule.id})
    return _read(schedule, job, candidate, recruiter)
