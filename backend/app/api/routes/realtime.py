from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token


router = APIRouter(tags=["real-time events"])


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, socket: WebSocket) -> None:
        await socket.accept()
        self.connections.setdefault(user_id, set()).add(socket)

    def disconnect(self, user_id: str, socket: WebSocket) -> None:
        self.connections.get(user_id, set()).discard(socket)

    async def send(self, user_id: str, event: dict) -> None:
        for socket in list(self.connections.get(user_id, set())):
            await socket.send_json(event)


manager = ConnectionManager()


@router.websocket("/ws/events")
async def events(socket: WebSocket, token: str) -> None:
    identity = decode_access_token(token)
    user_id = identity["sub"]
    await manager.connect(user_id, socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, socket)

