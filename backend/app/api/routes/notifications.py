from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_identity
from app.db.session import get_db
from app.models.entities import Notification, NotificationPreference
from app.schemas.api import NotificationPreferenceRead, NotificationPreferenceUpdate, NotificationRead
from app.services.notifications import get_or_create_preferences


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    unread_only: bool = False,
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationRead]:
    query = select(Notification).where(Notification.user_id == identity["sub"])
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    rows = list(await db.scalars(query.order_by(Notification.created_at.desc()).limit(100)))
    return [
        NotificationRead.model_validate(
            {
                "id": row.id,
                "event_type": row.event_type,
                "title": row.title,
                "body": row.body,
                "data": {key: value for key, value in (row.data or {}).items() if key != "action_url"},
                "read_at": row.read_at,
                "created_at": row.created_at,
            }
        )
        for row in rows
    ]


@router.get("/unread-count")
async def unread_count(identity: dict = Depends(get_identity), db: AsyncSession = Depends(get_db)) -> dict:
    count = await db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == identity["sub"], Notification.read_at.is_(None)
        )
    )
    return {"count": int(count or 0)}


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    notification_id: str,
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> None:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != identity["sub"]:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read_at = datetime.now(UTC)
    await db.commit()


@router.get("/preferences", response_model=NotificationPreferenceRead)
async def preferences(identity: dict = Depends(get_identity), db: AsyncSession = Depends(get_db)) -> NotificationPreference:
    row = await get_or_create_preferences(db, identity["sub"])
    await db.commit()
    return row


@router.put("/preferences", response_model=NotificationPreferenceRead)
async def update_preferences(
    payload: NotificationPreferenceUpdate,
    identity: dict = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreference:
    row = await get_or_create_preferences(db, identity["sub"])
    row.browser_enabled = payload.browser_enabled
    row.email_transactional_enabled = payload.email_transactional_enabled
    row.email_digest_enabled = payload.email_digest_enabled
    await db.commit()
    await db.refresh(row)
    return row
