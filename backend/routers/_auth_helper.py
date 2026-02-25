"""
Shared auth helper — per-request Supabase clients and JWT verification.

SECURITY RULES:
1. Never mutate the global Supabase singleton
2. Every authenticated request gets a fresh client with the user's JWT
3. All JWTs are verified server-side via Supabase GoTRUE (not base64 decoded)
"""

import logging
import os
import time
from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

# In-memory token verification cache: token -> (user_id, expires_at)
_token_cache: dict[str, tuple[str, float]] = {}
_CACHE_TTL = 300  # 5 minutes


def extract_token(request: Request) -> str | None:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("authorization", "")
    return auth.replace("Bearer ", "") if auth.startswith("Bearer ") else None


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _get_global_supabase():
    """Get the global (unauthenticated) Supabase client for server-side operations."""
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def get_supabase_client(request: Request = None, token: str = None):
    """
    Return a Supabase client scoped to the user's JWT for RLS.
    Creates a NEW client per request — never mutates the global singleton.
    Falls back to global client if no token is provided.
    """
    tkn = token
    if not tkn and request:
        tkn = extract_token(request)

    if tkn:
        try:
            from config import get_settings
            from supabase import create_client, ClientOptions
            settings = get_settings()
            if settings.supabase_url and settings.supabase_key:
                return create_client(
                    settings.supabase_url,
                    settings.supabase_key,
                    options=ClientOptions(
                        headers={"Authorization": f"Bearer {tkn}"}
                    ),
                )
        except Exception as e:
            logger.debug(f"Per-request client creation failed: {e}")

    return _get_global_supabase()


def verify_token(token: str) -> str | None:
    """
    Verify JWT signature with Supabase GoTRUE and return user_id.
    Uses in-memory cache to avoid rate-limiting on concurrent requests.
    Returns None if token is invalid, expired, or verification fails.
    """
    now = time.time()

    # Check cache first
    cached = _token_cache.get(token)
    if cached:
        user_id, expires_at = cached
        if now < expires_at:
            return user_id
        else:
            del _token_cache[token]

    sb = _get_global_supabase()
    if not sb:
        return None
    try:
        response = sb.auth.get_user(token)
        if response and response.user:
            user_id = response.user.id
            _token_cache[token] = (user_id, now + _CACHE_TTL)
            # Evict stale entries periodically (keep cache small)
            if len(_token_cache) > 100:
                stale = [k for k, (_, exp) in _token_cache.items() if now >= exp]
                for k in stale:
                    del _token_cache[k]
            return user_id
    except Exception as e:
        logger.debug(f"JWT verification failed: {e}")
    return None


def resolve_business_id(sb, path_id: str, auth_user_id: str) -> str | None:
    """
    Resolve a path parameter that could be either a user_id or a business_id.
    Verifies the authenticated user owns the business.
    Returns the business_id, or None if ownership cannot be verified.
    Falls back to service-role client when JWT-scoped client is blocked by RLS.
    """
    # Case 1: path_id IS the auth user_id → look up their business
    if path_id == auth_user_id:
        try:
            result = sb.table("businesses").select("id").eq("user_id", auth_user_id).limit(1).execute()
            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            logger.debug(f"resolve_business_id user lookup: {e}")
        # Fallback: service-role client
        svc = _get_service_client()
        if svc:
            try:
                result = svc.table("businesses").select("id").eq("user_id", auth_user_id).limit(1).execute()
                if result.data:
                    return result.data[0]["id"]
            except Exception:
                pass
        return None

    # Case 2: path_id is a business_id → verify ownership
    try:
        result = (
            sb.table("businesses")
            .select("id, user_id")
            .eq("id", path_id)
            .limit(1)
            .execute()
        )
        if result.data and result.data[0].get("user_id") == auth_user_id:
            return result.data[0]["id"]
    except Exception as e:
        logger.debug(f"resolve_business_id biz lookup: {e}")
    # Fallback: service-role client
    svc = _get_service_client()
    if svc:
        try:
            result = svc.table("businesses").select("id, user_id").eq("id", path_id).limit(1).execute()
            if result.data and result.data[0].get("user_id") == auth_user_id:
                return result.data[0]["id"]
        except Exception:
            pass

    return None


def require_auth(request: Request) -> str:
    """
    FastAPI dependency: extract JWT from Authorization header,
    verify signature with Supabase GoTRUE, return authenticated user_id.
    Raises 401 if token is missing, invalid, or expired.
    """
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization")

    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user_id
