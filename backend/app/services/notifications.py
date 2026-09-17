from __future__ import annotations

import html
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.entities import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
    User,
    utcnow,
)


async def get_or_create_preferences(db: AsyncSession, user_id: str) -> NotificationPreference:
    preferences = await db.get(NotificationPreference, user_id)
    if preferences is None:
        preferences = NotificationPreference(user_id=user_id)
        db.add(preferences)
        await db.flush()
    return preferences


async def queue_notification(
    db: AsyncSession,
    *,
    user_id: str,
    event_type: str,
    title: str,
    body: str,
    data: dict | None = None,
    force_email: bool = False,
) -> Notification:
    """Persist the canonical notification and optionally add one email outbox row.

    The caller owns the transaction so the notification is committed atomically with
    the business event that caused it.
    """
    settings = get_settings()
    preferences = await get_or_create_preferences(db, user_id)
    notification = Notification(
        user_id=user_id,
        event_type=event_type[:120],
        title=title[:200],
        body=body,
        data=data or {},
    )
    db.add(notification)
    await db.flush()
    email_requested = force_email or preferences.email_transactional_enabled
    if settings.email_delivery_enabled and email_requested:
        db.add(NotificationDelivery(notification_id=notification.id, channel="email"))
    return notification


async def _send_resend_email(
    *,
    delivery_id: str,
    recipient: str,
    subject: str,
    body: str,
    action_url: str | None,
) -> None:
    settings = get_settings()
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")
    action = ""
    if action_url and action_url.startswith(settings.public_frontend_url.rstrip("/") + "/"):
        safe_url = html.escape(action_url, quote=True)
        action = f'<p><a href="{safe_url}">Open QuickHire</a></p>'
    safe_body = html.escape(body).replace("\n", "<br>")
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Idempotency-Key": delivery_id,
            },
            json={
                "from": settings.email_from,
                "to": [recipient],
                "subject": subject,
                "html": f"<p>{safe_body}</p>{action}",
            },
        )
        response.raise_for_status()


async def deliver_pending_batch(db: AsyncSession, limit: int = 25) -> int:
    settings = get_settings()
    if not settings.email_delivery_enabled or settings.email_provider == "disabled":
        return 0
    rows = list(
        (
            await db.execute(
                select(NotificationDelivery, Notification, User)
                .join(Notification, Notification.id == NotificationDelivery.notification_id)
                .join(User, User.id == Notification.user_id)
                .where(
                    NotificationDelivery.status == "pending",
                    NotificationDelivery.next_attempt_at <= datetime.now(UTC),
                )
                .order_by(NotificationDelivery.created_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        ).all()
    )
    delivered = 0
    for delivery, notification, user in rows:
        try:
            if settings.email_provider == "resend":
                await _send_resend_email(
                    delivery_id=delivery.id,
                    recipient=user.email,
                    subject=notification.title,
                    body=notification.body,
                    action_url=str(notification.data.get("action_url", "")) or None,
                )
            else:
                raise RuntimeError(f"Unsupported email provider: {settings.email_provider}")
            delivery.status = "sent"
            delivery.sent_at = utcnow()
            delivery.last_error = None
            if "action_url" in (notification.data or {}):
                sanitized = dict(notification.data)
                sanitized.pop("action_url", None)
                sanitized["secure_action_delivered"] = True
                notification.data = sanitized
            delivered += 1
        except Exception as exc:  # The outbox records sanitized provider errors for retry visibility.
            delivery.attempts += 1
            delivery.last_error = str(exc)[:1_000]
            if delivery.attempts >= settings.notification_max_attempts:
                delivery.status = "failed"
            else:
                delay_minutes = min(60, 2 ** delivery.attempts)
                delivery.next_attempt_at = datetime.now(UTC) + timedelta(minutes=delay_minutes)
    await db.commit()
    return delivered
