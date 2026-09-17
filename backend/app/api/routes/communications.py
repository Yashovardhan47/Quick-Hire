from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_identity, require_verified_roles
from app.api.routes.realtime import manager
from app.db.session import get_db
from app.models.entities import Application, AuditEvent, Conversation, Job, Message, User, UserRole
from app.schemas.api import ConversationRead, MessageCreate, MessageRead
from app.services.notifications import queue_notification


router = APIRouter(prefix="/communications", tags=["candidate and recruiter communication"])


async def _application_access(application_id: str, identity: dict, db: AsyncSession):
    application = await db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    job = await db.get(Job, application.job_id)
    candidate = await db.get(User, application.candidate_id)
    recruiter = await db.get(User, job.recruiter_id) if job else None
    role = identity.get("role")
    allowed = (
        (role == UserRole.candidate.value and application.candidate_id == identity["sub"])
        or (role == UserRole.recruiter.value and job is not None and job.recruiter_id == identity["sub"])
        or role == UserRole.admin.value
    )
    if not allowed or job is None or candidate is None or recruiter is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application, job, candidate, recruiter


def _message_read(message: Message, sender: User) -> MessageRead:
    return MessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=sender.full_name,
        sender_role=sender.role,
        body=message.body,
        created_at=message.created_at,
        read_at=message.read_at,
    )


@router.get("/conversations", response_model=list[ConversationRead])
async def conversations(
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationRead]:
    role = identity.get("role")
    query = select(Conversation, Application, Job).join(
        Application, Application.id == Conversation.application_id
    ).join(Job, Job.id == Application.job_id)
    if role == UserRole.candidate.value:
        query = query.where(Application.candidate_id == identity["sub"])
    elif role == UserRole.recruiter.value:
        query = query.where(Job.recruiter_id == identity["sub"])
    elif role != UserRole.admin.value:
        raise HTTPException(status_code=403, detail="Insufficient role")
    rows = (await db.execute(query.order_by(Conversation.updated_at.desc()))).all()
    result: list[ConversationRead] = []
    for conversation, application, job in rows:
        candidate = await db.get(User, application.candidate_id)
        recruiter = await db.get(User, job.recruiter_id)
        counterpart = recruiter if role == UserRole.candidate.value else candidate
        last_message = await db.scalar(
            select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.desc()).limit(1)
        )
        unread = int(
            (
                await db.scalar(
                    select(func.count()).select_from(Message).where(
                        Message.conversation_id == conversation.id,
                        Message.sender_id != identity["sub"],
                        Message.read_at.is_(None),
                    )
                )
            )
            or 0
        )
        result.append(
            ConversationRead(
                id=conversation.id,
                application_id=application.id,
                job_id=job.id,
                job_title=job.title,
                counterpart_name=counterpart.full_name if counterpart else "QuickHire user",
                last_message=last_message.body if last_message else None,
                last_message_at=last_message.created_at if last_message else None,
                unread_count=unread,
            )
        )
    return result


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
async def messages(
    conversation_id: str,
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> list[MessageRead]:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await _application_access(conversation.application_id, identity, db)
    rows = list(
        await db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
            .limit(200)
        )
    )
    senders = {sender.id: sender for sender in (await db.scalars(select(User).where(User.id.in_({m.sender_id for m in rows})))).all()} if rows else {}
    return [_message_read(message, senders[message.sender_id]) for message in rows]


@router.post("/applications/{application_id}/messages", response_model=MessageRead, status_code=201)
async def send_message(
    application_id: str,
    payload: MessageCreate,
    identity: dict = Depends(require_verified_roles(UserRole.candidate, UserRole.recruiter)),
    db: AsyncSession = Depends(get_db),
) -> MessageRead:
    application, job, candidate, recruiter = await _application_access(application_id, identity, db)
    conversation = await db.scalar(select(Conversation).where(Conversation.application_id == application.id))
    if conversation is None:
        conversation = Conversation(application_id=application.id)
        db.add(conversation)
        await db.flush()
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    sender = candidate if identity["sub"] == candidate.id else recruiter
    recipient = recruiter if sender.id == candidate.id else candidate
    message = Message(conversation_id=conversation.id, sender_id=sender.id, body=body)
    conversation.updated_at = datetime.now(UTC)
    db.add(message)
    await db.flush()
    await queue_notification(
        db,
        user_id=recipient.id,
        event_type="message.received",
        title=f"New message about {job.title}",
        body=f"{sender.full_name}: {body[:240]}",
        data={"conversation_id": conversation.id, "application_id": application.id, "job_id": job.id},
    )
    db.add(AuditEvent(actor_id=sender.id, action="message_sent", resource_type="conversation", resource_id=conversation.id, details={"application_id": application.id}))
    await db.commit()
    await db.refresh(message)
    await manager.send(recipient.id, {"type": "message.received", "conversation_id": conversation.id})
    return _message_read(message, sender)


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    conversation_id: str,
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> None:
    conversation = await db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await _application_access(conversation.application_id, identity, db)
    rows = list(
        await db.scalars(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.sender_id != identity["sub"],
                Message.read_at.is_(None),
            )
        )
    )
    now = datetime.now(UTC)
    for message in rows:
        message.read_at = now
    await db.commit()
