from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import User, UserRole


bearer = HTTPBearer(auto_error=False)


async def get_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return decode_access_token(credentials.credentials)


def require_roles(*roles: UserRole) -> Callable:
    async def checker(identity: dict = Depends(get_identity)) -> dict:
        if identity.get("role") not in {role.value for role in roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return identity

    return checker


def require_verified_roles(*roles: UserRole) -> Callable:
    async def checker(identity: dict = Depends(get_identity), db: AsyncSession = Depends(get_db)) -> dict:
        if identity.get("role") not in {role.value for role in roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        if get_settings().require_email_verification:
            user = await db.get(User, identity["sub"])
            if user is None or not user.email_verified:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Verify your email before using this workflow",
                )
        return identity

    return checker


DbSession = Depends(get_db)
