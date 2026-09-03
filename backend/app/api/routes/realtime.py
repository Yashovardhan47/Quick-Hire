from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token


router = APIRouter(tags=["real-time events"])


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = {}

    def connect(self, user_id: str, socket: WebSocket) -> None:
        self.connections.setdefault(user_id, set()).add(socket)

    def disconnect(self, user_id: str, socket: WebSocket) -> None:
        self.connections.get(user_id, set()).discard(socket)
        if not self.connections.get(user_id):
            self.connections.pop(user_id, None)

    async def send(self, user_id: str, event: dict) -> None:
        stale = []
        for socket in list(self.connections.get(user_id, set())):
            try:
                await socket.send_json(event)
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(user_id, socket)


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
