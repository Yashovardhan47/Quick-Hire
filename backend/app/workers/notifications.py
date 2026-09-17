import asyncio
import logging

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal, engine
from app.services.notifications import deliver_pending_batch


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("quickhire.notification-worker")


async def run() -> None:
    settings = get_settings()
    logger.info("notification worker started")
    try:
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    delivered = await deliver_pending_batch(db)
                    if delivered:
                        logger.info("delivered %s notification emails", delivered)
            except Exception:
                logger.exception("notification delivery batch failed")
            await asyncio.sleep(settings.notification_poll_seconds)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
