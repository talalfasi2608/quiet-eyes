import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.health import get_latency_stats, record_request_latency, run_startup_checks
from app.middleware.security import (
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.routers import admin, agency, audiences, auth, autopilot, billing, businesses, campaigns, chat, feed, governance, integrations, intelligence, leads, mentions, ops_monitor, optimizations, outbound, partners, playbook_library, playbooks, predictions

# Production-safe logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("quieteyes")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hooks."""
    # Startup
    logger.info("QuietEyes API starting up...")
    startup_result = run_startup_checks()
    app.state.startup_health = startup_result
    logger.info("QuietEyes API ready.")
    yield
    # Shutdown
    logger.info("QuietEyes API shutting down gracefully...")


app = FastAPI(title="QuietEyes API", version="1.0.0", lifespan=lifespan)

from app.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)


@app.middleware("http")
async def latency_tracking_middleware(request: Request, call_next):
    """Track API request latency for monitoring."""
    start = time.time()
    response = await call_next(request)
    latency_ms = (time.time() - start) * 1000
    record_request_latency(latency_ms)
    response.headers["X-Response-Time"] = f"{latency_ms:.1f}ms"
    return response


app.include_router(auth.router)
app.include_router(businesses.router)
app.include_router(agency.router)
app.include_router(feed.router)
app.include_router(leads.router)
app.include_router(audiences.router)
app.include_router(campaigns.router)
app.include_router(chat.router)
app.include_router(mentions.router)
app.include_router(integrations.router)
app.include_router(intelligence.router)
app.include_router(autopilot.router)
app.include_router(billing.router)
app.include_router(playbooks.router)
app.include_router(playbook_library.router)
app.include_router(optimizations.router)
app.include_router(admin.router)
app.include_router(governance.router)
app.include_router(outbound.router)
app.include_router(predictions.router)
app.include_router(partners.router)
app.include_router(ops_monitor.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "quieteyes-api"}


@app.get("/health/deep")
async def deep_health():
    """Deep health check — verifies DB and Redis connectivity."""
    from app.health import check_database, check_redis
    db_status = check_database()
    redis_status = check_redis()
    overall = "ok" if db_status["status"] == "ok" else "degraded"
    return {
        "status": overall,
        "service": "quieteyes-api",
        "latency": get_latency_stats(),
        "services": {
            "database": db_status,
            "redis": redis_status,
        },
    }
