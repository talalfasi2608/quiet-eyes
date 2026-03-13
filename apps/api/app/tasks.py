import logging
import uuid

from app.celery_app import celery
from app.ingestion.engine import ingest_all_businesses, ingest_for_business_sync

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.ingest_business_task")
def ingest_business_task(business_id: str) -> dict:
    """Ingest mentions for a single business. Called manually or by beat."""
    logger.info("Starting ingestion for business %s", business_id)
    result = ingest_for_business_sync(uuid.UUID(business_id))
    logger.info("Ingestion result: %s", result)
    return result


@celery.task(name="app.tasks.ingest_all_task")
def ingest_all_task() -> list[dict]:
    """Ingest mentions for all businesses. Scheduled hourly by beat."""
    import asyncio

    logger.info("Starting ingestion for all businesses")
    results = asyncio.run(ingest_all_businesses())
    logger.info("All-business ingestion done: %d businesses processed", len(results))
    return results
