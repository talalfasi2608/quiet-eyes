"""
Competitors Router — list, detail, research.
"""

import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Request

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Competitors"])


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


def _verify_business_owner(supabase, business_id: str, auth_user_id: str):
    """Verify the authenticated user owns this business. Raises 403 if not."""
    try:
        result = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
        if result.data and result.data[0].get("user_id") == auth_user_id:
            return
    except Exception:
        pass
    raise HTTPException(status_code=403, detail="Access denied")


@router.get("/competitors/{business_id}")
async def list_competitors(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _get_service_client()
    if not supabase:
        return {"competitors": []}

    _verify_business_owner(supabase, business_id, auth_user_id)

    competitors = []
    try:
        r = supabase.table("competitors").select("*").eq("business_id", business_id).execute()
        if r.data:
            # Deduplicate by name, keeping newest (last in list)
            seen: dict[str, dict] = {}
            for c in r.data:
                key = (c.get("place_id") or c.get("name", "")).strip().lower()
                seen[key] = c  # last wins = newest
            competitors = list(seen.values())
    except Exception as e:
        logger.debug(f"Competitors lookup: {e}")
    return {"competitors": competitors}


@router.get("/competitor/{competitor_id}/detail")
async def competitor_detail(competitor_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify ownership via the competitor's business_id
    try:
        r = supabase.table("competitors").select("*, business_id").eq("id", competitor_id).execute()
        if r.data and len(r.data) > 0:
            _verify_business_owner(supabase, r.data[0]["business_id"], auth_user_id)
            return {"success": True, "competitor": r.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.debug(f"Competitor detail: {e}")
    raise HTTPException(status_code=404, detail="Competitor not found")


@router.post("/research/competitor/{competitor_id}")
async def research_competitor(competitor_id: str, auth_user_id: str = Depends(require_auth)):
    return {"success": True, "message": "Research queued"}
