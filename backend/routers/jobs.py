"""
Scheduled Jobs Router.

Exposes scheduled job management endpoints for the Settings page.
Settings.tsx calls GET /jobs/{business_id}, POST /jobs/{business_id}/toggle/{job_id},
and POST /jobs/{business_id}/ensure-defaults.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.scheduler import get_scheduler

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["Scheduled Jobs"])


class ToggleJobPayload(BaseModel):
    active: bool


@router.get("/{business_id}")
async def get_jobs(business_id: str):
    """Get all scheduled jobs for a business."""
    scheduler = get_scheduler()
    jobs = scheduler.get_jobs(business_id)
    return {"jobs": jobs}


@router.post("/{business_id}/toggle/{job_id}")
async def toggle_job(business_id: str, job_id: int, payload: ToggleJobPayload):
    """Toggle a scheduled job active/paused."""
    scheduler = get_scheduler()
    scheduler.toggle_job(str(job_id), payload.active)
    return {"success": True, "job_id": job_id, "active": payload.active}


@router.post("/{business_id}/ensure-defaults")
async def ensure_defaults(business_id: str):
    """Create default scheduled jobs for a business (if missing)."""
    scheduler = get_scheduler()
    scheduler.ensure_default_jobs(business_id)
    # Return the updated job list
    jobs = scheduler.get_jobs(business_id)
    return {"success": True, "jobs": jobs}
