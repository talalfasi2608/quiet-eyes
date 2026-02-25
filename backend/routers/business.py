"""
Business Profile Router.

Handles business profile CRUD operations.
- GET  /business/user/{user_id}          — fetch business by auth user
- PATCH /business/profile/{business_id}  — update profile fields
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/business", tags=["Business"])


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


@router.get("/user/{user_id}")
async def get_business_by_user(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Return the business profile linked to a Supabase Auth user."""
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    from routers._auth_helper import get_supabase_client
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        result = (
            supabase.table("businesses")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data or len(result.data) == 0:
                raise HTTPException(status_code=404, detail="No business found for this user")

        biz = result.data[0]
        return {
            "success": True,
            "business": {
                "id": biz.get("id"),
                "user_id": biz.get("user_id"),
                "name_hebrew": biz.get("business_name", ""),
                "industry": biz.get("industry", ""),
                "archetype": biz.get("archetype", "Merchant"),
                "target_audience": biz.get("target_audience", ""),
                "emoji": biz.get("emoji", "🏢"),
                "trending_topics": biz.get("trending_topics") or [],
                "core_metrics": biz.get("core_metrics") or [],
                "pulse_score": biz.get("pulse_score", 5.0),
                "created_at": biz.get("created_at"),
                "location": biz.get("location"),
                "address": biz.get("address") or biz.get("location"),
                "latitude": biz.get("latitude"),
                "longitude": biz.get("longitude"),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch business for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch business")


class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    archetype: Optional[str] = None
    scope: Optional[str] = None


@router.patch("/profile/{business_id}")
async def update_business_profile(business_id: str, payload: BusinessProfileUpdate, request: Request, auth_user_id: str = Depends(require_auth)):
    """Update a business profile. Called by Settings page on save."""
    from routers._auth_helper import get_supabase_client
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Build update dict from non-None fields
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        return {"success": True, "message": "No changes to save"}

    # Map frontend field names to DB column names if needed
    field_map = {
        "address": "location",  # frontend sends 'address', DB column is 'location'
    }
    mapped_data = {}
    for k, v in update_data.items():
        db_key = field_map.get(k, k)
        mapped_data[db_key] = v

    # Verify ownership
    try:
        check = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
        rows = check.data if check else []
        if not rows:
            # RLS may block read — try service-role client
            svc = _get_service_client()
            if svc:
                check = svc.table("businesses").select("user_id").eq("id", business_id).execute()
                rows = check.data if check else []
        if not rows:
            raise HTTPException(status_code=404, detail="Business not found")
        if rows[0].get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ownership check failed: {e}")
        raise HTTPException(status_code=500, detail="Ownership check failed")

    try:
        # Use service-role client to bypass RLS for the update
        svc = _get_service_client()
        client = svc or supabase
        result = (
            client.table("businesses")
            .update(mapped_data)
            .eq("id", business_id)
            .execute()
        )
        if result.data:
            logger.info(f"Updated business {business_id}: {list(mapped_data.keys())}")
            return {"success": True, "data": result.data[0]}
        else:
            logger.info(f"Updated business {business_id} (no data returned): {list(mapped_data.keys())}")
            return {"success": True, "message": "Profile updated"}
    except Exception as e:
        logger.error(f"Business profile update failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update business profile")
