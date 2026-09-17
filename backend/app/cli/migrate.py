import asyncio
import hashlib
import os
from pathlib import Path

import asyncpg

from app.core.config import get_settings


LOCK_ID = 7147305


def _database_dsn() -> str:
    return get_settings().database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _migrations_dir() -> Path:
    configured = os.getenv("MIGRATIONS_DIR")
    if configured:
        return Path(configured)
    container_path = Path("/database/migrations")
    if container_path.is_dir():
        return container_path
    return Path(__file__).resolve().parents[3] / "database" / "migrations"


async def migrate() -> None:
    directory = _migrations_dir()
    files = sorted(directory.glob("*.sql"))
    if not files:
        raise RuntimeError(f"No migrations found in {directory}")
    connection = await asyncpg.connect(_database_dsn())
    try:
        await connection.execute("SELECT pg_advisory_lock($1)", LOCK_ID)
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        applied = {row["version"]: row["checksum"] for row in await connection.fetch("SELECT version, checksum FROM schema_migrations")}
        for path in files:
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            if path.name in applied:
                if applied[path.name] != checksum:
                    raise RuntimeError(f"Applied migration changed: {path.name}")
                continue
            async with connection.transaction():
                await connection.execute(sql)
                await connection.execute(
                    "INSERT INTO schema_migrations(version, checksum) VALUES($1, $2)",
                    path.name,
                    checksum,
                )
            print(f"applied {path.name}")
    finally:
        try:
            await connection.execute("SELECT pg_advisory_unlock($1)", LOCK_ID)
        finally:
            await connection.close()


if __name__ == "__main__":
    asyncio.run(migrate())
