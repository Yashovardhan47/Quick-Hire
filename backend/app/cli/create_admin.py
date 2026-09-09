import asyncio
import os

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.entities import User, UserRole


async def create_admin() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    full_name = os.environ.get("ADMIN_NAME", "Platform Administrator").strip()
    if not email or "@" not in email:
        raise SystemExit("Set ADMIN_EMAIL to a valid email address.")
    if len(password) < 12:
        raise SystemExit("Set ADMIN_PASSWORD to at least 12 characters.")
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            raise SystemExit("A user with that email already exists; no account was changed.")
        db.add(
            User(
                email=email,
                full_name=full_name,
                password_hash=hash_password(password),
                role=UserRole.admin,
                email_verified=True,
            )
        )
        await db.commit()
    print("Admin account created.")


if __name__ == "__main__":
    asyncio.run(create_admin())
