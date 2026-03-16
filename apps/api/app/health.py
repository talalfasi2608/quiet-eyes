"""System health checks — startup validation, service connectivity, monitoring."""

import logging
import time
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger("quieteyes.health")


def check_database() -> dict:
    """Check database connectivity."""
    try:
        from sqlalchemy import text
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            return {"status": "ok", "service": "database"}
        finally:
            db.close()
    except Exception as e:
        return {"status": "error", "service": "database", "error": str(e)}


def check_redis() -> dict:
    """Check Redis connectivity."""
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_timeout=3)
        r.ping()
        return {"status": "ok", "service": "redis"}
    except ImportError:
        return {"status": "skip", "service": "redis", "error": "redis package not installed"}
    except Exception as e:
        return {"status": "error", "service": "redis", "error": str(e)}


def validate_env() -> list[dict]:
    """Validate critical environment variables on startup."""
    warnings = []

    if settings.JWT_SECRET == "change-me-in-production":
        warnings.append({
            "level": "critical",
            "variable": "JWT_SECRET",
            "message": "Using default JWT_SECRET. Set a strong secret in production.",
        })

    if not settings.DATABASE_URL or "localhost" in settings.DATABASE_URL:
        warnings.append({
            "level": "warning",
            "variable": "DATABASE_URL",
            "message": "Database URL appears to be a local/default value.",
        })

    if not settings.STRIPE_SECRET_KEY:
        warnings.append({
            "level": "info",
            "variable": "STRIPE_SECRET_KEY",
            "message": "Stripe key not set. Billing will run in stub mode.",
        })

    if not settings.TAVILY_API_KEY:
        warnings.append({
            "level": "info",
            "variable": "TAVILY_API_KEY",
            "message": "Tavily API key not set. Search ingestion will be limited.",
        })

    return warnings


def run_startup_checks() -> dict:
    """Run all startup health checks. Log warnings but don't block startup."""
    logger.info("Running startup health checks...")

    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "env_warnings": validate_env(),
        "services": {},
    }

    # Database check
    db_check = check_database()
    results["services"]["database"] = db_check
    if db_check["status"] == "error":
        logger.error("Database health check FAILED: %s", db_check.get("error"))
    else:
        logger.info("Database: OK")

    # Redis check
    redis_check = check_redis()
    results["services"]["redis"] = redis_check
    if redis_check["status"] == "error":
        logger.warning("Redis health check failed: %s", redis_check.get("error"))
    elif redis_check["status"] == "ok":
        logger.info("Redis: OK")

    # Log env warnings
    for w in results["env_warnings"]:
        level = w["level"]
        msg = f"[{w['variable']}] {w['message']}"
        if level == "critical":
            logger.warning("CRITICAL: %s", msg)
        elif level == "warning":
            logger.warning(msg)
        else:
            logger.info(msg)

    logger.info("Startup checks complete.")
    return results


# ── Runtime metrics (in-memory, for /admin/system/health endpoint) ──


_request_latencies: list[tuple[float, float]] = []  # (timestamp, latency_ms)
MAX_LATENCY_SAMPLES = 1000


def record_request_latency(latency_ms: float) -> None:
    """Record an API request latency sample."""
    _request_latencies.append((time.time(), latency_ms))
    if len(_request_latencies) > MAX_LATENCY_SAMPLES:
        _request_latencies.pop(0)


def get_latency_stats() -> dict:
    """Get API latency statistics."""
    if not _request_latencies:
        return {"p50": 0, "p95": 0, "p99": 0, "avg": 0, "count": 0}

    # Filter to last 5 minutes
    cutoff = time.time() - 300
    recent = [lat for ts, lat in _request_latencies if ts > cutoff]
    if not recent:
        return {"p50": 0, "p95": 0, "p99": 0, "avg": 0, "count": 0}

    recent.sort()
    n = len(recent)
    return {
        "p50": round(recent[n // 2], 2),
        "p95": round(recent[int(n * 0.95)], 2),
        "p99": round(recent[int(n * 0.99)], 2),
        "avg": round(sum(recent) / n, 2),
        "count": n,
    }
