import asyncio
import contextlib
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.security import decode_access_token


router = APIRouter(tags=["real-time events"])
logger = logging.getLogger("quickhire.realtime")
EVENT_CHANNEL = "quickhire:realtime:events"


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = {}
        self.redis: Redis | None = None
        self.pubsub = None
        self.listener_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Fan out events through Redis when multiple production workers are active."""
        if get_settings().app_env != "production" or self.listener_task is not None:
            return
        self.redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
        await self.redis.ping()
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe(EVENT_CHANNEL)
        self.listener_task = asyncio.create_task(self._listen(), name="quickhire-realtime-listener")

    async def stop(self) -> None:
        if self.listener_task:
            self.listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.listener_task
            self.listener_task = None
        if self.pubsub:
            await self.pubsub.aclose()
            self.pubsub = None
        if self.redis:
            await self.redis.aclose()
            self.redis = None

    async def _listen(self) -> None:
        assert self.pubsub is not None
        async for message in self.pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                payload = json.loads(message["data"])
                await self._send_local(str(payload["user_id"]), dict(payload["event"]))
            except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                logger.warning("Discarded malformed real-time event")

    def connect(self, user_id: str, socket: WebSocket) -> None:
        self.connections.setdefault(user_id, set()).add(socket)

    def disconnect(self, user_id: str, socket: WebSocket) -> None:
        self.connections.get(user_id, set()).discard(socket)
        if not self.connections.get(user_id):
            self.connections.pop(user_id, None)

    async def _send_local(self, user_id: str, event: dict) -> None:
        stale = []
        for socket in list(self.connections.get(user_id, set())):
            try:
                await socket.send_json(event)
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(user_id, socket)

    async def send(self, user_id: str, event: dict) -> None:
        if self.redis is not None:
            try:
                await self.redis.publish(EVENT_CHANNEL, json.dumps({"user_id": user_id, "event": event}))
                return
            except Exception:
                logger.exception("Redis event publication failed; using local delivery")
        await self._send_local(user_id, event)


manager = ConnectionManager()


@router.websocket("/ws/events")
async def events(socket: WebSocket) -> None:
    await socket.accept()
    try:
        authentication = await socket.receive_json()
        identity = decode_access_token(str(authentication.get("token", "")))
    except Exception:
        await socket.close(code=4401, reason="Authentication required")
        return
    user_id = identity["sub"]
    manager.connect(user_id, socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, socket)
