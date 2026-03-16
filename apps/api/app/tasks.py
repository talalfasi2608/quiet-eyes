import logging
import traceback
import uuid

from app.celery_app import celery
from app.ingestion.engine import ingest_all_businesses, ingest_for_business_sync

logger = logging.getLogger(__name__)


def _record_failed_job(
    job_type: str,
    job_id: str | None,
    business_id: str | None,
    payload: dict | None,
    error: Exception,
) -> None:
    """Record a failed job in the failed_jobs table (dead-letter)."""
    from app.database import SessionLocal
    from app.models import FailedJob

    db = SessionLocal()
    try:
        fj = FailedJob(
            job_type=job_type,
            job_id=job_id,
            business_id=uuid.UUID(business_id) if business_id else None,
            payload=payload,
            error_message=str(error),
            error_traceback=traceback.format_exc(),
        )
        db.add(fj)
        db.commit()
    except Exception:
        logger.exception("Failed to record dead-letter entry")
    finally:
        db.close()


@celery.task(name="app.tasks.ingest_business_task", bind=True, max_retries=3)
def ingest_business_task(self, business_id: str) -> dict:
    """Ingest mentions for a single business. Called manually or by beat."""
    logger.info("Starting ingestion for business %s", business_id)
    try:
        result = ingest_for_business_sync(uuid.UUID(business_id))
        logger.info("Ingestion result: %s", result)
        return result
    except Exception as exc:
        logger.exception("Ingestion failed for business %s", business_id)
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        _record_failed_job("ingest_business", self.request.id, business_id, {"business_id": business_id}, exc)
        raise


@celery.task(name="app.tasks.ingest_all_task", bind=True, max_retries=2)
def ingest_all_task(self) -> list[dict]:
    """Ingest mentions for all businesses. Scheduled hourly by beat."""
    import asyncio

    logger.info("Starting ingestion for all businesses")
    try:
        results = asyncio.run(ingest_all_businesses())
        logger.info("All-business ingestion done: %d businesses processed", len(results))
        return results
    except Exception as exc:
        logger.exception("All-business ingestion failed")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
        _record_failed_job("ingest_all", self.request.id, None, None, exc)
        raise


@celery.task(name="app.tasks.optimize_all_task", bind=True, max_retries=2)
def optimize_all_task(self) -> list[dict]:
    """Run optimization pipeline (attribution + learning + recommendations) for all businesses.
    Scheduled daily by beat."""
    from app.database import SessionLocal
    from app.intelligence.attribution_engine import build_attribution_records
    from app.intelligence.historical_learning import compute_learning_insights
    from app.intelligence.optimization_engine import run_optimization
    from app.models import Business

    logger.info("Starting daily optimization for all businesses")
    db = SessionLocal()
    results = []
    try:
        businesses = db.query(Business).all()
        for biz in businesses:
            try:
                attr_count = build_attribution_records(db, biz)
                learning_count = compute_learning_insights(db, biz)
                rec_count = run_optimization(db, biz)
                results.append({
                    "business_id": str(biz.id),
                    "attribution_records": attr_count,
                    "learning_insights": learning_count,
                    "recommendations": rec_count,
                })
                logger.info("Optimized business %s: %d attr, %d learning, %d recs",
                            biz.id, attr_count, learning_count, rec_count)
            except Exception as exc:
                logger.exception("Optimization failed for business %s", biz.id)
                _record_failed_job("optimize_business", self.request.id, str(biz.id), {"business_id": str(biz.id)}, exc)
                results.append({"business_id": str(biz.id), "error": "failed"})
    finally:
        db.close()
    logger.info("Daily optimization done: %d businesses processed", len(results))
    return results
