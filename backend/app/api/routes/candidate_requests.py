from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_identity, require_roles
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import AuditEvent, CandidateRequest, UserRole
from app.schemas.api import CandidateRequestCreate, CandidateRequestRead, CandidateRequestResolve
from app.services.notifications import queue_notification


router = APIRouter(prefix="/candidate-requests", tags=["candidate recourse and privacy"])


@router.post("", response_model=CandidateRequestRead, status_code=201)
async def create_request(
    payload: CandidateRequestCreate,
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> CandidateRequest:
    row = CandidateRequest(
        candidate_id=identity["sub"],
        request_type=payload.request_type,
        details=payload.details.strip(),
    )
    db.add(row)
    await db.flush()
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="candidate_request_created",
            resource_type="candidate_request",
            resource_id=row.id,
            details={"request_type": row.request_type, "excluded_from_ai": True},
        )
    )
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/me", response_model=list[CandidateRequestRead])
async def my_requests(
    identity: dict = Depends(require_roles(UserRole.candidate)),
    db: AsyncSession = Depends(get_db),
) -> list[CandidateRequest]:
    return list(
        await db.scalars(
            select(CandidateRequest)
            .where(CandidateRequest.candidate_id == identity["sub"])
            .order_by(CandidateRequest.created_at.desc())
        )
    )


@router.get("", response_model=list[CandidateRequestRead])
async def all_requests(
    status_filter: str | None = None,
    _: dict = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[CandidateRequest]:
    query = select(CandidateRequest)
    if status_filter:
        query = query.where(CandidateRequest.status == status_filter)
    return list(await db.scalars(query.order_by(CandidateRequest.created_at.asc()).limit(250)))


@router.patch("/{request_id}", response_model=CandidateRequestRead)
async def resolve_request(
    request_id: str,
    payload: CandidateRequestResolve,
    identity: dict = Depends(require_roles(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> CandidateRequest:
    row = await db.get(CandidateRequest, request_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Candidate request not found")
    if payload.status in {"resolved", "denied"} and len(payload.resolution.strip()) < 10:
        raise HTTPException(status_code=422, detail="A meaningful resolution is required")
    row.status = payload.status
    row.resolution = payload.resolution.strip()
    if payload.status in {"resolved", "denied"}:
        row.resolved_by = identity["sub"]
        row.resolved_at = datetime.now(UTC)
    else:
        row.resolved_by = None
        row.resolved_at = None
    await queue_notification(
        db,
        user_id=row.candidate_id,
        event_type="candidate_request.updated",
        title=f"{row.request_type.replace('_', ' ').title()} request updated",
        body=f"Your request is now {row.status.replace('_', ' ')}.",
        data={"request_id": row.id, "status": row.status},
    )
    db.add(
        AuditEvent(
            actor_id=identity["sub"],
            action="candidate_request_updated",
            resource_type="candidate_request",
            resource_id=row.id,
            details={"status": row.status, "request_type": row.request_type},
        )
    )
    await db.commit()
    await db.refresh(row)
    await manager.send(row.candidate_id, {"type": "candidate_request.updated", "request_id": row.id, "status": row.status})
    return row
