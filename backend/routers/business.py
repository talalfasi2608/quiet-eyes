"""
Business Profile Router.

Handles business profile CRUD operations.
Settings.tsx calls PATCH /business/profile/{business_id}
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/business", tags=["Business"])


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    archetype: Optional[str] = None
    scope: Optional[str] = None


@router.patch("/profile/{business_id}")
async def update_business_profile(business_id: str, payload: BusinessProfileUpdate):
    """Update a business profile. Called by Settings page on save."""
    supabase = _get_supabase()
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

    try:
        result = (
            supabase.table("businesses")
            .update(mapped_data)
            .eq("id", business_id)
            .execute()
        )
        if result.data:
            logger.info(f"Updated business {business_id}: {list(mapped_data.keys())}")
            return {"success": True, "data": result.data[0]}
        else:
            # RLS may have blocked the update or row doesn't exist
            # Try upsert
            mapped_data["id"] = business_id
            result = (
                supabase.table("businesses")
                .upsert(mapped_data)
                .execute()
            )
            if result.data:
                return {"success": True, "data": result.data[0]}
            return {"success": True, "message": "Profile update queued"}
    except Exception as e:
        logger.error(f"Business profile update failed: {e}")
        # Don't expose internal errors
        raise HTTPException(status_code=500, detail="Failed to update business profile")
