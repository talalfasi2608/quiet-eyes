"""
Referral API Router — Referral code, link, stats.
"""

import os
import logging
import hashlib
from fastapi import APIRouter, HTTPException, Depends
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/referral", tags=["Referral"])


def _get_service_client():
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _generate_code(user_id: str) -> str:
    """Generate a deterministic referral code from user ID."""
    h = hashlib.md5(user_id.encode()).hexdigest()[:6].upper()
    return f"QE-{h}"


@router.get("")
async def get_referral(auth_user_id: str = Depends(require_auth)):
    """Get user's referral code, link, and stats."""
    sb = _get_service_client()
    code = _generate_code(auth_user_id)
    app_url = os.getenv("APP_URL", "https://app.quieteyes.co.il")
    link = f"{app_url}/signup?ref={code}"

    referred_count = 0
    converted_count = 0
    free_months_earned = 0

    if sb:
        try:
            result = sb.table("referrals").select("status").eq("referrer_user_id", auth_user_id).execute()
            refs = result.data or []
            referred_count = len(refs)
            converted_count = sum(1 for r in refs if r.get("status") in ("converted", "rewarded"))
            free_months_earned = sum(1 for r in refs if r.get("status") == "rewarded")
        except Exception as e:
            logger.error(f"Referral stats failed: {e}")

    return {
        "code": code,
        "link": link,
        "referred_count": referred_count,
        "converted_count": converted_count,
        "free_months_earned": free_months_earned,
    }
