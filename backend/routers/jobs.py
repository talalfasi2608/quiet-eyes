"""
Scheduled Jobs Router.

Exposes scheduled job management endpoints for the Settings page.
Settings.tsx calls GET /jobs/{business_id}, POST /jobs/{business_id}/toggle/{job_id},
and POST /jobs/{business_id}/ensure-defaults.
"""

import logging
import os

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.scheduler import get_scheduler
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["Scheduled Jobs"])


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


def _verify_business_owner(business_id: str, auth_user_id: str):
    """Verify the authenticated user owns this business. Raises 403 if not."""
    sb = _get_service_client()
    if sb:
        try:
            result = sb.table("businesses").select("user_id").eq("id", business_id).execute()
            if result.data and result.data[0].get("user_id") == auth_user_id:
                return
        except Exception:
            pass
    raise HTTPException(status_code=403, detail="Access denied")


class ToggleJobPayload(BaseModel):
    active: bool


@router.get("/{business_id}")
async def get_jobs(business_id: str, auth_user_id: str = Depends(require_auth)):
    """Get all scheduled jobs for a business."""
    _verify_business_owner(business_id, auth_user_id)
    scheduler = get_scheduler()
    jobs = scheduler.get_jobs(business_id)
    return {"jobs": jobs}


@router.post("/{business_id}/toggle/{job_id}")
async def toggle_job(business_id: str, job_id: int, payload: ToggleJobPayload, auth_user_id: str = Depends(require_auth)):
    """Toggle a scheduled job active/paused."""
    _verify_business_owner(business_id, auth_user_id)
    scheduler = get_scheduler()
    scheduler.toggle_job(str(job_id), payload.active)
    return {"success": True, "job_id": job_id, "active": payload.active}


@router.post("/{business_id}/ensure-defaults")
async def ensure_defaults(business_id: str, auth_user_id: str = Depends(require_auth)):
    """Create default scheduled jobs for a business (if missing)."""
    _verify_business_owner(business_id, auth_user_id)
    scheduler = get_scheduler()
    scheduler.ensure_default_jobs(business_id)
    # Return the updated job list
    jobs = scheduler.get_jobs(business_id)
    return {"success": True, "jobs": jobs}
