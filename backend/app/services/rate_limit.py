from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from app.core.config import get_settings


_client: Redis | None = None


def _redis() -> Redis:
    global _client
    if _client is None:
        _client = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def enforce_auth_rate_limit(request: Request) -> None:
    settings = get_settings()
    host = request.client.host if request.client else "unknown"
    route = request.url.path.rsplit("/", 1)[-1]
    key = f"quickhire:rate:auth:{host}:{route}"
    try:
        client = _redis()
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, 60)
    except Exception as exc:
        if settings.app_env == "production":
            raise HTTPException(status_code=503, detail="Authentication protection is temporarily unavailable") from exc
        return
    if current > settings.auth_rate_limit_per_minute:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Try again shortly.",
            headers={"Retry-After": "60"},
        )
