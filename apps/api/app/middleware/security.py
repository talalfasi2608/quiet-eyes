"""Security middleware: rate limiting, request size limits, security headers."""

import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


def _parse_rate(rate_str: str) -> tuple[int, int]:
    """Parse rate string like '10/minute' into (count, window_seconds)."""
    count_str, period = rate_str.split("/")
    count = int(count_str)
    windows = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}
    return count, windows.get(period, 60)


# Simple in-memory rate limiter (suitable for single-process deployments)
_rate_store: dict[str, list[float]] = defaultdict(list)


def _is_rate_limited(key: str, max_requests: int, window_seconds: int) -> bool:
    """Check if a key has exceeded its rate limit."""
    now = time.time()
    cutoff = now - window_seconds

    # Prune old entries
    _rate_store[key] = [t for t in _rate_store[key] if t > cutoff]
    if len(_rate_store[key]) >= max_requests:
        return True
    _rate_store[key].append(now)
    return False


# Auth endpoints that get stricter rate limits
AUTH_PATHS = {"/auth/register", "/auth/login", "/auth/refresh"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Determine rate limit based on path
        if path in AUTH_PATHS:
            max_req, window = _parse_rate(settings.RATE_LIMIT_AUTH)
            key = f"auth:{client_ip}:{path}"
        else:
            max_req, window = _parse_rate(settings.RATE_LIMIT_DEFAULT)
            key = f"api:{client_ip}"

        if _is_rate_limited(key, max_req, window):
            return Response(
                content='{"detail":"Rate limit exceeded. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(window)},
            )

        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response


MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024  # 10 MB


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_SIZE:
            return Response(
                content='{"detail":"Request body too large"}',
                status_code=413,
                media_type="application/json",
            )
        return await call_next(request)
